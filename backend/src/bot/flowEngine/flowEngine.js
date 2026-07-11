/**
 * @file flowEngine.js
 * @description Motor de ejecución del flujo visual.
 *
 * Lee el diagrama guardado en la base de datos (tabla flujos_bot) y lo ejecuta
 * nodo a nodo, siguiendo las conexiones/aristas (edges) definidas en el canvas.
 *
 * Integración con la máquina de estados existente:
 *   - El flujo visual usa el estado "FLOW_ENGINE" en la tabla conversaciones.
 *   - La posición actual dentro del flujo (nodo actual) se guarda en metadata
 *     bajo la clave `flow_node_id`.
 *   - Si un nodo requiere esperar respuesta del cliente, se guarda
 *     `flow_waiting` = true en metadata.
 *
 * Esto permite que el motor conviva con el bot legacy: si no existe flujo
 * activo para la empresa, el dispatcher usa los handlers legacy de estados.
 */

const flujoRepo        = require('../../repositories/flujo.repository');
const conversacionRepo = require('../../repositories/conversacion.repository');
const mensajeRepo      = require('../../repositories/mensaje.repository');
const { ConversacionMeta } = require('../conversacion.meta');
const { ejecutarNodo } = require('./nodeHandlers');
const nlu              = require('../nlu');
const logger           = require('../../config/logger');

/* ── Estado especial para conversaciones gestionadas por el motor ──────── */
const ESTADO_FLOW = 'FLOW_ENGINE';

/* ── Cache en memoria (TTL 5 min) ──────────────────────────────────────── */
const _cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function _getFlujo(empresaId) {
  const cached = _cache.get(empresaId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.flujo;

  const flujo = await flujoRepo.getFlujo(empresaId);
  _cache.set(empresaId, { flujo, ts: Date.now() });
  return flujo;
}

/** Invalida el cache de una empresa (llamar al guardar flujo). */
function invalidarCache(empresaId) {
  _cache.delete(empresaId);
}

/* ── Helpers de navegación de grafo ────────────────────────────────────── */

/**
 * Encuentra el nodo raíz del flujo.
 * El nodo raíz es el que tiene `root_node` configurado, o el primero cuyo tipo
 * sea 'mensaje' o 'intencion' y no tenga aristas entrantes.
 */
function _encontrarNodoRaiz(flujo) {
  const nodos      = flujo.nodos      || [];
  const conexiones = flujo.conexiones || [];

  // Intentar con root_node
  const rootId = flujo.root_node;
  if (rootId) {
    const root = nodos.find(n => n.id === rootId);
    if (root) return root;
  }

  // Nodos sin aristas entrantes
  const conEntrada = new Set(conexiones.map(c => c.target));
  const sinEntrada = nodos.filter(n => !conEntrada.has(n.id));
  if (sinEntrada.length > 0) return sinEntrada[0];

  return nodos[0] || null;
}

/**
 * Dado un nodo y el id del handle de salida (nextEdge),
 * devuelve el nodo destino siguiendo la conexión correspondiente.
 */
function _siguienteNodo(flujo, nodoActualId, nextEdge) {
  const conexiones = flujo.conexiones || [];
  const nodos      = flujo.nodos      || [];

  // Buscar la arista que sale desde este nodo con este handle
  let arista = conexiones.find(c =>
    c.source === nodoActualId && (c.sourceHandle === nextEdge || c.sourceHandle === 'out')
  );

  // Si nextEdge es null o 'out', buscar cualquier arista saliente
  if (!arista) {
    arista = conexiones.find(c => c.source === nodoActualId);
  }

  if (!arista) return null;
  return nodos.find(n => n.id === arista.target) || null;
}

/* ── Motor principal ────────────────────────────────────────────────────── */

async function tieneFlujActivo(empresaId) {
  try {
    const flujo = await _getFlujo(empresaId);
    return !!(flujo && (flujo.nodos || []).length > 0);
  } catch {
    return false;
  }
}

/**
 * Punto de entrada del motor.
 * Se llama desde _maquinaEstados (bot.service.js) cuando el estado
 * de la conversación es FLOW_ENGINE, o al inicio de una conversación nueva.
 *
 * @param {string}  mensajeCliente     — Texto enviado por el cliente
 * @param {object}  conversacion       — Objeto conversación de la BD
 * @param {object}  usuario            — Objeto usuario de la BD
 * @returns {Promise<{ respuesta, nuevoEstado, teclado, earlyReturn? }>}
 */
async function handle(mensajeCliente, conversacion, usuario) {
  const empresaId = conversacion.empresa_id;

  try {
    const flujo = await _getFlujo(empresaId);
    if (!flujo) {
      logger.warn(`[FLOW ENGINE] No se encontró flujo para empresa "${empresaId}"`);
      return {
        respuesta: '⚠️ El flujo del bot no está configurado. Por favor contacta al administrador.',
        nuevoEstado: ESTADO_FLOW,
      };
    }

    const nodos      = flujo.nodos      || [];
    const meta       = conversacion.metadata || {};
    let   nodoActual = null;

    // ── Determinar el nodo actual ───────────────────────────────────────────
    if (meta.flow_node_id) {
      nodoActual = nodos.find(n => n.id === meta.flow_node_id) || null;
    }

    if (!nodoActual) {
      // Primera vez: empezar desde la raíz
      nodoActual = _encontrarNodoRaiz(flujo);
      if (!nodoActual) {
        return {
          respuesta:   '⚠️ El flujo no tiene un nodo de inicio. Configúralo en el editor.',
          nuevoEstado: ESTADO_FLOW,
        };
      }
    }

    // ── Contexto del cliente ───────────────────────────────────────────────
    const metaObj = new ConversacionMeta(meta);
    const servicio = metaObj.servicio || {};

    const ctx = {
      nombre:   (usuario?.nombre || 'cliente').split(' ')[0],
      empresa:  empresaId,
      ...metaObj.toJSON(),
      esMultiServicio: metaObj.esMultiServicio,
      servicio_etiqueta:  servicio.etiqueta || '',
      servicio_direccion: servicio.direccion || '',
      servicio_estado:    servicio.estado || '',
      servicio_deuda:     servicio.deuda !== undefined ? `$${servicio.deuda.toFixed(2)} MXN` : '0.00',
      servicio_vencimiento: servicio.fecha_vencimiento || '',
      servicio_portal_pago: servicio.portal_pago || '',
    };

    let modoEspera = !!meta.flow_waiting;

    // ── Interceptación Global de Intenciones (NLU) ─────────────────────────
    // Si el cliente envió un mensaje y estamos esperando respuesta...
    if (modoEspera && mensajeCliente) {
      const resNlu = await nlu.detectarIntencion(mensajeCliente, empresaId);
      if (resNlu) {
        // Buscar si en el flujo existe algún nodo de intención que capture esta intención
        const nodoIntencionGlobal = nodos.find(n => 
          n.type === 'intencion' && 
          (n.data?.opciones || []).some(op => (op.valor || '').toLowerCase() === resNlu.intencion.toLowerCase())
        );

        if (nodoIntencionGlobal && nodoIntencionGlobal.id !== nodoActual.id) {
          logger.info(`[FLOW ENGINE] Intención global '${resNlu.intencion}' interceptada. Saltando al nodo ${nodoIntencionGlobal.id}`);
          nodoActual = nodoIntencionGlobal;
          // Dejamos modoEspera = true para que el nodo evalúe el mensaje inmediatamente
        }
      }
    }

    // ── Ejecutar el nodo actual ────────────────────────────────────────────
    const resultado = await ejecutarNodo(nodoActual, ctx, mensajeCliente, modoEspera, conversacion, usuario);

    // ── Early return (escalada a agente, cierre, etc.) ─────────────────────
    if (resultado.earlyReturn) {
      return { earlyReturn: true, resultado: resultado.earlyReturn };
    }

    // ── Si el nodo espera respuesta → guardar posición y esperar ──────────
    if (resultado.waitInput) {
      await conversacionRepo.updateMetadata(conversacion.id, {
        ...meta,
        flow_node_id: nodoActual.id,
        flow_waiting: true,
      });
      return {
        respuesta:   resultado.respuesta,
        nuevoEstado: ESTADO_FLOW,
        teclado:     resultado.teclado,
      };
    }

    // ── Avanzar al siguiente nodo ──────────────────────────────────────────
    let respuestaFinal = resultado.respuesta;
    let tecladoFinal   = resultado.teclado;
    let nextEdge       = resultado.nextEdge;

    // Navegar el grafo: seguir nodos silenciosos (sin waitInput ni respuesta)
    // hasta encontrar uno que tenga respuesta o que requiera esperar input.
    let siguienteNodo = _siguienteNodo(flujo, nodoActual.id, nextEdge);
    let pasos = 0;

    while (siguienteNodo && pasos < 20) {
      pasos++;
      const sigResult = await ejecutarNodo(siguienteNodo, ctx, mensajeCliente, false, conversacion, usuario);

      if (sigResult.earlyReturn) {
        return { earlyReturn: true, resultado: sigResult.earlyReturn };
      }

      if (sigResult.respuesta) {
        respuestaFinal = respuestaFinal
          ? respuestaFinal + '\n\n' + sigResult.respuesta
          : sigResult.respuesta;
        tecladoFinal   = sigResult.teclado || tecladoFinal;
      }

      if (sigResult.waitInput) {
        await conversacionRepo.updateMetadata(conversacion.id, {
          ...meta,
          flow_node_id: siguienteNodo.id,
          flow_waiting: true,
        });
        return {
          respuesta:   respuestaFinal,
          nuevoEstado: ESTADO_FLOW,
          teclado:     tecladoFinal || sigResult.teclado,
        };
      }

      nextEdge      = sigResult.nextEdge;
      siguienteNodo = _siguienteNodo(flujo, siguienteNodo.id, nextEdge);

      // Si no hay siguiente nodo, llegamos al final del flujo
      if (!siguienteNodo) {
        await conversacionRepo.updateMetadata(conversacion.id, {
          ...meta,
          flow_node_id: null,
          flow_waiting: false,
        });
        break;
      }
    }

    // ── Guardar la nueva posición ──────────────────────────────────────────
    if (siguienteNodo) {
      await conversacionRepo.updateMetadata(conversacion.id, {
        ...meta,
        flow_node_id: siguienteNodo.id,
        flow_waiting: false,
      });
    } else {
      // Fin del flujo: limpiar posición
      await conversacionRepo.updateMetadata(conversacion.id, {
        ...meta,
        flow_node_id: null,
        flow_waiting: false,
      });
    }

    return {
      respuesta:   respuestaFinal || null,
      nuevoEstado: ESTADO_FLOW,
      teclado:     tecladoFinal,
    };

  } catch (err) {
    logger.error('[FLOW ENGINE] Error ejecutando flujo:', err.message, err.stack);
    return {
      respuesta:   '⚠️ Ocurrió un error interno. Por favor escribe "hola" para reiniciar.',
      nuevoEstado: ESTADO_FLOW,
    };
  }
}

module.exports = { handle, tieneFlujActivo, invalidarCache, ESTADO_FLOW };
