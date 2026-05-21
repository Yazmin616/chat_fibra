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

const botService = require('../services/bot.service');
const usuarioRepo = require('../repositories/usuario.repository');
const conversacionRepo = require('../repositories/conversacion.repository');
const mensajeRepo = require('../repositories/mensaje.repository');
const logger = require('../config/logger');
const { emitToConv } = require('../utils/rooms');

const GRAPH_URL = 'https://graph.facebook.com/v18.0';
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'isp_chatbot_meta_verify';

// ── Mapa empresa_id → credenciales por canal ─────────────────────────────────

const META_CONFIG = {
  fibratec: {
    access_token:      process.env.META_FIBRATEC_ACCESS_TOKEN,
    whatsapp_phone_id: process.env.META_FIBRATEC_WHATSAPP_PHONE_ID,
    facebook_page_id:  process.env.META_FIBRATEC_FACEBOOK_PAGE_ID,
    instagram_id:      process.env.META_FIBRATEC_INSTAGRAM_ID,
  },
  compusemmm: {
    access_token:      process.env.META_COMPUSEMMM_ACCESS_TOKEN,
    whatsapp_phone_id: process.env.META_COMPUSEMMM_WHATSAPP_PHONE_ID,
    facebook_page_id:  process.env.META_COMPUSEMMM_FACEBOOK_PAGE_ID,
    instagram_id:      process.env.META_COMPUSEMMM_INSTAGRAM_ID,
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
  app.post('/meta/webhook', (req, res) => {
    // Meta espera 200 inmediato; procesamos de forma asíncrona
    res.sendStatus(200);
    _procesarEvento(req.body, io).catch(err =>
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
async function enviarMensajeMeta(canal, external_id, texto, empresa_id) {
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
      url  = `${GRAPH_URL}/${cfg.whatsapp_phone_id}/messages`;
      body = {
        messaging_product: 'whatsapp',
        to:                external_id,
        type:              'text',
        text:              { body: texto },
      };
    } else {
      // Messenger y Instagram usan el mismo endpoint
      url  = `${GRAPH_URL}/me/messages?access_token=${cfg.access_token}`;
      body = {
        recipient: { id: external_id },
        message:   { text: texto },
      };
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
      return false;
    }
    return true;
  } catch (err) {
    logger.error('[META SEND] Excepción:', { error: err.message });
    return false;
  }
}

/**
 * Envía indicador de escritura. Solo soportado en WhatsApp (read receipt + typing).
 * Messenger e Instagram no tienen equivalente en la API.
 */
async function enviarAccionEscribiendoMeta(canal, external_id, empresa_id) {
  if (canal !== 'whatsapp') return;
  const cfg = META_CONFIG[empresa_id];
  if (!cfg?.access_token || !cfg.whatsapp_phone_id) return;

  try {
    await fetch(`${GRAPH_URL}/${cfg.whatsapp_phone_id}/messages`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${cfg.access_token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to:                external_id,
        type:              'reaction',    // WhatsApp no tiene typing oficial; se omite silenciosamente
      }),
    });
  } catch { /* no crítico */ }
}

// ── Internos ─────────────────────────────────────────────────────────────────

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
        if (msg.type !== 'text') continue; // TODO: extender a image, audio, document

        const contact     = value.contacts?.find(c => c.wa_id === msg.from) || {};
        const nombre      = contact.profile?.name || msg.from;
        const mensajeTexto = msg.text?.body || '';

        await _enviarAlBot({
          canal:    'whatsapp',
          user_id:  msg.from,
          nombre,
          username: '',
          empresa_id,
          mensaje:  mensajeTexto,
        }, io);
      }
    }
  }
}

async function _procesarMessenger(payload, io) {
  for (const entry of payload.entry || []) {
    const empresa_id = _byPage[entry.id];
    if (!empresa_id) {
      logger.warn('[META/FB] page_id desconocido:', entry.id);
      continue;
    }

    for (const event of entry.messaging || []) {
      if (!event.message?.text) continue;

      await _enviarAlBot({
        canal:    'facebook',
        user_id:  event.sender.id,
        nombre:   event.sender.id,   // Meta no devuelve nombre en el webhook; se puede consultar Graph API
        username: '',
        empresa_id,
        mensaje:  event.message.text,
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

    for (const event of entry.messaging || []) {
      if (!event.message?.text) continue;

      await _enviarAlBot({
        canal:    'instagram',
        user_id:  event.sender.id,
        nombre:   event.sender.id,
        username: '',
        empresa_id,
        mensaje:  event.message.text,
      }, io);
    }
  }
}

/**
 * Normaliza el input de cualquier canal y lo pasa a bot.service,
 * igual que hace el adaptador de Telegram.
 */
async function _enviarAlBot(input, io) {
  try {
    // Notificar mensaje entrante al dashboard antes de procesar
    const userRes = await usuarioRepo.findByCanal(input.canal, input.user_id);
    if (userRes.rows.length > 0) {
      const convRes = await conversacionRepo.findActiveByUsuario(userRes.rows[0].id, input.empresa_id);
      if (convRes.rows.length > 0) {
        const conv = convRes.rows[0];
        emitToConv(io, conv.departamento, 'cliente_escribiendo', { conversacion_id: conv.id });

        const readRes = await mensajeRepo.marcarLeidosPorConversacion(conv.id);
        if (readRes.rowCount > 0) {
          emitToConv(io, conv.departamento, 'mensajes_leidos', {
            conversacion_id: conv.id,
            ids: readRes.rows.map(r => r.id),
          });
        }

        emitToConv(io, conv.departamento, 'nuevo_mensaje', {
          conversacion_id: conv.id,
          usuario_id:      userRes.rows[0].id,
          empresa_id:      conv.empresa_id,
          mensaje:         input.mensaje,
          tipo:            'text',
          remitente:       'user',
          fecha:           new Date(),
        });
      }
    }

    const resultado = await botService.procesar({
      ...input,
      tipo:                  'text',
      empresa_preconfigurada: true,
    }, io);

    if (resultado?.texto) {
      await enviarMensajeMeta(input.canal, input.user_id, resultado.texto, input.empresa_id);
    }
  } catch (err) {
    logger.error(`[META/${input.canal.toUpperCase()}] Error procesando mensaje:`, { error: err.message });
  }
}

module.exports = { iniciarMeta, enviarMensajeMeta, enviarAccionEscribiendoMeta };
