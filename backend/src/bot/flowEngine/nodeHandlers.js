/**
 * @file nodeHandlers.js
 * @description Handlers individuales para cada tipo de nodo del flujo visual.
 *
 * Cada handler recibe el contexto de ejecución y devuelve un objeto con:
 *   - respuesta {string|null}     — texto a enviar al cliente (null = nodo silencioso)
 *   - teclado   {object|null}     — teclado de botones para WhatsApp (opcional)
 *   - nextEdge  {string|null}     — id del handle de salida a seguir (null = "out" por defecto)
 *   - earlyReturn {object|null}   — si el nodo cierra la conversación (escalada a agente)
 *   - waitInput  {boolean}        — si el flujo debe esperar el próximo mensaje del cliente
 */

const conversacionRepo = require('../../repositories/conversacion.repository');
const mensajeRepo      = require('../../repositories/mensaje.repository');
const { ESTADOS, DEPARTAMENTOS } = require('../constants');
const nlu              = require('../nlu');
const logger           = require('../../config/logger');

/* ── Utilidades ──────────────────────────────────────────────────────────── */

/**
 * Construye un teclado de botones para WhatsApp a partir de las opciones del nodo.
 * Formato compatible con el handler de WhatsApp.
 */
function buildKeyboardFromOpciones(opciones = []) {
  if (!opciones || opciones.length === 0) return null;
  return {
    inline_keyboard: opciones.map(op => ([{
      text:          op.texto || op.valor || 'Opción',
      callback_data: op.valor || op.texto,
    }])),
  };
}

/**
 * Interpola variables simples en un texto dado el contexto.
 * Ej: "Hola {{nombre}}" + ctx.nombre = "Hola Juan"
 */
function interpolar(texto = '', ctx = {}) {
  return texto.replace(/\{\{(\w+)\}\}/g, (_, key) => ctx[key] ?? `{{${key}}}`);
}

/* ═══════════════════════════════════════════════════════════════════════════
   HANDLERS POR TIPO DE NODO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Nodo MENSAJE — envía texto al cliente y avanza al siguiente nodo.
 */
async function handleMensaje(nodo, ctx) {
  const texto = interpolar(nodo.datos.texto || nodo.datos.label || '', ctx);
  return { respuesta: texto, teclado: null, nextEdge: 'out', waitInput: false };
}

/**
 * Nodo LISTA_OPCIONES — envía una pregunta con botones y espera la respuesta del cliente.
 * Al recibir respuesta, la nextEdge será el valor (callback_data) del botón presionado.
 */
async function handleListaOpciones(nodo, ctx, mensajeCliente, modoEspera, conversacion) {
  let opciones = nodo.datos.opciones || [];
  let textoBase = nodo.datos.texto || nodo.datos.label || '¿Qué deseas hacer?';

  // ── Caso especial: Selección dinámica de servicios ───────────────────────
  if (nodo.id === 'seleccion_servicio' && ctx.cliente && ctx.cliente.servicios) {
    const servicios = ctx.cliente.servicios || [];
    const listaTexto = servicios.map((s, i) => `${i + 1}️⃣  ${s.etiqueta}`).join('\n');
    textoBase = `${textoBase}\n\n${listaTexto}`;
    
    // Generar las opciones dinámicas del teclado
    opciones = servicios.map((s, idx) => ({
      texto: `${idx + 1}️⃣  ${s.etiqueta}`,
      valor: `servicio_${idx}`
    }));
    // Añadir el botón de consulta ajena
    opciones.push({
      texto: '👥 Consultar para otra persona',
      valor: 'consulta_ajena'
    });
  }

  // ── Caso especial: Selección dinámica de área ─────────────────────────────
  if (nodo.id === 'seleccion_area') {
    const db = require('../../config/db');
    const { rows: areas } = await db.query(
      `SELECT nombre_area, descripcion FROM areas_soluciones WHERE empresa_id ? $1 OR empresa_id ? 'todas' ORDER BY id`,
      [ctx.empresa]
    );
    
    if (areas.length > 0) {
      const listaAreas = areas.map((a) => `*${a.nombre_area}*: ${a.descripcion || 'Sin descripción'}`).join('\n\n');
      textoBase = `👨‍💼 ¿Con qué área deseas comunicarte?\n\n${listaAreas}`;
      opciones = areas.map((a) => ({
        texto: a.nombre_area,
        valor: a.nombre_area
      }));
    }
    
    if (modoEspera) {
      const m = (mensajeCliente || '').trim().toLowerCase();
      const opcionElegida = opciones.find(op => 
        (op.valor && op.valor.toLowerCase() === m) || 
        (op.texto && op.texto.toLowerCase() === m)
      );
      
      if (opcionElegida) {
        const fakeNodo = {
          datos: {
            equipo: opcionElegida.valor,
            mensaje: `👨‍💼 Te conectamos con *${opcionElegida.valor}*.\n\n¡Un asesor te atenderá pronto! ⏱️`
          }
        };
        return await handleAsignarEquipo(fakeNodo, ctx, conversacion);
      }
    }
  }

  if (!modoEspera) {
    // Primera vez: enviar la pregunta con botones
    const texto = interpolar(textoBase, ctx);
    return {
      respuesta:  texto,
      teclado:    buildKeyboardFromOpciones(opciones),
      nextEdge:   null,      // aún no avanzamos — esperamos respuesta
      waitInput:  true,
    };
  }

  // Segunda vez: el cliente respondió — encontrar la opción que coincida
  const m = (mensajeCliente || '').trim().toLowerCase();
  const opcionElegida = opciones.find(op =>
    (op.valor && op.valor.toLowerCase() === m) ||
    (op.texto && op.texto.toLowerCase() === m)
  );

  if (opcionElegida) {
    return { respuesta: null, teclado: null, nextEdge: opcionElegida.valor || opcionElegida.texto, waitInput: false };
  }

  // No reconoció la opción: repetir el teclado
  const texto = interpolar(textoBase, ctx);
  return {
    respuesta: `⚠️ Por favor selecciona una de las opciones:\n\n${texto}`,
    teclado:   buildKeyboardFromOpciones(opciones),
    nextEdge:  null,
    waitInput: true,
  };
}

/**
 * Nodo CONDICION — evalúa un campo del contexto y elige la rama correspondiente.
 * Si el valor del campo coincide con `datos.valor`, sigue la primera opción (si hay),
 * de lo contrario sigue la segunda.
 */
async function handleCondicion(nodo, ctx, mensajeCliente, modoEspera) {
  const opciones = nodo.datos.opciones || [];

  if (!modoEspera) {
    // Si no tiene opciones configuradas, actuar como nodo mensaje
    if (opciones.length === 0) {
      return { respuesta: nodo.datos.texto || null, teclado: null, nextEdge: 'out', waitInput: false };
    }

    // Enviar las opciones como teclado
    const texto = interpolar(nodo.datos.texto || nodo.datos.label || '¿Qué deseas hacer?', ctx);
    return {
      respuesta: texto,
      teclado:   buildKeyboardFromOpciones(opciones),
      nextEdge:  null,
      waitInput: true,
    };
  }

  // Evaluar respuesta del cliente
  const m = (mensajeCliente || '').trim().toLowerCase();
  const opcionElegida = opciones.find(op =>
    (op.valor && op.valor.toLowerCase() === m) ||
    (op.texto && op.texto.toLowerCase() === m)
  );

  if (opcionElegida) {
    return { respuesta: null, teclado: null, nextEdge: opcionElegida.valor || opcionElegida.texto, waitInput: false };
  }

  // No coincidió: si hay campo/valor para evaluación automática, intentarlo
  if (nodo.datos.campo && nodo.datos.valor) {
    const campoVal = String(ctx[nodo.datos.campo] || '').toLowerCase();
    const esperado = String(nodo.datos.valor).toLowerCase();
    const nextEdge = campoVal === esperado
      ? (opciones[0]?.valor || 'si')
      : (opciones[1]?.valor || 'no');
    return { respuesta: null, teclado: null, nextEdge, waitInput: false };
  }

  // Repetir
  const texto = interpolar(nodo.datos.texto || '¿Qué deseas hacer?', ctx);
  return {
    respuesta: `⚠️ Por favor selecciona una opción:\n\n${texto}`,
    teclado:   buildKeyboardFromOpciones(opciones),
    nextEdge:  null,
    waitInput: true,
  };
}

/**
 * Nodo INTENCION — detecta la intención del cliente por palabras clave/texto libre.
 * Si el cliente ya escribió algo, encuentra la opción que mejor coincida.
 */
async function handleIntencion(nodo, ctx, mensajeCliente, modoEspera) {
  const opciones = nodo.datos.opciones || [];

  if (!modoEspera) {
    // Sin mensaje todavía: esperamos input del cliente
    const texto = interpolar(nodo.datos.texto || nodo.datos.label || '¿En qué puedo ayudarte?', ctx);
    return {
      respuesta: texto || null,
      teclado:   opciones.length > 0 ? buildKeyboardFromOpciones(opciones) : null,
      nextEdge:  null,
      waitInput: true,
    };
  }

  // Analizar el mensaje del cliente
  const m = (mensajeCliente || '').trim().toLowerCase();

  // NLU: Consultar el motor de intenciones
  const resNlu = await nlu.detectarIntencion(mensajeCliente, ctx.empresa);
  if (resNlu) {
    const coincidencia = opciones.find(op => (op.valor || '').toLowerCase() === resNlu.intencion.toLowerCase());
    if (coincidencia) {
      return { respuesta: null, teclado: null, nextEdge: coincidencia.valor || coincidencia.texto, waitInput: false };
    }
  }

  // Fallback 1: coincidencia exacta directa por valor o texto
  const exacta = opciones.find(op =>
    (op.valor && op.valor.toLowerCase() === m) ||
    (op.texto && op.texto.toLowerCase() === m)
  );
  if (exacta) {
    return { respuesta: null, teclado: null, nextEdge: exacta.valor || exacta.texto, waitInput: false };
  }

  // Segundo: coincidencia parcial (la opción aparece en el mensaje)
  const parcial = opciones.find(op => {
    const key = (op.valor || op.texto || '').toLowerCase();
    return key && m.includes(key);
  });
  if (parcial) {
    return { respuesta: null, teclado: null, nextEdge: parcial.valor || parcial.texto, waitInput: false };
  }

  // No detectó: responder con menú si hay opciones, de lo contrario seguir el default
  if (opciones.length > 0) {
    return {
      respuesta: `🤔 No entendí tu mensaje. Por favor selecciona una opción:`,
      teclado:   buildKeyboardFromOpciones(opciones),
      nextEdge:  null,
      waitInput: true,
    };
  }

  return { respuesta: null, teclado: null, nextEdge: 'out', waitInput: false };
}

/**
 * Nodo ESPERAR — pausa el flujo N segundos (implementado como delay real).
 */
async function handleEsperar(nodo, ctx) {
  const segundos = parseInt(nodo.datos.segundos || '2', 10);
  await new Promise(resolve => setTimeout(resolve, Math.min(segundos * 1000, 10000)));
  return { respuesta: null, teclado: null, nextEdge: 'out', waitInput: false };
}

/**
 * Nodo ESPERAR_MENSAJE — espera un mensaje libre del cliente.
 * Guarda el texto en el contexto bajo `datos.variable` si está definido.
 */
async function handleEsperarMensaje(nodo, ctx, mensajeCliente, modoEspera) {
  if (!modoEspera) {
    const texto = interpolar(nodo.datos.texto || '', ctx);
    return { respuesta: texto || null, teclado: null, nextEdge: null, waitInput: true };
  }
  // Ya recibimos el mensaje: guardarlo en contexto si hay variable
  if (nodo.datos.variable && mensajeCliente) {
    ctx[nodo.datos.variable] = mensajeCliente;
  }
  return { respuesta: null, teclado: null, nextEdge: 'out', waitInput: false };
}

/**
 * Nodo ASIGNAR_EQUIPO — crea conversación en el departamento y escala al agente.
 * Este nodo termina el flujo del bot para esta sesión.
 */
async function handleAsignarEquipo(nodo, ctx, conversacion) {
  const dept = nodo.datos.equipo || DEPARTAMENTOS.SOPORTE;
  const texto = interpolar(
    nodo.datos.mensaje || `🧑‍💼 Te conectamos con *${dept}*. Un asesor te atenderá pronto. 🙏`,
    ctx
  );

  await conversacionRepo.updateEstado(conversacion.id, ESTADOS.CERRADA);
  const { rows } = await conversacionRepo.createEsperando(
    conversacion.usuario_id, conversacion.empresa_id, dept
  );
  const nuevaConvId = rows[0].id;
  
  const { aplicarRoundRobin } = require('../../services/asignacion.service');
  // io no está disponible aquí directamente pero la asignación en bd funciona
  await aplicarRoundRobin(nuevaConvId, conversacion.empresa_id, dept, null);
  
  await mensajeRepo.create(nuevaConvId, 'sistema_info', `CLIENTE EN ESPERA — ${dept}`);
  await mensajeRepo.create(nuevaConvId, 'bot', texto);

  return {
    respuesta:   null,
    teclado:     null,
    nextEdge:    null,
    waitInput:   false,
    earlyReturn: { texto, conversacion_id: nuevaConvId, departamento: dept },
  };
}

/**
 * Nodo API_REQUEST — hace un fetch externo con los datos del nodo.
 * Guarda la respuesta en ctx.api_response.
 */
async function handleApiRequest(nodo, ctx) {
  try {
    const url    = interpolar(nodo.datos.url || '', ctx);
    const metodo = nodo.datos.metodo || 'GET';
    const opts   = { method: metodo, headers: { 'Content-Type': 'application/json' } };

    if (['POST', 'PUT'].includes(metodo) && nodo.datos.body) {
      opts.body = interpolar(nodo.datos.body, ctx);
    }

    const res  = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    ctx.api_response = data;
    ctx.api_status   = res.status;

    logger.info(`[FLOW ENGINE] API request → ${url} → ${res.status}`);
  } catch (err) {
    logger.warn(`[FLOW ENGINE] API request failed: ${err.message}`);
    ctx.api_error = err.message;
  }

  return { respuesta: null, teclado: null, nextEdge: 'out', waitInput: false };
}

/**
 * Nodo ETIQUETAR / DESETIQUETAR — sin implementación CRM aún, avanza silenciosamente.
 */
async function handleEtiqueta(nodo, ctx) {
  logger.info(`[FLOW ENGINE] Etiqueta: ${nodo.tipo} → ${nodo.datos.etiqueta}`);
  return { respuesta: null, teclado: null, nextEdge: 'out', waitInput: false };
}

/**
 * Nodo CERRAR_CONVERSACION / FIN — marca la conversación como cerrada.
 */
async function handleFin(nodo, ctx, conversacion) {
  const texto = interpolar(nodo.datos.texto || nodo.datos.descripcion || '', ctx);
  await conversacionRepo.updateEstado(conversacion.id, ESTADOS.CERRADA);
  return {
    respuesta: texto || null,
    teclado:   null,
    nextEdge:  null,
    waitInput: false,
  };
}

/**
 * Nodo NOTIFICACION_CHAT — agrega un mensaje sistema_info en la conversación.
 */
async function handleNotificacionChat(nodo, ctx, conversacion) {
  const texto = interpolar(nodo.datos.texto || nodo.datos.label || '', ctx);
  if (texto) await mensajeRepo.create(conversacion.id, 'sistema_info', texto);
  return { respuesta: null, teclado: null, nextEdge: 'out', waitInput: false };
}

/* ── Mapa de handlers ───────────────────────────────────────────────────── */
const HANDLERS = {
  mensaje:             handleMensaje,
  lista_opciones:      handleListaOpciones,
  condicion:           handleCondicion,
  intencion:           handleIntencion,
  esperar:             handleEsperar,
  esperar_mensaje:     handleEsperarMensaje,
  asignar_equipo:      handleAsignarEquipo,
  accion:              handleAsignarEquipo,   // compatibilidad con nodos "accion" legacy
  api_request:         handleApiRequest,
  etiquetar:           handleEtiqueta,
  desetiquetar:        handleEtiqueta,
  mover_etapa:         async (n, c) => ({ respuesta: null, teclado: null, nextEdge: 'out', waitInput: false }),
  notificacion_chat:   handleNotificacionChat,
  eliminar_contacto:   async (n, c) => ({ respuesta: null, teclado: null, nextEdge: 'out', waitInput: false }),
  cerrar_conversacion: handleFin,
  validar_banxico:     async (n, c) => ({ respuesta: null, teclado: null, nextEdge: 'out', waitInput: false }),
  fin:                 handleFin,
  enrutador_inicial:   async (n, ctx, msg, modoEspera, conv, usuario) => {
    // Replica la lógica de abierta.state.js para enrutar silenciosamente al nodo correcto
    const { rows: cerradas } = await conversacionRepo.findCerradasByUsuario(conv.usuario_id, conv.empresa_id);
    const esRecurrente = cerradas.length > 0;
    
    if (esRecurrente) {
      const wisp = require('../../services/wisp.service');
      const wispGuardado = usuario?.wisp_data?.empresa_id === conv.empresa_id ? usuario.wisp_data : null;
      const clienteWisp = wispGuardado || wisp.buscarPorExternalId(usuario?.external_id, conv.empresa_id);
      
      if (clienteWisp) {
        const yaIdentificado = !!wispGuardado;
        // Tenemos que actualizar el contexto (ctx) que usará el resto de nodos
        ctx.cliente = clienteWisp;
        ctx.identificado_via_wisp = yaIdentificado;
        ctx.servicio_idx = 0;
        
        const { ConversacionMeta } = require('../conversacion.meta');
        const metaObj = new ConversacionMeta(ctx);
        ctx.esMultiServicio = metaObj.esMultiServicio;
        
        // Guardar metadata en BD ahora mismo para que otros handlers la tengan
        await conversacionRepo.updateMetadata(conv.id, metaObj.toJSON());
        
        if (ctx.esMultiServicio) return { respuesta: null, teclado: null, nextEdge: 'multiservicio', waitInput: false };
        return { respuesta: null, teclado: null, nextEdge: 'autoservicio', waitInput: false };
      }
      return { respuesta: null, teclado: null, nextEdge: 'recurrente', waitInput: false };
    }
    return { respuesta: null, teclado: null, nextEdge: 'nuevo', waitInput: false };
  },
};

/**
 * Ejecuta el handler correspondiente al tipo de nodo.
 *
 * @param {object} nodo           — Nodo del flujo { id, tipo, datos }
 * @param {object} ctx            — Contexto de la conversación (metadata del cliente, etc.)
 * @param {string} mensajeCliente — Texto enviado por el cliente en este turno
 * @param {boolean} modoEspera    — true si el flujo ya estaba esperando respuesta en este nodo
 * @param {object} conversacion   — Objeto completo de la conversación de BD
 */
async function ejecutarNodo(nodo, ctx, mensajeCliente, modoEspera, conversacion, usuario) {
  const handler = HANDLERS[nodo.tipo];
  if (!handler) {
    logger.warn(`[NODE HANDLERS] Tipo de nodo desconocido: "${nodo.tipo}" — avanzando.`);
    return { respuesta: null, teclado: null, nextEdge: 'out', waitInput: false };
  }
  return handler(nodo, ctx, mensajeCliente, modoEspera, conversacion, usuario);
}

module.exports = { ejecutarNodo, buildKeyboardFromOpciones };
