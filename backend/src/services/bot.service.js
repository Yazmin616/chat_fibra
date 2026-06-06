/**
 * @file bot.service.js
 * @description Punto de entrada del chatbot: orquesta upserts de usuario/conversación,
 * persistencia de mensajes y despacha al handler del estado actual.
 *
 * Flujo de estados de una conversación:
 *   abierta / inicio
 *     └→ SELECCION_EMPRESA  (si el bot no tiene empresa preconfigurada)
 *         └→ SELECCION_AREA
 *     └→ SELECCION_AREA     (si el bot ya sabe la empresa — multi-bot)
 *         └→ ESPERANDO_AGENTE (nueva conversación)
 *             └→ atendiendo  (agente responde)
 *                 └→ ENCUESTA_AGENTE / ENCUESTA_BOT
 *                     └→ cerrada
 *
 * No hace I/O HTTP; recibe `input` de cualquier adaptador y devuelve
 * { texto, conversacion_id } o null si un humano ya atiende el chat.
 */

const db               = require('../config/db');
const usuarioRepo      = require('../repositories/usuario.repository');
const conversacionRepo = require('../repositories/conversacion.repository');
const mensajeRepo      = require('../repositories/mensaje.repository');
const logger           = require('../config/logger');
const { sanitize }     = require('../utils/logSanitizer');
const { getHandler }   = require('../bot/dispatcher');
const { ESTADOS }      = require('../bot/constants');
const { detectarEscenario, formatearHorarios, proximoDiaHabil } = require('../utils/turnosHorarios');

const MSG_DEFAULT_FESTIVO        = '¡Hola! 👋 Hoy es día festivo en {empresa}. El equipo de {area} retoma actividades el {proximo_dia_habil}. Disculpa el inconveniente — escríbenos entonces y te atenderemos con gusto.\n\n🕐 Horarios habituales:\n{horarios_atencion}';
const MSG_DEFAULT_FUERA_HORARIO  = '¡Hola! 👋 Gracias por contactar a {empresa}. En este momento el equipo de {area} no está disponible.\n\n🕐 Horarios de atención:\n{horarios_atencion}\n\nTu mensaje quedó registrado y te responderemos en cuanto retomemos actividades. ¡Hasta pronto!';

// ── Rate limiting por usuario ────────────────────────────────────────────────
// Evita que un cliente genere miles de registros enviando mensajes en ráfaga.
// La ventana es pequeña (500 ms): suficiente para filtrar floods automatizados
// sin afectar a usuarios reales que tardan al menos 1-2 s entre mensajes.
const COOLDOWN_MS  = 500;
const _ultimoProceso = new Map();

// Limpiar el Map cada hora para evitar memory leak en sesiones de larga duración.
setInterval(() => _ultimoProceso.clear(), 60 * 60 * 1000).unref();

function _estaEnCooldown(userId) {
  const ahora = Date.now();
  const ultimo = _ultimoProceso.get(userId);
  if (ultimo && (ahora - ultimo) < COOLDOWN_MS) return true;
  _ultimoProceso.set(userId, ahora);
  return false;
}

/**
 * Procesa un mensaje entrante y devuelve la respuesta del bot.
 *
 * @param {object}      input
 * @param {string}      input.canal                 - Canal de origen, ej. "telegram".
 * @param {string}      input.user_id               - ID externo del usuario en el canal.
 * @param {string}      input.nombre                - Nombre del usuario.
 * @param {string}      input.username              - Alias del usuario.
 * @param {string}      input.empresa_id            - Empresa asociada al bot que recibió el mensaje.
 * @param {string}      input.mensaje               - Texto del mensaje.
 * @param {string}      [input.tipo='text']         - "text", "sticker", "photo" o "location".
 * @param {string|null} [input.url_media]           - URL del archivo (sticker/foto) o enlace de Maps (location).
 * @param {boolean}     [input.empresa_preconfigurada=false] - true si la empresa viene del bot,
 *                                                   false si el cliente aún debe elegirla en el menú.
 * @param {import('socket.io').Server} [io]
 * @returns {Promise<{ texto: string|null, conversacion_id: number } | null>}
 *   null  → el chat ya tiene un humano asignado; el bot no interviene.
 */
async function procesar(input, io) {
  // Descartar mensajes en ráfaga del mismo usuario (flood protection)
  if (_estaEnCooldown(input.user_id)) return null;

  const usuario     = await _upsertUsuario(input);
  const conversacion = await _upsertConversacion(usuario.id, input.empresa_id || 'fibratec');

  // Guardar en BD y capturar el ID para incluirlo en el evento de socket (dedup en frontend)
  const textoParaDB = input.mensaje_display || input.mensaje;
  const { rows: [msgRow] } = await mensajeRepo.create(conversacion.id, 'user', textoParaDB, input.tipo || 'text', input.url_media, input.telegram_msg_id || null);
  const mensaje_id = msgRow?.id ?? null;

  // Guardar wamid del mensaje entrante (para read receipts). Sin await — no debe bloquear
  // ni silenciar el flujo principal si la columna aún no existe (migración pendiente).
  if (input.wamid_entrante && mensaje_id) {
    db.query('UPDATE mensajes SET wamid=$1 WHERE id=$2', [input.wamid_entrante, mensaje_id])
      .catch(err => logger.warn('[BOT SERVICE] No se pudo guardar wamid_entrante:', err.message));
  }

  // Reiniciar timers de inactividad y SLA del agente.
  // Se actualiza en cada mensaje del usuario, independientemente del estado,
  // para que cuando la conversación llegue a 'atendiendo' el anchor sea correcto.
  // aviso_inactividad_enviado se resetea a 0 para reiniciar la escalada del cliente.
  // sla_pendiente_desde se fija en NOW() para iniciar el reloj SLA del agente.
  db.query(
    `UPDATE conversaciones
     SET ultimo_mensaje_cliente    = NOW(),
         aviso_inactividad_enviado = 0,
         sla_pendiente_desde       = NOW()
     WHERE id=$1`,
    [conversacion.id]
  ).catch(err => logger.warn('[BOT SERVICE] No se pudo actualizar timers de actividad:', err.message));

  // Agente humano atiende: el bot no responde, pero devolvemos contexto para el emit de socket
  if (conversacion.es_humano) return { mensaje_id, conversacion, conversacion_id: conversacion.id };

  // ── Detección de escenario A/B/C ────────────────────────────────────────────
  // Solo cuando el cliente está esperando un agente humano (ESPERANDO_AGENTE).
  // Las consultas al bot (menú, FAQ, etc.) se procesan 24/7 sin restricción.
  // Si se detecta A/B, la conversación se cierra aquí y no continúa al state machine.
  if (conversacion.estado === ESTADOS.ESPERANDO_AGENTE && conversacion.departamento) {
    const fueraDeHorario = await _checkEscenarioHorario(conversacion, input, io);
    if (fueraDeHorario) return { mensaje_id, conversacion, conversacion_id: conversacion.id };
  }

  const resultado = await _maquinaEstados(
    input.mensaje,
    conversacion,
    usuario,
    io,
    input.empresa_preconfigurada || false
  );
  return resultado
    ? { ...resultado, mensaje_id, conversacion }
    : { mensaje_id, conversacion, conversacion_id: conversacion.id };
}

// ---------------------------------------------------------------------------
// Helpers privados
// ---------------------------------------------------------------------------

/**
 * Devuelve true si el nombre es un identificador técnico crudo (PSID, teléfono sin formato, etc.)
 * y por tanto no debería sobreescribir un nombre real ya guardado.
 * @private
 */
function _esNombreCrudo(nombre) {
  if (!nombre) return true;
  // PSID/IGSID: string de ≥ 10 dígitos
  if (/^\d{10,}$/.test(String(nombre))) return true;
  return false;
}

/**
 * Busca el usuario por canal+external_id; lo crea si no existe, actualiza si ya existe.
 * Preserva el nombre guardado en DB si ya es un nombre real (WISP, Graph API, etc.)
 * para evitar que nombres buenos sean sobreescritos por PSIDs o teléfonos crudos.
 * @private
 */
async function _upsertUsuario({ canal, user_id, nombre, username }) {
  const { rows } = await usuarioRepo.findByCanal(canal, user_id);
  if (rows.length > 0) {
    const stored = rows[0];
    // Si el nombre guardado ya es real, preservarlo. Solo actualizar si era un ID crudo.
    const nombreFinal = !_esNombreCrudo(stored.nombre) ? stored.nombre : nombre;
    await usuarioRepo.update(stored.id, nombreFinal, username || stored.username, null);
    return stored;
  }
  return (await usuarioRepo.create(canal, user_id, nombre, username, null)).rows[0];
}

/**
 * Busca la conversación activa del usuario; crea una nueva en "abierta" si no hay ninguna.
 * Si el usuario tiene historial previo (conversaciones cerradas), inserta un mensaje
 * sistema_info para que el agente sepa que es un cliente recurrente.
 * @private
 */
async function _upsertConversacion(usuario_id, empresa_id) {
  const { rows } = await conversacionRepo.findActiveByUsuario(usuario_id, empresa_id);
  if (rows.length > 0) return rows[0];

  const nuevaConv = (await conversacionRepo.create(usuario_id, empresa_id)).rows[0];

  const { rows: cerradas } = await conversacionRepo.findCerradasByUsuario(usuario_id, empresa_id);
  if (cerradas.length > 0) {
    const { rows: cnt } = await db.query(
      "SELECT COUNT(*) AS total FROM conversaciones WHERE usuario_id=$1 AND empresa_id=$2 AND estado='cerrada'",
      [usuario_id, empresa_id]
    );
    const total = parseInt(cnt[0]?.total || '1');
    const nota = `📋 Cliente recurrente — ${total} conversación${total > 1 ? 'es previas' : ' previa'} en el historial.`;
    await mensajeRepo.create(nuevaConv.id, 'sistema_info', nota);
  }

  return nuevaConv;
}

/**
 * Despacha el mensaje al handler del estado actual y actualiza la DB.
 * @private
 */
async function _maquinaEstados(mensaje, conversacion, usuario, io, empresaPreconfigurada) {
  try {
    const handler = getHandler(conversacion.estado);
    if (!handler) {
      logger.warn(`[BOT SERVICE] Estado desconocido: "${conversacion.estado}" — ignorando.`);
      return { texto: null, conversacion_id: conversacion.id };
    }

    const resultado = await handler.handle(mensaje, conversacion, usuario, io, empresaPreconfigurada);

    // SELECCION_AREA hace early return porque la conversación activa cambia de ID
    if (resultado.earlyReturn) return resultado.resultado;

    const { respuesta, nuevoEstado, teclado } = resultado;
    await conversacionRepo.updateEstado(conversacion.id, nuevoEstado);
    if (respuesta) await mensajeRepo.create(conversacion.id, 'bot', respuesta);
    return { texto: respuesta, conversacion_id: conversacion.id, teclado: teclado || null };

  } catch (err) {
    logger.error('[BOT SERVICE] Error en máquina de estados:', {
      estado:          conversacion.estado,
      conversacion_id: conversacion.id,
      error:           err.message,
    });
    const fallback = "Lo sentimos, hubo un error. Escriba 'hola' para reiniciar.";
    await conversacionRepo.updateEstado(conversacion.id, ESTADOS.INICIO);
    await mensajeRepo.create(conversacion.id, 'bot', fallback);
    return { texto: fallback, conversacion_id: conversacion.id };
  }
}

// ── Detección de escenario y aviso de horario ────────────────────────────────

/**
 * Comprueba si hay turno activo para el área de la conversación en ESPERANDO_AGENTE.
 * Si el escenario es A o B:
 *   1. Envía el mensaje de fuera de horario / festivo al cliente.
 *   2. Cierra la conversación (CERRADA) para que el próximo mensaje inicie una sesión nueva.
 *
 * Retorna true si se detectó A/B (el llamador puede decidir saltarse la máquina de estados).
 *
 * Nota: con el fix en seleccionArea.state.js, las conversaciones ESPERANDO_AGENTE
 * nunca deberían crearse fuera de horario. Esta función actúa como red de seguridad.
 */
async function _checkEscenarioHorario(conversacion, input, io) {
  try {
    const empresaId = input.empresa_id || 'fibratec';
    const { rows: cfgRows } = await db.query(
      'SELECT clave, valor FROM configuraciones WHERE empresa_id=$1',
      [empresaId]
    );
    const configMap = {};
    cfgRows.forEach(r => { configMap[r.clave] = r.valor; });

    const { escenario, turnos } = await detectarEscenario(
      db, new Date(), empresaId, conversacion.departamento, configMap
    );
    if (escenario === 'C') return false; // turno activo → flujo normal

    // Construir texto del mensaje
    const horarios = formatearHorarios(turnos);
    const proximo  = await proximoDiaHabil(db, empresaId, conversacion.departamento, configMap);
    const plantilla = escenario === 'A'
      ? (configMap.msg_festivo || MSG_DEFAULT_FESTIVO)
      : (configMap.msg_fuera_horario || MSG_DEFAULT_FUERA_HORARIO);

    const texto = plantilla
      .replace(/\{horarios_atencion\}/g, horarios)
      .replace(/\{proximo_dia_habil\}/g, proximo)
      .replace(/\{area\}/g,    conversacion.departamento || '')
      .replace(/\{empresa\}/g, empresaId);

    // Lazy require para romper la dependencia circular adapters ↔ bot.service
    const { enviarMensaje } = require('../adapters');
    await enviarMensaje(input.canal || 'telegram', input.user_id, texto, empresaId);
    await mensajeRepo.create(conversacion.id, 'bot', texto);

    // Cerrar la conversación: próximo mensaje del cliente = sesión nueva
    await db.query(
      "UPDATE conversaciones SET estado='cerrada', updated_at=NOW() WHERE id=$1",
      [conversacion.id]
    );

    // Notificar al CRM para que retire la conv de la cola de espera
    if (io) {
      const { emitToConv } = require('../utils/rooms');
      emitToConv(io, conversacion.departamento, 'conversacion_actualizada', {
        id:        conversacion.id,
        empresa_id: empresaId,
        estado:    'cerrada',
        es_humano: false,
      });
    }

    logger.info(
      `[ESCENARIO ${escenario}] Fuera de horario — Conv ${conversacion.id} cerrada — ${conversacion.departamento}`
    );
    return true;
  } catch (err) {
    // No bloqueante: un error aquí no debe interrumpir el flujo del bot
    logger.warn('[BOT SERVICE] Error en _checkEscenarioHorario:', err.message);
    return false;
  }
}

module.exports = { procesar };
