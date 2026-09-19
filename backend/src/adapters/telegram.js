/**
 * @file telegram.js
 * @description Adaptador de Telegram: gestiona uno o más bots de Telegraf,
 * uno por empresa configurada en .env.
 *
 * Responsabilidades:
 *   - Arrancar un bot por empresa (TELEGRAM_BOT_TOKEN_FIBRATEC, TELEGRAM_BOT_TOKEN_COMPUSEMMM).
 *   - Escuchar mensajes entrantes (texto y stickers) y delegar a bot.service.js.
 *   - Notificar al dashboard CRM en tiempo real antes de procesar.
 *   - Reintentar la conexión con backoff exponencial si el bot falla al iniciar.
 *   - Exponer enviarMensajeTelegram(external_id, texto, empresa_id) para respuestas proactivas.
 *
 * Multi-empresa:
 *   Cada bot sabe su empresa_id y lo pasa al servicio. El cliente que escribe
 *   al bot de Fibratec no necesita elegir empresa — ya está pre-configurada.
 *   Si una empresa no tiene token configurado, su bot se omite con un warning.
 */

const { Telegraf }     = require('telegraf');
const crypto           = require('crypto');
const botService       = require('../services/bot.service');
const mensajeRepo      = require('../repositories/mensaje.repository');
const usuarioRepo      = require('../repositories/usuario.repository');
const conversacionRepo = require('../repositories/conversacion.repository');
const logger           = require('../config/logger');
const { emitToConv }   = require('../utils/rooms');

/** empresa_id → instancia de Telegraf */
const bots = new Map();

/** Empresas soportadas y su variable de entorno correspondiente. */
const COMPANIES = [
  { empresa_id: 'fibratec',   envKey: 'TELEGRAM_BOT_TOKEN_FIBRATEC'   },
  { empresa_id: 'compusemmm', envKey: 'TELEGRAM_BOT_TOKEN_COMPUSEMMM' },
];

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Arranca un bot de Telegraf por cada empresa que tenga token configurado.
 * Debe llamarse una sola vez al iniciar el servidor.
 *
 * Modo webhook (recomendado en producción):
 *   Definir TELEGRAM_WEBHOOK_URL en .env con la URL pública HTTPS del servidor.
 *   El bot registra su webhook en Telegram y recibe updates vía POST.
 *   Requiere que el servidor esté detrás de HTTPS (ngrok, dominio propio con SSL).
 *
 * Modo polling (desarrollo sin HTTPS):
 *   Dejar TELEGRAM_WEBHOOK_URL vacío. El bot consulta a Telegram periódicamente.
 *
 * @param {import('socket.io').Server}     io  - Socket.io para notificar al dashboard.
 * @param {import('express').Application}  app - App Express (necesaria en modo webhook).
 */
function iniciarTelegram(io, app = null) {
  let iniciados = 0;
  const webhookBase = process.env.TELEGRAM_WEBHOOK_URL || '';

  for (const { empresa_id, envKey } of COMPANIES) {
    const token = process.env[envKey];
    if (!token) {
      logger.warn(`[TELEGRAM] ${envKey} no configurado — bot de "${empresa_id}" omitido.`);
      continue;
    }

    if (webhookBase && app) {
      _iniciarBotWebhook(empresa_id, token, io, app, webhookBase).catch(err =>
        logger.error(`[TELEGRAM] Error iniciando webhook para "${empresa_id}":`, { error: err.message })
      );
    } else {
      if (webhookBase && !app) {
        logger.warn(`[TELEGRAM] TELEGRAM_WEBHOOK_URL definida pero "app" no fue pasada a iniciarTelegram — usando polling como fallback.`);
      }
      _iniciarBot(empresa_id, token, io, 0);
    }
    iniciados++;
  }

  if (iniciados === 0) {
    logger.error('[TELEGRAM] Ningún bot configurado. Agregue TELEGRAM_BOT_TOKEN_FIBRATEC y/o TELEGRAM_BOT_TOKEN_COMPUSEMMM en .env');
  }
}

/**
 * Envía un mensaje de texto a un usuario de Telegram de forma proactiva.
 * Usado por chat.service.js (respuestas de agente) y autoClose.service.js (encuestas).
 *
 * @param {string} external_id - Telegram User ID del destinatario.
 * @param {string} texto       - Texto a enviar.
 * @param {string} empresa_id  - Empresa del bot a través del cual enviar el mensaje.
 * @returns {Promise<void>}
 */
/**
 * Envía un mensaje de texto a un usuario de Telegram.
 * @returns {Promise<boolean>} true si el mensaje fue entregado, false si falló.
 */
async function enviarMensajeTelegram(external_id, texto, empresa_id, teclado = null) {
  const bot = bots.get(empresa_id);
  if (!bot) {
    logger.warn(`[TELEGRAM SEND] No hay bot activo para "${empresa_id}" — mensaje no enviado.`);
    return { ok: false };
  }
  try {
    const opts = teclado ? { reply_markup: teclado } : {};
    const msg = await bot.telegram.sendMessage(external_id, texto, opts);
    return { ok: true, telegram_msg_id: msg.message_id };
  } catch (err) {
    logger.error(`[TELEGRAM SEND ERROR] empresa=${empresa_id}:`, { error: err.message });
    return { ok: false };
  }
}

/**
 * Envía o elimina una reacción emoji a un mensaje específico.
 * @param {string} external_id     - Chat ID del usuario.
 * @param {number} telegram_msg_id - ID del mensaje en Telegram.
 * @param {string|null} emoji      - Emoji a poner, o null para limpiar.
 * @param {string} empresa_id
 */
async function enviarReaccionTelegram(external_id, telegram_msg_id, emoji, empresa_id) {
  const bot = bots.get(empresa_id);
  if (!bot) return { ok: false };
  try {
    await bot.telegram.callApi('setMessageReaction', {
      chat_id:    external_id,
      message_id: telegram_msg_id,
      reaction:   emoji ? [{ type: 'emoji', emoji }] : [],
      is_big:     false,
    });
    return { ok: true };
  } catch (err) {
    logger.warn(`[TELEGRAM REACCION] empresa=${empresa_id}:`, { error: err.message });
    return { ok: false };
  }
}

/**
 * Envía la acción "escribiendo..." al cliente en Telegram.
 * La acción dura ~5 segundos en el cliente o hasta que se envíe el siguiente mensaje.
 * @param {string} external_id - Telegram User ID.
 * @param {string} empresa_id  - Empresa del bot a usar.
 */
async function enviarAccionEscribiendo(external_id, empresa_id) {
  const bot = bots.get(empresa_id);
  if (!bot) return;
  try {
    await bot.telegram.sendChatAction(external_id, 'typing');
  } catch (err) {
    logger.warn(`[TELEGRAM TYPING] empresa=${empresa_id}:`, { error: err.message });
  }
}

/**
 * Envía una foto al cliente vía Telegram desde un Buffer en memoria.
 * @param {string} external_id
 * @param {Buffer} buffer       - Bytes de la imagen.
 * @param {string} caption      - Pie de foto (puede ser vacío).
 * @param {string} empresa_id
 * @returns {Promise<{ok: boolean, file_id: string|null}>}
 */
async function enviarFotoTelegram(external_id, buffer, caption, empresa_id) {
  const bot = bots.get(empresa_id);
  if (!bot) {
    logger.warn(`[TELEGRAM PHOTO] No hay bot activo para "${empresa_id}"`);
    return { ok: false, file_id: null };
  }
  try {
    const msg = await bot.telegram.sendPhoto(
      external_id,
      { source: buffer },
      caption ? { caption } : {}
    );
    const photos  = msg.photo;
    const file_id = photos[photos.length - 1].file_id;
    return { ok: true, file_id };
  } catch (err) {
    logger.error(`[TELEGRAM PHOTO ERROR] empresa=${empresa_id}:`, { error: err.message });
    return { ok: false, file_id: null };
  }
}

/**
 * Envía un documento (PDF u otro archivo) al cliente vía Telegram desde un Buffer.
 * @param {string} external_id
 * @param {Buffer} buffer
 * @param {string} caption
 * @param {string} empresa_id
 * @param {string} [filename]
 * @returns {Promise<{ok: boolean, file_id: string|null}>}
 */
async function enviarDocumentoTelegram(external_id, buffer, caption, empresa_id, filename = 'documento') {
  const bot = bots.get(empresa_id);
  if (!bot) {
    logger.warn(`[TELEGRAM DOC] No hay bot activo para "${empresa_id}"`);
    return { ok: false, file_id: null };
  }
  try {
    const msg = await bot.telegram.sendDocument(
      external_id,
      { source: buffer, filename },
      caption ? { caption } : {}
    );
    return { ok: true, file_id: msg.document.file_id };
  } catch (err) {
    logger.error(`[TELEGRAM DOC ERROR] empresa=${empresa_id}:`, { error: err.message });
    return { ok: false, file_id: null };
  }
}

/**
 * Envía un mensaje de voz al cliente vía Telegram desde un Buffer en memoria.
 * @param {string} external_id
 * @param {Buffer} buffer      - Bytes del audio (webm/ogg/mp4).
 * @param {string} empresa_id
 * @returns {Promise<{ok: boolean, file_id: string|null}>}
 */
async function enviarVozTelegram(external_id, buffer, empresa_id) {
  const bot = bots.get(empresa_id);
  if (!bot) {
    logger.warn(`[TELEGRAM VOICE] No hay bot activo para "${empresa_id}"`);
    return { ok: false, file_id: null };
  }
  try {
    const msg     = await bot.telegram.sendVoice(external_id, { source: buffer });
    const file_id = msg.voice.file_id;
    return { ok: true, file_id };
  } catch (err) {
    logger.error(`[TELEGRAM VOICE ERROR] empresa=${empresa_id}:`, { error: err.message });
    return { ok: false, file_id: null };
  }
}

// ---------------------------------------------------------------------------
// Internos
// ---------------------------------------------------------------------------

/**
 * Crea e inicia una instancia de Telegraf para la empresa indicada.
 * Si falla, reintenta con backoff exponencial (1s, 2s, 4s … máx. 60s).
 *
 * @param {string} empresa_id
 * @param {string} token
 * @param {import('socket.io').Server} io
 * @param {number} retries - Número de intentos previos fallidos.
 */
function _iniciarBot(empresa_id, token, io, retries) {
  const bot = new Telegraf(token);
  bots.set(empresa_id, bot);

  bot.on('text',           (ctx) => _procesarMensaje(ctx, 'text',     io, empresa_id));
  bot.on('sticker',        (ctx) => _procesarMensaje(ctx, 'sticker',  io, empresa_id));
  bot.on('location',       (ctx) => _procesarMensaje(ctx, 'location', io, empresa_id));
  bot.on('photo',          (ctx) => _procesarMensaje(ctx, 'photo',    io, empresa_id));
  bot.on('voice',          (ctx) => _procesarMensaje(ctx, 'voice',    io, empresa_id));
  bot.on('audio',          (ctx) => _procesarMensaje(ctx, 'audio',    io, empresa_id));
  bot.on('callback_query', (ctx) => _procesarCallback(ctx, io, empresa_id));
  bot.on('message_reaction', (ctx) => _procesarReaccion(ctx, io, empresa_id));

  // Errores no capturados dentro de los handlers (evita crash del proceso)
  bot.catch((err) => {
    logger.error(`[TELEGRAM ${empresa_id.toUpperCase()}] Error no manejado:`, { error: err.message });
  });

  bot.launch({ allowedUpdates: ['message', 'message_reaction', 'edited_message', 'callback_query'] })
    .catch((err) => {
      const delay = Math.min(1000 * Math.pow(2, retries), 60_000);
      logger.error(
        `[TELEGRAM ${empresa_id.toUpperCase()}] Fallo al iniciar (intento ${retries + 1}). Reintentando en ${delay / 1000}s.`,
        { error: err.message }
      );
      bots.delete(empresa_id);
      setTimeout(() => _iniciarBot(empresa_id, token, io, retries + 1), delay);
    });

  logger.info(`[TELEGRAM] Bot de "${empresa_id}" iniciado.`);
}

/**
 * Crea e inicia una instancia de Telegraf en modo WEBHOOK para la empresa indicada.
 * Registra un endpoint Express y llama a setWebhook en la API de Telegram.
 * Los mismos handlers de _iniciarBot se reutilizan — el procesamiento del chat no cambia.
 *
 * @param {string} empresa_id
 * @param {string} token
 * @param {import('socket.io').Server} io
 * @param {import('express').Application} app
 * @param {string} webhookBase - URL base HTTPS, ej. "https://abc123.ngrok.io"
 */
async function _iniciarBotWebhook(empresa_id, token, io, app, webhookBase) {
  const bot = new Telegraf(token);
  bots.set(empresa_id, bot);

  // Mismos handlers que en modo polling — el chat no cambia
  bot.on('text',             (ctx) => _procesarMensaje(ctx, 'text',     io, empresa_id));
  bot.on('sticker',          (ctx) => _procesarMensaje(ctx, 'sticker',  io, empresa_id));
  bot.on('location',         (ctx) => _procesarMensaje(ctx, 'location', io, empresa_id));
  bot.on('photo',            (ctx) => _procesarMensaje(ctx, 'photo',    io, empresa_id));
  bot.on('voice',            (ctx) => _procesarMensaje(ctx, 'voice',    io, empresa_id));
  bot.on('audio',            (ctx) => _procesarMensaje(ctx, 'audio',    io, empresa_id));
  bot.on('callback_query',   (ctx) => _procesarCallback(ctx, io, empresa_id));
  bot.on('message_reaction', (ctx) => _procesarReaccion(ctx, io, empresa_id));

  bot.catch((err) => {
    logger.error(`[TELEGRAM ${empresa_id.toUpperCase()}] Error no manejado:`, { error: err.message });
  });

  // Token secreto derivado del token del bot — Telegram lo devuelve en X-Telegram-Bot-Api-Secret-Token
  // para que podamos verificar que el update proviene realmente de Telegram y no de un tercero.
  const secretToken  = crypto.createHmac('sha256', token).update(empresa_id).digest('hex');
  const webhookPath  = `/telegram/webhook/${empresa_id}`;
  const webhookUrl   = `${webhookBase}${webhookPath}`;

  // Endpoint Express que recibe los updates de Telegram
  app.post(webhookPath, (req, res) => {
    const incoming = req.headers['x-telegram-bot-api-secret-token'];
    if (incoming !== secretToken) {
      logger.warn(`[TELEGRAM ${empresa_id.toUpperCase()}] Secret token inválido — update rechazado.`);
      return res.sendStatus(403);
    }
    res.sendStatus(200);
    // req.body ya viene parseado por el express.json() global de index.js
    bot.handleUpdate(req.body).catch(err =>
      logger.error(`[TELEGRAM ${empresa_id.toUpperCase()}] Error en handleUpdate:`, { error: err.message })
    );
  });

  // Registrar webhook en la API de Telegram
  await bot.telegram.setWebhook(webhookUrl, {
    secret_token:    secretToken,
    allowed_updates: ['message', 'message_reaction', 'edited_message', 'callback_query'],
  });

  logger.info(`[TELEGRAM] Bot "${empresa_id}" en modo webhook: ${webhookUrl}`);
}

/**
 * Procesa un mensaje entrante:
 * 1. Extrae texto/media según el tipo.
 * 2. Notifica al dashboard (Socket.io) antes de procesar.
 * 3. Llama al bot.service para obtener la respuesta.
 * 4. Envía la respuesta al usuario y notifica al dashboard.
 *
 * @private
 * @param {import('telegraf').Context} ctx
 * @param {'text'|'sticker'|'location'|'photo'} type
 * @param {import('socket.io').Server} io
 * @param {string} empresa_id - Empresa del bot que recibió el mensaje.
 */
async function _procesarMensaje(ctx, type, io, empresa_id) {
  try {
    let mensajeTexto = '';
    let tipo         = 'text';
    let urlMedia     = null;

    if (type === 'text') {
      mensajeTexto = ctx.message.text;

    } else if (type === 'sticker') {
      const sticker = ctx.message.sticker;
      mensajeTexto  = '📎 Sticker';

      if (sticker.is_video) {
        // Sticker de video (.webm)
        tipo     = 'sticker_video';
        urlMedia = `tg://${empresa_id}/${sticker.file_id}`;
      } else if (sticker.is_animated) {
        // Sticker Lottie (.tgs) — el navegador no lo reproduce;
        // se sirve el thumbnail estático como fallback.
        tipo = 'sticker';
        const thumbId = sticker.thumbnail?.file_id || sticker.thumb?.file_id;
        urlMedia = `tg://${empresa_id}/${thumbId || sticker.file_id}`;
      } else {
        // Sticker estático (.webp)
        tipo     = 'sticker';
        urlMedia = `tg://${empresa_id}/${sticker.file_id}`;
      }

    } else if (type === 'location') {
      const { latitude, longitude } = ctx.message.location;
      mensajeTexto = '📍 Ubicación compartida';
      tipo         = 'location';
      urlMedia     = `https://maps.google.com/?q=${latitude},${longitude}`;

    } else if (type === 'photo') {
      const photos  = ctx.message.photo;
      const largest = photos[photos.length - 1];
      mensajeTexto  = ctx.message.caption || '🖼 Imagen';
      tipo          = 'photo';
      urlMedia      = `tg://${empresa_id}/${largest.file_id}`;

    } else if (type === 'voice') {
      mensajeTexto = '🎤 Nota de voz';
      tipo         = 'voice';
      urlMedia     = `tg://${empresa_id}/${ctx.message.voice.file_id}`;

    } else if (type === 'audio') {
      const audio  = ctx.message.audio;
      mensajeTexto = audio.title || audio.file_name || '🎵 Audio';
      tipo         = 'voice';
      urlMedia     = `tg://${empresa_id}/${audio.file_id}`;
    }

    const input = {
      user_id:                ctx.from.id.toString(),
      canal:                  'telegram',
      empresa_id,
      empresa_preconfigurada: true,
      mensaje:                mensajeTexto,
      tipo,
      url_media:              urlMedia,
      nombre:                 `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim(),
      username:               ctx.from.username || '',
      telegram_msg_id:        ctx.message.message_id,
    };

    // Procesar (guarda en BD y devuelve { mensaje_id, conversacion, texto, teclado })
    const respuesta = await botService.procesar(input, io);

    // Emitir al CRM con mensaje_id real de BD (permite dedup correcto en frontend)
    if (io && respuesta?.conversacion) {
      const conv = respuesta.conversacion;
      const readRes = await mensajeRepo.marcarLeidosPorConversacion(conv.id);
      if (readRes.rowCount > 0) {
        emitToConv(io, conv.departamento, 'mensajes_leidos', {
          conversacion_id: conv.id,
          ids:             readRes.rows.map(r => r.id),
        });
      }
      emitToConv(io, conv.departamento, 'nuevo_mensaje', {
        mensaje_id:      respuesta.mensaje_id,
        conversacion_id: conv.id,
        usuario_id:      conv.usuario_id,
        empresa_id:      conv.empresa_id,
        mensaje:         input.mensaje,
        tipo:            input.tipo      || 'text',
        url_media:       input.url_media || null,
        remitente:       'user',
        fecha:           new Date(),
      });
    }

    if (respuesta?.texto) {
      await _enviarRespuestaBot(ctx, respuesta);
      if (io) {
        emitToConv(io, respuesta.conversacion?.departamento, 'nuevo_mensaje', {
          conversacion_id: respuesta.conversacion_id,
          mensaje:         respuesta.texto,
          tipo:            'text',
          remitente:       'bot',
          fecha:           new Date(),
        });
      }
    }

    // Notificar al área asignada cuando seleccionArea crea la conv ESPERANDO_AGENTE.
    // respuesta.departamento trae el área nueva (earlyReturn); conversacion.departamento
    // es el de la conv vieja (null), por eso se priorizaba mal antes.
    if (respuesta?.conversacion_id && io) {
      const dept = respuesta.departamento || respuesta.conversacion?.departamento;
      emitToConv(io, dept, 'conversacion_actualizada', {
        id:         respuesta.conversacion_id,
        empresa_id: respuesta.conversacion?.empresa_id,
        estado:     'ESPERANDO_AGENTE',
        es_humano:  true,
      });
    }

  } catch (err) {
    logger.error(`[TELEGRAM ${empresa_id.toUpperCase()} ERROR] (${type}):`, { error: err.message });
  }
}

/**
 * Envía la respuesta del bot al cliente usando el teclado inline si la respuesta lo incluye.
 * @private
 */
async function _enviarRespuestaBot(ctx, respuesta) {
  const opts = {};
  if (respuesta.teclado) opts.reply_markup = respuesta.teclado;
  await ctx.reply(respuesta.texto, opts);
}

/**
 * Extrae el texto legible del botón presionado a partir del teclado del mensaje original.
 * @private
 * @param {import('telegraf').Context} ctx
 * @param {string} data - callback_data del botón presionado.
 * @returns {string} Texto del botón o `data` como fallback.
 */
function _getLabelDelBoton(ctx, data) {
  try {
    const filas = ctx.callbackQuery?.message?.reply_markup?.inline_keyboard || [];
    for (const fila of filas) {
      for (const btn of fila) {
        if (btn.callback_data === data) return btn.text;
      }
    }
  } catch (_) { /* sin teclado disponible */ }
  return data;
}

/**
 * Procesa un callback_query: el cliente tocó un botón inline.
 * 1. Confirma el callback (quita el estado de "cargando" del botón).
 * 2. Elimina el teclado del mensaje original para indicar que ya fue elegido.
 * 3. Envía un eco visible con la etiqueta del botón para que el cliente
 *    vea su propia selección en la conversación.
 * 4. Delega al bot.service como si el cliente hubiera escrito el valor del botón.
 * @private
 */
async function _procesarCallback(ctx, io, empresa_id) {
  try {
    const data = ctx.callbackQuery?.data;
    if (!data) return;

    // Confirmar el callback (requerido por Telegram para quitar el indicador de carga)
    await ctx.answerCbQuery();

    // Extraer la etiqueta legible del botón antes de eliminar el teclado
    const label = _getLabelDelBoton(ctx, data);

    // Quitar el teclado del mensaje original — ya no es necesario
    try {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch (_) { /* mensaje ya editado o eliminado */ }

    // Enviar un nuevo mensaje con solo el texto de la opción elegida.
    // Aparece en el chat como un mensaje independiente, creando la impresión
    // de que el usuario escribió y envió su selección.
    // Nota: en Telegram, los bots no pueden enviar mensajes que aparezcan
    // del lado derecho (burbuja del usuario) — es una limitación de la API.
    await ctx.reply(label);

    const input = {
      user_id:                ctx.from.id.toString(),
      canal:                  'telegram',
      empresa_id,
      empresa_preconfigurada: true,
      mensaje:                data,           // valor técnico para los parsers
      mensaje_display:        label,          // etiqueta legible para guardar en DB
      tipo:                   'text',
      url_media:              null,
      nombre:                 `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim(),
      username:               ctx.from.username || '',
      telegram_msg_id:        null,
    };

    // Notificar al dashboard (mismo flujo que texto normal)
    if (io) {
      const userRes = await usuarioRepo.findByCanal(input.canal, input.user_id);
      if (userRes.rows.length > 0) {
        const convRes = await conversacionRepo.findActiveByUsuario(userRes.rows[0].id, empresa_id);
        if (convRes.rows.length > 0) {
          const conv = convRes.rows[0];
          emitToConv(io, conv.departamento, 'nuevo_mensaje', {
            conversacion_id: conv.id,
            usuario_id:      userRes.rows[0].id,
            empresa_id:      conv.empresa_id,
            mensaje:         label,           // etiqueta legible en el dashboard
            tipo:            'text',
            url_media:       null,
            remitente:       'user',
            fecha:           new Date(),
          });
        }
      }
    }

    const respuesta = await botService.procesar(input, io);

    if (respuesta?.texto) {
      await _enviarRespuestaBot(ctx, respuesta);
      if (io) {
        emitToConv(io, respuesta.departamento, 'nuevo_mensaje', {
          conversacion_id: respuesta.conversacion_id,
          mensaje:         respuesta.texto,
          tipo:            'text',
          remitente:       'bot',
          fecha:           new Date(),
        });
      }
    }

    if (respuesta?.conversacion_id && io) {
      emitToConv(io, respuesta.departamento, 'conversacion_actualizada', {
        id:     respuesta.conversacion_id,
        estado: 'ESPERANDO_AGENTE',
      });
    }

  } catch (err) {
    logger.error(`[TELEGRAM CALLBACK ERROR] empresa=${empresa_id}:`, { error: err.message });
  }
}

/**
 * Procesa un evento de reacción recibido de Telegram.
 * Actualiza el campo reacciones del mensaje en BD y notifica al CRM en tiempo real.
 * @private
 */
async function _procesarReaccion(ctx, io, empresa_id) {
  try {
    const reaction = ctx.update?.message_reaction;
    if (!reaction) return;

    const telegram_msg_id = reaction.message_id;
    const external_id     = reaction.chat?.id?.toString() || reaction.user?.id?.toString();
    if (!telegram_msg_id || !external_id) return;

    // El emoji activo es el primero de new_reaction; si está vacío el usuario quitó la reacción
    const nuevoEmoji = reaction.new_reaction?.[0]?.emoji || null;

    const { rows } = await mensajeRepo.findByTelegramMsgId(telegram_msg_id, empresa_id, external_id);
    if (!rows.length) return;

    const { id: mensaje_id, conversacion_id, departamento } = rows[0];
    const reaccionesActuales = rows[0].reacciones || [];

    // Mantener máximo 1 reacción de usuario por mensaje (igual que Telegram)
    const filtradas = reaccionesActuales.filter(r => r.external_id !== external_id);
    const nuevas    = nuevoEmoji ? [...filtradas, { emoji: nuevoEmoji, remitente: 'user', external_id }] : filtradas;

    await mensajeRepo.updateReacciones(mensaje_id, nuevas);

    if (io) {
      emitToConv(io, departamento, 'mensaje_reaccion', { mensaje_id, conversacion_id, reacciones: nuevas });
    }
  } catch (err) {
    logger.error(`[TELEGRAM REACCION ERROR] empresa=${empresa_id}:`, { error: err.message });
  }
}

/**
 * Resuelve un file_id de Telegram a una URL de descarga fresca.
 * Las URLs de Telegram expiran en ~1 hora; este método siempre genera una nueva.
 * @param {string} file_id   - file_id de Telegram (permanente).
 * @param {string} empresa_id
 * @returns {Promise<string>} URL de descarga válida por ~1 hora.
 */
async function resolveFileLink(file_id, empresa_id) {
  const bot = bots.get(empresa_id);
  if (!bot) throw new Error(`No hay bot activo para "${empresa_id}"`);
  const link = await bot.telegram.getFileLink(file_id);
  return link.href;
}

// Apagado limpio: detener todos los bots al recibir señales del SO
process.once('SIGINT',  () => bots.forEach(bot => { try { bot.stop('SIGINT'); } catch (_) {} }));
process.once('SIGTERM', () => bots.forEach(bot => { try { bot.stop('SIGTERM'); } catch (_) {} }));

module.exports = { iniciarTelegram, enviarMensajeTelegram, enviarAccionEscribiendo, resolveFileLink, enviarFotoTelegram, enviarVozTelegram, enviarDocumentoTelegram, enviarReaccionTelegram };
