const db                = require('../config/db');
const conversacionRepo  = require('../repositories/conversacion.repository');
const mensajeRepo       = require('../repositories/mensaje.repository');
const agenteRepo        = require('../repositories/agente.repository');
const infraccionRepo    = require('../repositories/infraccion.repository');
const calificacionRepo  = require('../repositories/calificacion.repository');
const { enviarMensaje } = require('../adapters');
const { emitToConv }   = require('../utils/rooms');
const logger           = require('../config/logger');
const { ESTADOS }      = require('../bot/constants');
const { horasRealesDesde } = require('../utils/businessHours');
const {
  cargarTurnos,
  esTurnoActivo,
  esFestivo,
  minutosLaboralesTurnos,
  TZ_DEFAULT,
} = require('../utils/turnosHorarios');
const { interpolarVars } = require('../utils/vars');

/** Minutos sin heartbeat para considerar a un agente como inactivo. */
const INACTIVIDAD_AGENTE_MIN = 15;

/** Minutos en estado ENCUESTA sin respuesta antes de cerrar como "no evaluada". */
const TIMEOUT_ENCUESTA_MIN = 20;

/**
 * Horas reales que deben transcurrir desde que un cliente abre una conversación
 * ESPERANDO_AGENTE para que se genere infracción y se cierre el chat.
 * Equivale a la ventana gratuita de Meta (24 h desde el primer mensaje).
 */
const VENTANA_META_HORAS = 24;

// La constante ESPERA_INFRACCION_MIN fue reemplazada por la clave de configuración
// `sla_agente_nivel1_min` (default 30), que ahora controla el SLA del agente
// con cálculo de minutos laborales reales (pausado fuera de jornada).

// ── Textos por defecto (se sobreescriben con los valores de `configuraciones`) ─
const MSG_DEFAULTS = {
  aviso1: '¿Sigues ahí? 👋 Seguimos disponibles para ayudarte cuando quieras.',
  aviso2: 'Hola, si no continúas la conversación la cerraremos pronto. ¡Escríbenos cuando quieras! 😊',
  cierre: '¿Cómo calificarías la atención de {nombre_agente} hoy? 🌟\n\n1️⃣  Mala\n2️⃣  Regular\n3️⃣  Buena\n\nEscribe el número de tu calificación.',
};

/**
 * Sustituye las variables de plantilla por los valores reales de la conversación.
 */
function _sustituirVariables(plantilla, conv) {
  return interpolarVars(plantilla, {
    nombre_cliente: conv.cliente_nombre || '',
    area:           conv.departamento   || '',
    empresa:        conv.empresa_id     || '',
    nombre_agente:  conv.agente_nombre  || '',
  });
}

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
               c.estado, c.agente_id, c.created_at, c.updated_at,
               c.ultimo_mensaje_cliente, c.aviso_inactividad_enviado,
               c.sla_pendiente_desde,
               u.external_id, u.canal, u.nombre AS cliente_nombre,
               a.nombre AS agente_nombre
        FROM conversaciones c
        JOIN  usuarios u ON c.usuario_id=u.id
        LEFT JOIN agentes a ON c.agente_id=a.id
        WHERE c.estado != 'cerrada' AND c.estado NOT LIKE 'ENCUESTA%'
      `);

      for (const conv of rows) {
        // ── Configuración de la empresa ──────────────────────────────────────
        const configRes = await db.query(
          'SELECT clave, valor FROM configuraciones WHERE empresa_id=$1',
          [conv.empresa_id || 'fibratec']
        );
        const configMap = {};
        configRes.rows.forEach(r => { configMap[r.clave] = r.valor; });

        const ahora   = new Date();
        // Turnos del área de esta conversación (fallback → globales → jornada global)
        const turnos  = await cargarTurnos(db, conv.empresa_id || 'fibratec', conv.departamento, configMap);

        // ── ESPERANDO_AGENTE ─────────────────────────────────────────────────
        //
        //   A) Infracción al área: nadie tomó el chat en `sla_area_min` minutos.
        //      Usa tiempo real (no laboral) — si el cliente escribe a las 10am y
        //      nadie responde en 15 min, eso es una infracción independientemente
        //      del horario.  La deduplicación en _evaluarInfraccion garantiza que
        //      solo se registra una por conversación.
        //
        //   B) Cierre automático a las 24 h reales (ventana Meta de WhatsApp).
        //      Es independiente de la infracción — la conversación se cierra aunque
        //      la infracción ya haya sido registrada antes.
        //
        if (conv.estado === ESTADOS.ESPERANDO_AGENTE) {
          const horasTranscurridas = horasRealesDesde(conv.created_at);

          // A) Infracción al área — usa minutos LABORALES para no penalizar fuera de jornada.
          //    Si el cliente escribió a las 10pm y nadie respondió, el reloj solo corre
          //    desde las 9am del día siguiente.
          const slaAreaMin = parseInt(configMap.sla_area_min || '15');
          if (slaAreaMin > 0) {
            // Sin sanciones en día festivo
            const tz      = configMap.tz || TZ_DEFAULT;
            const festivo = await esFestivo(db, ahora, conv.empresa_id || 'fibratec', conv.departamento, tz);
            if (!festivo) {
              const minLabArea = minutosLaboralesTurnos(conv.created_at, ahora, turnos, tz);
              if (minLabArea >= slaAreaMin) {
                await _evaluarInfraccion(conv, Math.round(minLabArea), io);
              }
            }
          }

          // B) Cierre a las 24 h reales (ventana Meta — independiente del horario)
          if (horasTranscurridas >= VENTANA_META_HORAS) {
            await _cerrarHumano(conv, io);
            continue;
          }

          continue;
        }

        // ── ATENDIENDO + HUMANO: lógica escalonada de inactividad ────────────
        //
        // Separamos la lógica en dos preguntas independientes:
        //
        //   A) SLA del AGENTE: ¿cuántos minutos laborales lleva sin responder al cliente?
        //      → Infracción si supera `sla_agente_nivel1_min` (default 30).
        //      Ancora: sla_pendiente_desde (fijado cuando el CLIENTE escribe,
        //              borrado cuando el AGENTE responde o al disparar la infracción).
        //      El cálculo usa minutosLaboralesElapsados — el reloj se pausa fuera de jornada.
        //
        //   B) Inactividad del CLIENTE: escalada escalonada.
        //      → Recordatorio / aviso / cierre automático.
        //      Ancora: ultimo_mensaje_cliente (24/7, dentro de la ventana Meta de 24 h).
        //
        if (conv.estado === ESTADOS.ATENDIENDO && conv.es_humano) {

          // A) SLA del agente (reloj laboral — pausa fuera de turno y en festivos)
          if (conv.sla_pendiente_desde) {
            const slaMin = parseInt(configMap.sla_agente_nivel1_min || '30');
            if (slaMin > 0) {
              const tz2     = configMap.tz || TZ_DEFAULT;
              const festivo = await esFestivo(db, ahora, conv.empresa_id || 'fibratec', conv.departamento, tz2);
              if (!festivo) {
                const minLab = minutosLaboralesTurnos(conv.sla_pendiente_desde, ahora, turnos, tz2);
                if (minLab >= slaMin) {
                  await _evaluarInfraccionSLA(conv, Math.round(minLab), io);
                }
              }
            }
          }

          // B) Escalada por inactividad del cliente (aplica 24/7 dentro de ventana Meta)
          const closed = await _procesarInactividadCliente(conv, configMap, io);

          if (closed) continue;

          continue; // ya procesado — no caer en el bloque de sesiones bot
        }

        // ── Sesiones fuera de turno (bot o humano no-atendiendo): no actuar ─────
        const tz3     = configMap.tz || TZ_DEFAULT;
        const festivo = await esFestivo(db, ahora, conv.empresa_id || 'fibratec', conv.departamento, tz3);
        if (festivo || !esTurnoActivo(ahora, turnos, tz3)) continue;

        // ── Sesiones puras de bot: cierre por tiempo_inactividad ─────────────
        const minutosBot = parseInt(configMap.tiempo_inactividad || '10');
        const { rows: inactivaBot } = await db.query(
          `SELECT 1 FROM conversaciones
           WHERE id=$1 AND updated_at < NOW()-($2||' minutes')::interval`,
          [conv.id, minutosBot]
        );
        if (inactivaBot.length === 0) continue;

        await db.query(
          'UPDATE conversaciones SET estado=$1, updated_at=NOW() WHERE id=$2',
          [ESTADOS.CERRADA, conv.id]
        );
        if (io) {
          emitToConv(io, conv.departamento, 'conversacion_actualizada', {
            id: conv.id, empresa_id: conv.empresa_id, estado: ESTADOS.CERRADA, es_humano: false,
          });
        }
      }

      // ── Encuestas sin responder: cerrar como "no evaluada" ────────────────
      const { rows: encuestasVencidas } = await db.query(`
        SELECT c.id, c.usuario_id, c.empresa_id, c.departamento, c.estado,
               u.external_id, u.canal, u.nombre AS cliente_nombre
        FROM conversaciones c
        JOIN usuarios u ON c.usuario_id = u.id
        WHERE c.estado IN ('ENCUESTA_AGENTE', 'ENCUESTA_BOT')
          AND c.updated_at < NOW() - ($1 || ' minutes')::interval
      `, [TIMEOUT_ENCUESTA_MIN]);

      for (const conv of encuestasVencidas) {
        try {
          const tipo = conv.estado === ESTADOS.ENCUESTA_AGENTE ? 'agente' : 'bot';

          const despedida = '¡Gracias por comunicarte con nosotros! 😊 Esperamos haber podido ayudarte. Estaremos atentos a cualquier consulta futura. ¡Hasta pronto! 👋';
          await enviarMensaje(conv.canal || 'telegram', conv.external_id, despedida, conv.empresa_id);
          await mensajeRepo.create(conv.id, 'bot', despedida);

          await calificacionRepo.create(conv.id, 'NoRespondida', '', tipo);
          await db.query(
            'UPDATE conversaciones SET estado=$1, updated_at=NOW() WHERE id=$2',
            [ESTADOS.CERRADA, conv.id]
          );

          const banner = 'Encuesta no respondida — conversación cerrada automáticamente';
          await mensajeRepo.create(conv.id, 'sistema_info', banner);

          logger.info(`[ENCUESTA TIMEOUT] Conv ${conv.id} cerrada sin evaluación (${tipo}) — ${TIMEOUT_ENCUESTA_MIN} min sin respuesta.`);

          if (io) {
            emitToConv(io, conv.departamento, 'nuevo_mensaje', {
              conversacion_id: conv.id,
              usuario_id:      conv.usuario_id,
              empresa_id:      conv.empresa_id,
              mensaje:         despedida,
              remitente:       'bot',
            });
            emitToConv(io, conv.departamento, 'nuevo_mensaje', {
              conversacion_id: conv.id,
              usuario_id:      conv.usuario_id,
              empresa_id:      conv.empresa_id,
              mensaje:         banner,
              remitente:       'sistema_info',
            });
            emitToConv(io, conv.departamento, 'conversacion_actualizada', {
              id:         conv.id,
              empresa_id: conv.empresa_id,
              estado:     ESTADOS.CERRADA,
              es_humano:  false,
            });
          }
        } catch (err) {
          logger.error(`[ENCUESTA TIMEOUT] Error conv ${conv.id}:`, { error: err.message });
        }
      }

    } catch (err) {
      logger.error('Auto-cierre error', { error: err.message });
    }
  }, 60_000);
}

// ────────────────────────────────────────────────────────────────────────────────
// Lógica escalonada de inactividad del CLIENTE
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Evalúa y aplica la escalada de inactividad del cliente en conversaciones
 * que ya están en estado "atendiendo" con un agente humano.
 *
 * PRECONDICIÓN: solo se activa cuando el AGENTE escribió último y espera respuesta
 * del cliente. Si el último mensaje fue del cliente (y el agente no ha respondido),
 * es el SLA del agente quien actúa — este timer NO corre.
 *
 * Escalada configurable (claves en tabla `configuraciones`):
 *   inactividad_aviso1_min  (default 30)  → recordatorio suave
 *   inactividad_aviso2_min  (default 120) → aviso de cierre próximo
 *   inactividad_cierre_min  (default 240) → cierre automático + encuesta
 *
 * Restricción de ventana Meta (WhatsApp): se evita enviar mensajes
 * después de 23 h 30 min desde la creación de la conversación.
 *
 * @returns {Promise<boolean>} true si la conversación fue cerrada.
 */
async function _procesarInactividadCliente(conv, configMap, io) {
  // Verificar quién envió el último mensaje.
  // Si fue el cliente, el agente aún no respondió → no aplica inactividad del cliente.
  const { rows: lastMsg } = await db.query(
    'SELECT remitente FROM mensajes WHERE conversacion_id=$1 ORDER BY id DESC LIMIT 1',
    [conv.id]
  );
  if (lastMsg[0]?.remitente === 'user') return false;

  const aviso1Min  = parseInt(configMap.inactividad_aviso1_min || '30');
  const aviso2Min  = parseInt(configMap.inactividad_aviso2_min || '120');
  const cierreMin  = parseInt(configMap.inactividad_cierre_min || '240');
  const avisoPrevio = parseInt(conv.aviso_inactividad_enviado || '0');

  // Ancora: último mensaje del cliente (fallback a updated_at para convs antiguas)
  const refTime = conv.ultimo_mensaje_cliente || conv.updated_at;
  const minutosInactivo = Math.round((Date.now() - new Date(refTime).getTime()) / 60000);

  // Seguridad ventana Meta: para WhatsApp no enviar mensajes pasadas las 23.5 h
  // desde la creación de la conversación.
  const horasDesdeCreacion = horasRealesDesde(conv.created_at);
  const fueraDe24h = conv.canal === 'whatsapp' && horasDesdeCreacion >= 23.5;

  // ── Cierre automático ──────────────────────────────────────────────────────
  if (minutosInactivo >= cierreMin) {
    if (!fueraDe24h) {
      await _cerrarHumano(conv, io, configMap);
    } else {
      // Fuera de ventana Meta: cierre silencioso sin enviar mensaje al canal
      await db.query(
        `UPDATE conversaciones
         SET estado=$1, es_humano=false, updated_at=NOW(), motivo_cierre=$2
         WHERE id=$3`,
        [ESTADOS.CERRADA, 'inactividad_ventana_meta_expirada', conv.id]
      );
      await mensajeRepo.create(conv.id, 'sistema_info',
        'Conversación cerrada automáticamente (ventana de 24 h de Meta expirada)');
      if (io) {
        emitToConv(io, conv.departamento, 'conversacion_actualizada', {
          id: conv.id, empresa_id: conv.empresa_id,
          estado: ESTADOS.CERRADA, es_humano: false,
        });
      }
    }
    logger.info(
      `[INACTIVIDAD CLIENTE] Conv ${conv.id} cerrada — ${minutosInactivo} min sin respuesta del cliente.`
    );
    return true;
  }

  // ── Avisos escalonados (solo si hay ventana Meta disponible) ──────────────
  if (!fueraDe24h) {
    if (minutosInactivo >= aviso2Min && avisoPrevio < 2) {
      await _enviarAvisoInactividad(conv, 2, minutosInactivo, configMap, io);
    } else if (minutosInactivo >= aviso1Min && avisoPrevio < 1) {
      await _enviarAvisoInactividad(conv, 1, minutosInactivo, configMap, io);
    }
  }

  return false;
}

/**
 * Envía un aviso de inactividad al cliente y actualiza el nivel de aviso en BD.
 * Lee el texto del aviso de configMap (inactividad_msg_aviso1/2) y sustituye variables.
 * @param {object} conv
 * @param {1|2}    nivel
 * @param {number} minutosInactivo
 * @param {object} configMap
 * @param {import('socket.io').Server|null} io
 * @private
 */
async function _enviarAvisoInactividad(conv, nivel, minutosInactivo, configMap, io) {
  const plantilla = configMap[`inactividad_msg_aviso${nivel}`] ||
    (nivel === 1 ? MSG_DEFAULTS.aviso1 : MSG_DEFAULTS.aviso2);
  const texto = _sustituirVariables(plantilla, conv);

  await enviarMensaje(conv.canal || 'telegram', conv.external_id, texto, conv.empresa_id);
  await mensajeRepo.create(conv.id, 'bot', texto);
  await db.query(
    'UPDATE conversaciones SET aviso_inactividad_enviado=$1 WHERE id=$2',
    [nivel, conv.id]
  );

  if (io) {
    emitToConv(io, conv.departamento, 'nuevo_mensaje', {
      conversacion_id: conv.id,
      usuario_id:      conv.usuario_id,
      empresa_id:      conv.empresa_id,
      mensaje:         texto,
      remitente:       'bot',
    });
  }

  logger.info(
    `[INACTIVIDAD CLIENTE] Aviso nivel ${nivel} enviado — Conv ${conv.id} (${minutosInactivo} min sin respuesta).`
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Helpers de cierre e infracción (sin cambios de contrato)
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Cierra un chat humano enviando la encuesta CSAT al cliente y notificando
 * el dashboard vía Socket.IO.
 * @param {object}      conv
 * @param {object|null} configMap - Si se pasa, lee el mensaje de cierre de configMap.
 * @param {import('socket.io').Server|null} io
 * @private
 */
async function _cerrarHumano(conv, io, configMap = null) {
  const bannerMsg = 'Conversación cerrada automáticamente por inactividad del cliente';
  const plantilla = configMap?.inactividad_msg_cierre || MSG_DEFAULTS.cierre;
  const surveyText = _sustituirVariables(plantilla, conv);

  await db.query(
    `UPDATE conversaciones
     SET estado=$1, es_humano=false,
         tipo_cierre='automatico', comentario_cierre=$2, cerrado_en=NOW(), updated_at=NOW()
     WHERE id=$3`,
    [ESTADOS.ENCUESTA_AGENTE, 'Cerrado automáticamente por inactividad del cliente', conv.id]
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
      id: conv.id, empresa_id: conv.empresa_id, estado: ESTADOS.ENCUESTA_AGENTE, es_humano: false,
    });
  }
}

/**
 * Evalúa infracción para conversaciones en ESPERANDO_AGENTE (tipo 'area').
 * Una conversación puede generar como máximo una infracción de área.
 * @private
 */
async function _evaluarInfraccion(conv, tiempoEspera, io) {
  try {
    if (conv.estado !== ESTADOS.ESPERANDO_AGENTE) return;

    const yaExiste = await infraccionRepo.existsByConversacion(conv.id, 'area');
    if (yaExiste) return;

    const { rows: [inf] } = await infraccionRepo.create(
      conv.id, conv.empresa_id, conv.departamento,
      conv.cliente_nombre, tiempoEspera, 'area', null, null
    );
    logger.warn(`[INFRACCIÓN ÁREA] Conv ${conv.id} — ${conv.departamento} — ${tiempoEspera} min sin tomar.`);
    _emitirInfraccion(io, conv, inf, tiempoEspera, 'area', null, null);
  } catch (err) {
    logger.error('[INFRACCIÓN ÁREA] Error al evaluar:', { error: err.message });
  }
}

/**
 * Registra una infracción de SLA del agente (tipo 'agente').
 *
 * Se llama cuando los minutos laborales transcurridos desde sla_pendiente_desde
 * superan el umbral configurado (sla_agente_nivel1_min).
 * Borra sla_pendiente_desde al disparar — el reloj se reinicia cuando el cliente
 * vuelva a escribir (bot.service.js lo fija de nuevo en NOW()).
 * @private
 */
async function _evaluarInfraccionSLA(conv, minLaborales, io) {
  try {
    const { rows: [inf] } = await infraccionRepo.create(
      conv.id, conv.empresa_id, conv.departamento,
      conv.cliente_nombre, minLaborales, 'agente', conv.agente_id, conv.agente_nombre
    );
    // Borrar el marcador — este período ya fue resuelto (con infracción)
    await db.query('UPDATE conversaciones SET sla_pendiente_desde=NULL WHERE id=$1', [conv.id]);
    logger.warn(
      `[INFRACCIÓN SLA] Conv ${conv.id} — ${conv.agente_nombre} — ${minLaborales} min laborales sin responder.`
    );
    _emitirInfraccion(io, conv, inf, minLaborales, 'agente', conv.agente_id, conv.agente_nombre);
  } catch (err) {
    logger.error('[INFRACCIÓN SLA] Error al registrar:', { error: err.message });
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
