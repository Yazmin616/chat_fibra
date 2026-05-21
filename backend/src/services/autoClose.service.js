const db               = require('../config/db');
const conversacionRepo = require('../repositories/conversacion.repository');
const mensajeRepo      = require('../repositories/mensaje.repository');
const agenteRepo       = require('../repositories/agente.repository');
const infraccionRepo   = require('../repositories/infraccion.repository');
const { enviarMensaje } = require('../adapters');
const { emitToConv }   = require('../utils/rooms');
const logger           = require('../config/logger');
const { parseJornada, esDentroJornada, horasRealesDesde } = require('../utils/businessHours');

/** Minutos sin heartbeat para considerar a un agente como inactivo. */
const INACTIVIDAD_AGENTE_MIN = 15;

/**
 * Horas reales que deben transcurrir desde que un cliente abre una conversación
 * ESPERANDO_AGENTE para que se genere infracción y se cierre el chat.
 * Equivale a la ventana gratuita de Meta (24 h desde el primer mensaje).
 */
const VENTANA_META_HORAS = 24;

/**
 * Minutos dentro de jornada (sin respuesta del agente en estado "atendiendo")
 * para generar infracción aunque el auto-cierre aún no haya corrido.
 */
const ESPERA_INFRACCION_MIN = 15;

function iniciarAutoCierre(io) {
  logger.info('Tarea de auto-cierre iniciada.');

  // ── Presencia: marca offline a agentes sin heartbeat reciente ──────────────
  setInterval(async () => {
    try {
      const result = await agenteRepo.marcarInactivos(INACTIVIDAD_AGENTE_MIN);
      if (result.rowCount > 0) {
        logger.info(`[PRESENCIA] ${result.rowCount} agente(s) marcados como offline por inactividad.`);
        if (io) io.emit('agentes_actualizados');
      }
    } catch (err) {
      logger.error('[PRESENCIA] Error al marcar inactivos:', { error: err.message });
    }
  }, 60_000);

  // ── Auto-cierre + infracciones ─────────────────────────────────────────────
  setInterval(async () => {
    try {
      const { rows } = await db.query(`
        SELECT c.id, c.usuario_id, c.empresa_id, c.departamento, c.es_humano,
               c.estado, c.agente_id, c.created_at,
               u.external_id, u.canal, u.nombre AS cliente_nombre,
               a.nombre AS agente_nombre
        FROM conversaciones c
        JOIN  usuarios u ON c.usuario_id=u.id
        LEFT JOIN agentes a ON c.agente_id=a.id
        WHERE c.estado != 'cerrada' AND c.estado NOT LIKE 'ENCUESTA%'
      `);

      for (const conv of rows) {
        // ── Configuración de la empresa (todos los pares clave-valor) ────────
        const configRes = await db.query(
          'SELECT clave, valor FROM configuraciones WHERE empresa_id=$1',
          [conv.empresa_id || 'fibratec']
        );
        const configMap = {};
        configRes.rows.forEach(r => { configMap[r.clave] = r.valor; });

        const minutos = parseInt(configMap.tiempo_inactividad || '10');
        const jornada = parseJornada(configMap);
        const ahora   = new Date();

        // ── ESPERANDO_AGENTE: ventana de 24 h reales desde creación ─────────
        //
        // Regla: el equipo tiene VENTANA_META_HORAS (24 h) desde que el cliente
        // abrió el chat para responder sin coste ni infracción. Pasadas esas
        // horas se levanta la infracción al área y se cierra el chat.
        // No depende de la jornada: el contador corre en tiempo real.
        if (conv.estado === 'ESPERANDO_AGENTE') {
          const horasTranscurridas = horasRealesDesde(conv.created_at);
          if (horasTranscurridas < VENTANA_META_HORAS) continue;

          const minEspera = Math.round(horasTranscurridas * 60);
          await _evaluarInfraccion(conv, minEspera, io);
          await _cerrarHumano(conv, io);
          continue;
        }

        // ── Sesiones humanas (atendiendo) fuera de jornada: no hacer nada ───
        // Los agentes no trabajan fuera de jornada; infracciones y cierres
        // solo aplican mientras el equipo está en horario laboral.
        if (conv.es_humano && !esDentroJornada(ahora, jornada)) continue;

        // ── Inactividad por tiempo_inactividad ───────────────────────────────
        const { rows: inactiva } = await db.query(
          `SELECT id,
                  ROUND(EXTRACT(EPOCH FROM (NOW()-updated_at))/60) AS minutos_espera
           FROM conversaciones
           WHERE id=$1 AND updated_at < NOW()-($2||' minutes')::interval`,
          [conv.id, minutos]
        );

        const estaInactiva = inactiva.length > 0;
        const tiempoEspera = estaInactiva ? parseInt(inactiva[0].minutos_espera) : 0;

        // ── Lógica de infracción (para estado "atendiendo") ──────────────────
        //
        // Regla:
        //   - atendiendo + último mensaje del CLIENTE → infracción al AGENTE
        //     si el agente lleva >= ESPERA_INFRACCION_MIN sin responder.
        //   - atendiendo + último mensaje del AGENTE → SIN infracción
        //     (fue el cliente quien dejó de responder).
        const minutosParaInfraccion = Math.min(minutos, ESPERA_INFRACCION_MIN);
        const { rows: inactivaInfrac } = await db.query(
          `SELECT 1 FROM conversaciones
           WHERE id=$1 AND updated_at < NOW()-($2||' minutes')::interval`,
          [conv.id, minutosParaInfraccion]
        );

        if (inactivaInfrac.length > 0) {
          await _evaluarInfraccion(conv, tiempoEspera || minutosParaInfraccion, io);
        }

        // ── Cierre automático ────────────────────────────────────────────────
        if (!estaInactiva) continue;

        // Sesiones puras de bot: cerrar sin encuesta.
        if (!conv.es_humano) {
          await db.query(
            'UPDATE conversaciones SET estado=$1, updated_at=NOW() WHERE id=$2',
            ['cerrada', conv.id]
          );
          if (io) {
            emitToConv(io, conv.departamento, 'conversacion_actualizada', {
              id: conv.id, empresa_id: conv.empresa_id, estado: 'cerrada', es_humano: false,
            });
          }
          continue;
        }

        // Sesión humana (atendiendo): enviar encuesta CSAT y marcar ENCUESTA_AGENTE.
        await _cerrarHumano(conv, io);
      }
    } catch (err) {
      logger.error('Auto-cierre error', { error: err.message });
    }
  }, 60_000);
}

/**
 * Cierra un chat humano enviando la encuesta CSAT al cliente y notificando
 * el dashboard. Se usa tanto desde el cierre por inactividad (atendiendo)
 * como desde el vencimiento de la ventana Meta (ESPERANDO_AGENTE).
 *
 * @private
 */
async function _cerrarHumano(conv, io) {
  const bannerMsg   = 'Chat cerrado automáticamente por inactividad';
  const agenteParte = conv.agente_nombre ? ` de *${conv.agente_nombre}*` : '';
  const surveyText  = `¿Cómo calificarías la atención${agenteParte} que recibiste? 🌟\n\n1️⃣  Mala\n2️⃣  Regular\n3️⃣  Buena\n\nEscribe el número de tu calificación.`;

  await db.query(
    'UPDATE conversaciones SET estado=$1, es_humano=false, updated_at=NOW() WHERE id=$2',
    ['ENCUESTA_AGENTE', conv.id]
  );
  await mensajeRepo.create(conv.id, 'sistema_success', bannerMsg);
  await mensajeRepo.create(conv.id, 'bot', surveyText);
  await enviarMensaje(conv.canal || 'telegram', conv.external_id, surveyText, conv.empresa_id);

  if (io) {
    emitToConv(io, conv.departamento, 'nuevo_mensaje', {
      conversacion_id: conv.id, usuario_id: conv.usuario_id,
      empresa_id: conv.empresa_id, mensaje: bannerMsg, remitente: 'sistema_success',
    });
    emitToConv(io, conv.departamento, 'nuevo_mensaje', {
      conversacion_id: conv.id, usuario_id: conv.usuario_id,
      empresa_id: conv.empresa_id, mensaje: surveyText, remitente: 'bot',
    });
    emitToConv(io, conv.departamento, 'conversacion_actualizada', {
      id: conv.id, empresa_id: conv.empresa_id, estado: 'ENCUESTA_AGENTE', es_humano: false,
    });
  }
}

/**
 * Evalúa si la conversación merece una infracción y la crea si corresponde.
 *
 * @private
 */
async function _evaluarInfraccion(conv, tiempoEspera, io) {
  try {
    if (conv.estado === 'ESPERANDO_AGENTE') {
      // Nadie tomó el chat → infracción al ÁREA
      const yaExiste = await infraccionRepo.existsByConversacion(conv.id, 'area');
      if (yaExiste) return;

      const { rows: [inf] } = await infraccionRepo.create(
        conv.id, conv.empresa_id, conv.departamento,
        conv.cliente_nombre, tiempoEspera, 'area', null, null
      );
      logger.warn(`[INFRACCIÓN ÁREA] Conv ${conv.id} — ${conv.departamento} — ${tiempoEspera} min sin tomar.`);
      _emitirInfraccion(io, conv, inf, tiempoEspera, 'area', null, null);

    } else if (conv.estado === 'atendiendo') {
      // Verificar quién envió el último mensaje
      const { rows: lastMsg } = await db.query(
        `SELECT remitente FROM mensajes WHERE conversacion_id=$1 ORDER BY id DESC LIMIT 1`,
        [conv.id]
      );
      const ultimoRemitente = lastMsg[0]?.remitente;

      if (ultimoRemitente !== 'user') {
        // El cliente fue quien dejó de responder → cierre por inactividad normal
        // No se levanta infracción.
        return;
      }

      // El agente no respondió al cliente → infracción al AGENTE
      const yaExiste = await infraccionRepo.existsByConversacion(conv.id, 'agente');
      if (yaExiste) return;

      const { rows: [inf] } = await infraccionRepo.create(
        conv.id, conv.empresa_id, conv.departamento,
        conv.cliente_nombre, tiempoEspera, 'agente', conv.agente_id, conv.agente_nombre
      );
      logger.warn(`[INFRACCIÓN AGENTE] Conv ${conv.id} — ${conv.agente_nombre} — ${tiempoEspera} min sin responder.`);
      _emitirInfraccion(io, conv, inf, tiempoEspera, 'agente', conv.agente_id, conv.agente_nombre);
    }
  } catch (err) {
    logger.error('[INFRACCIÓN] Error al evaluar:', { error: err.message });
  }
}

function _emitirInfraccion(io, conv, inf, tiempoEspera, tipo, agente_id, agente_nombre) {
  if (!io) return;
  emitToConv(io, conv.departamento, 'nueva_infraccion', {
    id:              inf.id,
    conversacion_id: conv.id,
    empresa_id:      conv.empresa_id,
    departamento:    conv.departamento,
    cliente_nombre:  conv.cliente_nombre,
    tiempo_espera:   tiempoEspera,
    tipo,
    agente_id,
    agente_nombre,
    created_at:      inf.created_at,
  });
}

module.exports = { iniciarAutoCierre };
