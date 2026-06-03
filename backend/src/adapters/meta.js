/**
 * @file meta.js
 * @description Adaptador de Meta: gestiona WhatsApp Business, Facebook Messenger e Instagram DMs
 * usando la Graph API de Meta (v18.0).
 *
 * Un solo webhook recibe eventos de los tres canales. El campo `object` del payload
 * indica de qué canal proviene: 'whatsapp_business_account', 'page' o 'instagram'.
 *
 * Configuración necesaria en .env por empresa:
 *   META_FIBRATEC_ACCESS_TOKEN        — token de acceso permanente (System User)
 *   META_FIBRATEC_WHATSAPP_PHONE_ID   — ID del número de WhatsApp Business
 *   META_FIBRATEC_FACEBOOK_PAGE_ID    — ID de la Página de Facebook
 *   META_FIBRATEC_INSTAGRAM_ID        — ID de la cuenta de Instagram Business
 *   META_COMPUSEMMM_ACCESS_TOKEN
 *   META_COMPUSEMMM_WHATSAPP_PHONE_ID
 *   META_COMPUSEMMM_FACEBOOK_PAGE_ID
 *   META_COMPUSEMMM_INSTAGRAM_ID
 *   META_WEBHOOK_VERIFY_TOKEN         — token personalizado para verificar el webhook en Meta
 *
 * Para activar:
 *   1. Crear una app en developers.facebook.com
 *   2. Agregar productos: WhatsApp, Messenger, Instagram
 *   3. Configurar el webhook con la URL pública + META_WEBHOOK_VERIFY_TOKEN
 *   4. Suscribir eventos: messages, messaging_postbacks (Messenger/Instagram)
 *   5. Rellenar las variables de entorno arriba descritas
 */

const crypto           = require('crypto');
const botService       = require('../services/bot.service');
const usuarioRepo      = require('../repositories/usuario.repository');
const conversacionRepo = require('../repositories/conversacion.repository');
const mensajeRepo      = require('../repositories/mensaje.repository');
const logger           = require('../config/logger');
const { emitToConv }   = require('../utils/rooms');

const GRAPH_URL       = 'https://graph.facebook.com/v18.0';
const VERIFY_TOKEN    = process.env.META_WEBHOOK_VERIFY_TOKEN || 'isp_chatbot_meta_verify';
const META_APP_SECRET = process.env.META_APP_SECRET || '';


/**
 * Valida la firma HMAC-SHA256 que Meta incluye en cada webhook POST.
 * Documentación: https://developers.facebook.com/docs/messenger-platform/webhooks#validate-payloads
 *
 * @param {string|undefined} firma    - Valor del header X-Hub-Signature-256 ("sha256=<hex>")
 * @param {Buffer|string}    rawBody  - Cuerpo crudo de la solicitud (sin parsear)
 * @returns {boolean}
 */
function _verificarFirma(firma, rawBody) {
  if (!META_APP_SECRET) {
    // Sin secret configurado solo advertimos; en producción debe estar definido.
    logger.warn('[META] META_APP_SECRET no configurado — validación de firma omitida. Defínelo en .env para producción.');
    return true;
  }
  if (!firma || !firma.startsWith('sha256=')) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', META_APP_SECRET)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ── Mapa empresa_id → credenciales por canal ─────────────────────────────────

const META_CONFIG = {
  fibratec: {
    access_token:       process.env.META_FIBRATEC_ACCESS_TOKEN,
    page_access_token:  process.env.META_FIBRATEC_PAGE_ACCESS_TOKEN,  // Messenger/Instagram
    whatsapp_phone_id:  process.env.META_FIBRATEC_WHATSAPP_PHONE_ID,
    facebook_page_id:   process.env.META_FIBRATEC_FACEBOOK_PAGE_ID,
    instagram_id:       process.env.META_FIBRATEC_INSTAGRAM_ID,
  },
  compusemmm: {
    access_token:       process.env.META_COMPUSEMMM_ACCESS_TOKEN,
    page_access_token:  process.env.META_COMPUSEMMM_PAGE_ACCESS_TOKEN,
    whatsapp_phone_id:  process.env.META_COMPUSEMMM_WHATSAPP_PHONE_ID,
    facebook_page_id:   process.env.META_COMPUSEMMM_FACEBOOK_PAGE_ID,
    instagram_id:       process.env.META_COMPUSEMMM_INSTAGRAM_ID,
  },
};

// Índices inversos: ID de Meta → { empresa_id }
const _byPhone     = {}; // whatsapp_phone_id → empresa_id
const _byPage      = {}; // facebook_page_id  → empresa_id
const _byInstagram = {}; // instagram_id      → empresa_id

for (const [empresa_id, cfg] of Object.entries(META_CONFIG)) {
  if (cfg.whatsapp_phone_id) _byPhone[cfg.whatsapp_phone_id]     = empresa_id;
  if (cfg.facebook_page_id)  _byPage[cfg.facebook_page_id]       = empresa_id;
  if (cfg.instagram_id)      _byInstagram[cfg.instagram_id]      = empresa_id;
}

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Registra las rutas del webhook Meta en la app Express.
 * Debe llamarse desde index.js.
 *
 * @param {import('express').Application} app
 * @param {import('socket.io').Server}    io
 */
function iniciarMeta(app, io) {
  // GET — verificación del webhook por parte de Meta
  app.get('/meta/webhook', (req, res) => {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      logger.info('[META] Webhook verificado por Meta.');
      return res.status(200).send(challenge);
    }
    logger.warn('[META] Verificación de webhook fallida — token incorrecto.');
    res.sendStatus(403);
  });

  // POST — eventos entrantes (mensajes de WhatsApp, Messenger e Instagram)
  // req.body llega como Buffer crudo (express.raw registrado en index.js antes del json global)
  app.post('/meta/webhook', (req, res) => {
    // 1. Validar firma antes de hacer cualquier otra cosa
    const firma = req.headers['x-hub-signature-256'];
    if (!_verificarFirma(firma, req.body)) {
      logger.warn('[META] Firma inválida — webhook rechazado.');
      return res.sendStatus(403);
    }

    // 2. Meta espera 200 inmediato
    res.sendStatus(200);

    // 3. Parsear el Buffer a objeto y procesar de forma asíncrona
    let payload;
    try {
      payload = JSON.parse(req.body.toString('utf8'));
    } catch (err) {
      logger.error('[META] Body no es JSON válido:', { error: err.message });
      return;
    }

    _procesarEvento(payload, io).catch(err =>
      logger.error('[META] Error al procesar evento:', { error: err.message })
    );
  });

  logger.info('[META] Rutas de webhook registradas en /meta/webhook');
}

/**
 * Envía un mensaje de texto a través del canal y empresa indicados.
 *
 * @param {'whatsapp'|'facebook'|'instagram'} canal
 * @param {string} external_id - ID del destinatario en ese canal.
 * @param {string} texto
 * @param {string} empresa_id
 * @returns {Promise<boolean>} true si fue entregado.
 */
async function enviarMensajeMeta(canal, external_id, texto, empresa_id, teclado = null) {
  const cfg = META_CONFIG[empresa_id];
  if (!cfg?.access_token) {
    logger.warn(`[META SEND] Sin credenciales para empresa="${empresa_id}" canal="${canal}"`);
    return false;
  }

  try {
    let url;
    let body;

    if (canal === 'whatsapp') {
      if (!cfg.whatsapp_phone_id) {
        logger.warn(`[META SEND] Sin whatsapp_phone_id para empresa="${empresa_id}"`);
        return false;
      }

      url = `${GRAPH_URL}/${cfg.whatsapp_phone_id}/messages`;

      const interactivo = _telegramKeyboardToWA(teclado, texto);
      if (interactivo) {
        // Intentar mensaje interactivo (botones/lista)
        const bodyInteractivo = { messaging_product: 'whatsapp', to: external_id, ...interactivo };
        const resI = await fetch(url, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.access_token}` },
          body:    JSON.stringify(bodyInteractivo),
        });
        if (resI.ok) {
          const jsonI = await resI.json().catch(() => ({}));
          return { ok: true, wamid: jsonI.messages?.[0]?.id || null };
        }

        // Si Meta rechaza el interactivo (típico en sandbox), caer a texto plano
        const errI = await resI.json().catch(() => ({}));
        logger.warn(`[META/WA] Interactivo rechazado (${resI.status}), usando texto plano:`, errI?.error?.message || '');
        body = {
          messaging_product: 'whatsapp',
          to:                external_id,
          type:              'text',
          text:              { body: _tecladoComoTexto(texto, teclado) },
        };
      } else {
        body = { messaging_product: 'whatsapp', to: external_id, type: 'text', text: { body: texto } };
      }
    } else {
      // Messenger e Instagram usan Page Access Token + Send API
      const pageToken = cfg.page_access_token;
      if (!pageToken) {
        logger.warn(`[META SEND] Sin page_access_token para empresa="${empresa_id}" canal="${canal}". Agrégalo en .env`);
        return false;
      }

      // Convertir teclado a quick replies de Messenger
      const msgMessenger = _telegramKeyboardToMessenger(teclado, texto);

      url  = `${GRAPH_URL}/me/messages`;
      body = {
        recipient: { id: external_id },
        message:   msgMessenger || { text: texto },
      };

      const resM = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${pageToken}` },
        body:    JSON.stringify(body),
      });
      if (!resM.ok) {
        const err = await resM.json().catch(() => ({}));
        logger.error(`[META SEND ${canal.toUpperCase()}] Error ${resM.status}:`, err);
        return false;
      }
      return true;
    }

    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${cfg.access_token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      logger.error(`[META SEND] Error ${res.status}:`, err);
      return { ok: false };
    }
    const json = await res.json().catch(() => ({}));
    return { ok: true, wamid: json.messages?.[0]?.id || null };
  } catch (err) {
    logger.error('[META SEND] Excepción:', { error: err.message });
    return { ok: false };
  }
}

/**
 * WhatsApp Business Cloud API NO soporta typing indicators de negocio → cliente.
 * Lo más cercano disponible es un read receipt: marca el último mensaje del cliente
 * como leído → el cliente ve sus palomitas en azul (señal de que el agente está activo).
 *
 * Requiere `conversacion_id` para buscar el wamid del último mensaje del cliente.
 * Sin él no hace nada (no hay cómo saber qué mensaje marcar).
 */
async function enviarAccionEscribiendoMeta(canal, external_id, empresa_id, conversacion_id = null) {
  if (canal !== 'whatsapp') return;
  if (!conversacion_id) return;

  const cfg = META_CONFIG[empresa_id];
  if (!cfg?.access_token || !cfg.whatsapp_phone_id) return;

  try {
    const { rows } = await mensajeRepo.findLastUserWamidByConversacion(conversacion_id);
    const wamid = rows[0]?.wamid;
    if (!wamid) return;

    await fetch(`${GRAPH_URL}/${cfg.whatsapp_phone_id}/messages`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${cfg.access_token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status:            'read',
        message_id:        wamid,
      }),
    });
  } catch { /* no crítico */ }
}

// ── Internos ─────────────────────────────────────────────────────────────────

/**
 * Convierte un teclado de Telegraf (inline_keyboard) al formato interactivo de WhatsApp.
 *
 * WhatsApp tiene dos tipos:
 *   - button  (≤ 3 opciones): título máx 20 chars, id máx 256 chars
 *   - list    (4-10 opciones): título de fila máx 24 chars, id máx 200 chars
 *
 * @param {object} teclado - Objeto con { inline_keyboard: [[{ text, callback_data }]] }
 * @param {string} texto   - Texto del cuerpo del mensaje (requerido por WhatsApp interactive)
 * @returns {object|null}  Fragmento de body listo para la Graph API, o null si no aplica.
 */
/**
 * Convierte un teclado Telegram al formato interactivo de WhatsApp.
 * Devuelve null si el teclado está vacío.
 */
function _telegramKeyboardToWA(teclado, texto) {
  if (!teclado?.inline_keyboard) return null;
  const botones = teclado.inline_keyboard.flat();
  if (!botones.length) return null;

  if (botones.length <= 3) {
    return {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: texto },
        action: {
          buttons: botones.map((btn, i) => ({
            type:  'reply',
            reply: {
              id:    String(btn.callback_data ?? i).slice(0, 256),
              title: String(btn.text).slice(0, 20),
            },
          })),
        },
      },
    };
  }

  return {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: texto },
      action: {
        button: 'Ver opciones',
        sections: [{
          title: 'Opciones',
          rows: botones.slice(0, 10).map((btn, i) => ({
            id:    String(btn.callback_data ?? i).slice(0, 200),
            title: String(btn.text).slice(0, 24),
          })),
        }],
      },
    },
  };
}

/**
 * Convierte un teclado Telegram a quick replies de Messenger.
 * Quick replies: máx 13 opciones, título máx 20 chars.
 * Devuelve el objeto `message` completo listo para la Send API.
 * Si no hay botones, devuelve null (usar texto plano).
 *
 * @param {object} teclado - inline_keyboard de Telegraf
 * @param {string} texto   - Texto del mensaje
 * @returns {object|null}
 */
function _telegramKeyboardToMessenger(teclado, texto) {
  if (!teclado?.inline_keyboard) return null;
  const botones = teclado.inline_keyboard.flat();
  if (!botones.length) return null;

  return {
    text: texto,
    quick_replies: botones.slice(0, 13).map(btn => ({
      content_type: 'text',
      title:        String(btn.text).slice(0, 20),
      payload:      String(btn.callback_data),
    })),
  };
}

/**
 * Fallback para cuando Meta rechaza el mensaje interactivo.
 * Embebe las opciones como texto numerado en el propio mensaje.
 * Los parsers ya aceptan "1", "2", etc., así que el bot sigue funcionando.
 *
 * Ejemplo de salida:
 *   ¡Hola! ¿Cómo puedo ayudarte?
 *
 *   1️⃣  Fibratec
 *   2️⃣  Compusemmm de México
 *
 *   _Responde con el número de tu opción._
 */
function _tecladoComoTexto(texto, teclado) {
  if (!teclado?.inline_keyboard) return texto;
  const botones = teclado.inline_keyboard.flat();
  if (!botones.length) return texto;
  const opciones = botones.map(b => b.text).join('\n');
  return `${texto}\n\n${opciones}\n\n_Responde con el número de tu opción._`;
}

/**
 * Convierte lat/lng + metadatos opcionales al formato interno de ubicación.
 * Compartido por los tres canales (WA, Messenger, Instagram).
 */
function _normalizarUbicacion(lat, lng, name = null, address = null) {
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  const partes  = [name, address].filter(Boolean);
  const display = partes.length ? partes.join(', ') : `${lat}, ${lng}`;
  return { mapsUrl, display };
}

async function _procesarEvento(payload, io) {
  const object = payload?.object;
  if (!object) return;

  if (object === 'whatsapp_business_account') {
    await _procesarWhatsapp(payload, io);
  } else if (object === 'page') {
    await _procesarMessenger(payload, io);
  } else if (object === 'instagram') {
    await _procesarInstagram(payload, io);
  }
}

async function _procesarWhatsapp(payload, io) {
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;
      const value = change.value;

      const empresa_id = _byPhone[value.metadata?.phone_number_id];
      if (!empresa_id) {
        logger.warn('[META/WA] phone_number_id desconocido:', value.metadata?.phone_number_id);
        continue;
      }

      for (const msg of value.messages || []) {
        const contact = value.contacts?.find(c => c.wa_id === msg.from) || {};
        const nombre  = contact.profile?.name || msg.from;

        let mensajeTexto   = null;
        let mensajeDisplay = null;

        if (msg.type === 'text') {
          mensajeTexto = msg.text?.body || '';

        } else if (msg.type === 'interactive') {
          // El usuario tocó un botón o eligió de una lista.
          // id = callback_data del teclado (lo que usan los parsers)
          // title = etiqueta legible del botón
          const ir = msg.interactive;
          if (ir.type === 'button_reply') {
            mensajeTexto   = ir.button_reply.id;
            mensajeDisplay = ir.button_reply.title;
          } else if (ir.type === 'list_reply') {
            mensajeTexto   = ir.list_reply.id;
            mensajeDisplay = ir.list_reply.title;
          }

        } else if (msg.type === 'location') {
          const { latitude: lat, longitude: lng, name = null, address = null } = msg.location;
          const { mapsUrl, display } = _normalizarUbicacion(lat, lng, name, address);
          logger.info(`[WA RECV LOCATION] lat=${lat} lng=${lng} name="${name || ''}" addr="${address || ''}"`);
          await _enviarAlBot({
            canal:     'whatsapp',
            user_id:   msg.from,
            nombre,
            username:  '',
            empresa_id,
            mensaje:   display,
            tipo:      'location',
            url_media: mapsUrl,
          }, io);
          continue;

        } else if (msg.type === 'audio') {
          const mediaId = msg.audio?.id;
          if (!mediaId) continue;
          logger.info(`[WA RECV AUDIO] from=${msg.from} media_id=${mediaId}`);
          await _enviarAlBot({
            canal:          'whatsapp',
            user_id:        msg.from,
            nombre,
            username:       '',
            empresa_id,
            mensaje:        '🎤 Audio de voz',
            tipo:           'voice',
            url_media:      `wa://${empresa_id}/${mediaId}`,
            wamid_entrante: msg.id,
          }, io);
          continue;

        } else if (msg.type === 'image') {
          const mediaId = msg.image?.id;
          if (!mediaId) continue;
          logger.info(`[WA RECV IMAGE] from=${msg.from} media_id=${mediaId}`);
          await _enviarAlBot({
            canal:          'whatsapp',
            user_id:        msg.from,
            nombre,
            username:       '',
            empresa_id,
            mensaje:        msg.image?.caption || '🖼 Imagen',
            tipo:           'photo',
            url_media:      `wa://${empresa_id}/${mediaId}`,
            wamid_entrante: msg.id,
          }, io);
          continue;

        } else {
          // Otros tipos (document, video, sticker…) — pendiente de implementar
          continue;
        }

        if (mensajeTexto === null) continue;

        await _enviarAlBot({
          canal:           'whatsapp',
          user_id:         msg.from,
          nombre,
          username:        '',
          empresa_id,
          mensaje:         mensajeTexto,
          mensaje_display: mensajeDisplay,
          wamid_entrante:  msg.id,          // ID del mensaje del cliente → para read receipts
        }, io);
      }

      // ── Status de mensajes salientes (sent / delivered / read) ──────────────
      // WhatsApp envía estos eventos cuando el mensaje llega o es leído por el cliente.
      for (const status of value.statuses || []) {
        await _procesarStatusWA(status, io).catch(err =>
          logger.error('[META/WA STATUS] Error:', { error: err.message })
        );
      }
    }
  }
}

/**
 * Procesa un status de WhatsApp (sent/delivered/read) y actualiza el mensaje en BD + socket.
 * Mapa: sent → 'enviado', delivered → 'entregado', read → 'leido'.
 * @private
 */
async function _procesarStatusWA(status, io) {
  const ESTADO_MAP = { sent: 'enviado', delivered: 'entregado', read: 'leido' };
  const estadoDB   = ESTADO_MAP[status.status];
  if (!estadoDB || !status.id) return;

  const { rows } = await mensajeRepo.findByWamid(status.id);
  if (!rows.length) return;

  const { id: mensaje_id, conversacion_id, departamento } = rows[0];
  await mensajeRepo.updateEstadoById(mensaje_id, estadoDB);
  logger.info(`[WA STATUS] ${status.id} → ${estadoDB} (msg_id=${mensaje_id})`);

  if (io) {
    emitToConv(io, departamento, 'mensaje_estado', { mensaje_id, conversacion_id, estado: estadoDB });
  }
}

async function _procesarMessenger(payload, io) {
  for (const entry of payload.entry || []) {
    const empresa_id = _byPage[entry.id];
    if (!empresa_id) {
      logger.warn('[META/FB] page_id desconocido:', entry.id);
      continue;
    }

    const cfg = META_CONFIG[empresa_id];
    for (const event of entry.messaging || []) {
      const psid = event.sender.id;
      let mensajeTexto   = null;
      let mensajeDisplay = null;

      if (event.message?.quick_reply?.payload) {
        // Usuario tocó un quick reply
        mensajeTexto   = event.message.quick_reply.payload;
        mensajeDisplay = event.message.text;
      } else if (event.postback?.payload) {
        // Usuario tocó un botón postback
        mensajeTexto   = event.postback.payload;
        mensajeDisplay = event.postback.title;
      } else if (event.message?.text) {
        mensajeTexto = event.message.text;
      } else if (event.message?.attachments?.[0]?.type === 'location') {
        const att = event.message.attachments[0];
        const lat  = att.payload?.coordinates?.lat;
        const lng  = att.payload?.coordinates?.long;
        if (lat != null && lng != null) {
          const { mapsUrl, display } = _normalizarUbicacion(lat, lng, att.title || null);
          logger.info(`[FB RECV LOCATION] lat=${lat} lng=${lng} name="${att.title || ''}"`);
          const nombre = await _resolverNombreMeta(psid, cfg, 'facebook');
          await _enviarAlBot({
            canal:     'facebook',
            user_id:   psid,
            nombre,
            username:  '',
            empresa_id,
            mensaje:   display,
            tipo:      'location',
            url_media: mapsUrl,
          }, io);
        }
        continue;
      } else if (event.sender_action === 'typing_on') {
        // Messenger envía este evento cuando el cliente empieza a escribir
        await _emitirEscribiendoMeta(psid, empresa_id, 'facebook', io);
        continue;
      } else {
        continue;
      }

      const nombre = await _resolverNombreMeta(psid, cfg, 'facebook');
      await _enviarAlBot({
        canal:           'facebook',
        user_id:         psid,
        nombre,
        username:        '',
        empresa_id,
        mensaje:         mensajeTexto,
        mensaje_display: mensajeDisplay,
      }, io);
    }
  }
}

async function _procesarInstagram(payload, io) {
  for (const entry of payload.entry || []) {
    const empresa_id = _byInstagram[entry.id];
    if (!empresa_id) {
      logger.warn('[META/IG] instagram_id desconocido:', entry.id);
      continue;
    }

    const cfg = META_CONFIG[empresa_id];
    for (const event of entry.messaging || []) {
      const psid = event.sender.id;

      if (event.message?.attachments?.[0]?.type === 'location') {
        const att = event.message.attachments[0];
        const lat  = att.payload?.coordinates?.lat;
        const lng  = att.payload?.coordinates?.long;
        if (lat != null && lng != null) {
          const { mapsUrl, display } = _normalizarUbicacion(lat, lng, att.title || null);
          logger.info(`[IG RECV LOCATION] lat=${lat} lng=${lng} name="${att.title || ''}"`);
          const nombre = await _resolverNombreMeta(psid, cfg, 'instagram');
          await _enviarAlBot({
            canal:     'instagram',
            user_id:   psid,
            nombre,
            username:  '',
            empresa_id,
            mensaje:   display,
            tipo:      'location',
            url_media: mapsUrl,
          }, io);
        }
        continue;
      }

      if (event.sender_action === 'typing_on') {
        await _emitirEscribiendoMeta(psid, empresa_id, 'instagram', io);
        continue;
      }

      if (!event.message?.text) continue;
      const nombre = await _resolverNombreMeta(psid, cfg, 'instagram');
      await _enviarAlBot({
        canal:    'instagram',
        user_id:  psid,
        nombre,
        username: '',
        empresa_id,
        mensaje:  event.message.text,
      }, io);
    }
  }
}

/**
 * Emite `cliente_escribiendo` al CRM cuando Messenger/Instagram notifica que el cliente está escribiendo.
 * Requiere buscar la conversación activa del usuario por su PSID.
 * @private
 */
async function _emitirEscribiendoMeta(psid, empresa_id, canal, io) {
  if (!io) return;
  try {
    const { rows: usrRows } = await usuarioRepo.findByCanal(canal, psid);
    if (!usrRows.length) return;
    const { rows: convRows } = await conversacionRepo.findActiveByUsuario(usrRows[0].id, empresa_id);
    if (!convRows.length) return;
    const conv = convRows[0];
    emitToConv(io, conv.departamento, 'cliente_escribiendo', { conversacion_id: conv.id });
  } catch { /* silencioso — no es crítico */ }
}

/** Devuelve true si el nombre es un PSID/IGSID crudo (string numérico largo). */
function _esPsid(nombre) {
  return !nombre || /^\d{10,}$/.test(String(nombre));
}

/**
 * Consulta el nombre real de un usuario de Messenger/Instagram via Graph API v21.0.
 * Usa el Page Access Token (tiene permiso pages_messaging).
 * Fallback: "Usuario de Facebook" o "Usuario de Instagram" — nunca el PSID crudo.
 *
 * @param {string} psid  - Page-Scoped ID o Instagram-Scoped ID.
 * @param {object} cfg   - Credenciales de la empresa.
 * @param {string} canal - 'facebook' | 'instagram'
 * @returns {Promise<string>}
 */
async function _fetchUserName(psid, cfg, canal = 'facebook') {
  const token = cfg?.page_access_token || cfg?.access_token;
  const fallback = canal === 'instagram' ? 'Usuario de Instagram' : 'Usuario de Facebook';
  if (!token) return fallback;
  try {
    const res  = await fetch(
      `https://graph.facebook.com/v21.0/${psid}?fields=first_name,last_name,name&access_token=${token}`
    );
    const data = await res.json();
    logger.info(`[META NAME] PSID=${psid} status=${res.status} data=${JSON.stringify(data)}`);
    if (!res.ok) return fallback;
    if (data.name) return data.name;
    if (data.first_name || data.last_name) return `${data.first_name || ''} ${data.last_name || ''}`.trim();
    return fallback;
  } catch (err) {
    logger.warn(`[META NAME] Error al obtener nombre PSID=${psid}:`, { error: err.message });
    return fallback;
  }
}

/**
 * Resuelve el nombre de un usuario Meta con prioridad:
 *   1. Nombre ya guardado en DB (WISP o Graph API previo)
 *   2. Graph API (solo si el nombre en DB es un PSID crudo o vacío)
 *   3. Fallback estático
 * Actualiza la DB si obtiene un nombre real de Graph API.
 *
 * @param {string} psid
 * @param {object} cfg
 * @param {string} canal
 * @returns {Promise<string>}
 */
async function _resolverNombreMeta(psid, cfg, canal) {
  // 1. Consultar DB
  const { rows } = await usuarioRepo.findByCanal(canal, psid);
  if (rows.length > 0 && !_esPsid(rows[0].nombre)) {
    return rows[0].nombre; // Ya tenemos nombre real — no llamar a Graph API
  }

  // 2. Llamar a Graph API
  const nombre = await _fetchUserName(psid, cfg, canal);

  // 3. Cachear en DB si el usuario ya existe y el nombre es real
  if (rows.length > 0 && !_esPsid(nombre)) {
    await usuarioRepo.update(rows[0].id, nombre, rows[0].username || '', null);
  }

  return nombre;
}

/**
 * Normaliza el input de cualquier canal, lo pasa a bot.service y emite los eventos
 * de socket DESPUÉS del DB save para incluir el mensaje_id real (dedup en frontend).
 */
async function _enviarAlBot(input, io) {
  try {
    const resultado = await botService.procesar({
      ...input,
      tipo:                   input.tipo || 'text',
      empresa_preconfigurada: true,
    }, io);

    if (!resultado) return; // cooldown — rate limiter descartó el mensaje

    const { mensaje_id, conversacion, texto, teclado } = resultado;

    if (io && conversacion) {
      emitToConv(io, conversacion.departamento, 'cliente_escribiendo', {
        conversacion_id: conversacion.id,
      });

      const readRes = await mensajeRepo.marcarLeidosPorConversacion(conversacion.id);
      if (readRes.rowCount > 0) {
        emitToConv(io, conversacion.departamento, 'mensajes_leidos', {
          conversacion_id: conversacion.id,
          ids:             readRes.rows.map(r => r.id),
        });
      }

      emitToConv(io, conversacion.departamento, 'nuevo_mensaje', {
        mensaje_id,
        conversacion_id: conversacion.id,
        usuario_id:      conversacion.usuario_id,
        empresa_id:      conversacion.empresa_id,
        mensaje:         input.mensaje_display || input.mensaje,
        tipo:            input.tipo            || 'text',
        url_media:       input.url_media       || null,
        remitente:       'user',
        fecha:           new Date(),
      });

      // Actualizar la lista del CRM (añade conversaciones nuevas y reordena existentes).
      // Sin esto, conversaciones en estado 'abierta' o nuevos usuarios nunca aparecen.
      emitToConv(io, conversacion.departamento, 'conversacion_actualizada', {
        id:         conversacion.id,
        empresa_id: conversacion.empresa_id,
        estado:     conversacion.estado,
      });
    }

    if (texto) {
      await enviarMensajeMeta(input.canal, input.user_id, texto, input.empresa_id, teclado);
    }
  } catch (err) {
    logger.error(`[META/${input.canal.toUpperCase()}] Error procesando mensaje:`, { error: err.message });
  }
}

/**
 * Resuelve el media_id de WhatsApp a una URL de descarga autenticada.
 * WhatsApp no expone URLs directas — hay que consultar el Graph API primero.
 * @param {string} media_id   - ID del archivo de media de WhatsApp.
 * @param {string} empresa_id - Empresa a la que pertenece el media.
 * @returns {Promise<{ url: string, access_token: string }>}
 */
async function resolveWaMediaUrl(media_id, empresa_id) {
  const cfg = META_CONFIG[empresa_id];
  if (!cfg?.access_token) throw new Error(`Sin credenciales para empresa="${empresa_id}"`);

  const metaRes = await fetch(`${GRAPH_URL}/${media_id}?access_token=${cfg.access_token}`);
  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}));
    throw new Error(`WhatsApp media lookup ${metaRes.status}: ${err?.error?.message || ''}`);
  }
  const { url } = await metaRes.json();
  if (!url) throw new Error('WhatsApp no devolvió URL de descarga');

  return { url, access_token: cfg.access_token };
}

module.exports = { iniciarMeta, enviarMensajeMeta, enviarAccionEscribiendoMeta, resolveWaMediaUrl };
