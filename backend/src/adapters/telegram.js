/**
 * ADAPTADOR DE TELEGRAM (CORREGIDO TIEMPO REAL)
 */

const { Telegraf } = require('telegraf');
const { coreProcesar } = require('../core/core');
const { obtenerOcrearUsuario, obtenerOcrearConversacion } = require('../core/conversaciones');

let botInstance = null;

function iniciarTelegram() {
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
  botInstance = bot;

  bot.on('text', async (ctx) => {
    try {
      const input = {
        user_id: ctx.from.id.toString(),
        canal: "telegram",
        empresa_id: "fibratec", // Por defecto inicial
        mensaje: ctx.message.text,
        nombre: `${ctx.from.first_name || ""} ${ctx.from.last_name || ""}`.trim(),
        username: ctx.from.username || ""
      };

      // 1. Obtener datos básicos para el Socket (Incluso si el bot no responde)
      const usuario = await obtenerOcrearUsuario(input.canal, input.user_id, input.nombre, input.username, null);
      const conversacion = await obtenerOcrearConversacion(usuario.id, input.empresa_id);

      // 2. NOTIFICAR AL DASHBOARD INMEDIATAMENTE
      if (global.io) {
        global.io.emit('nuevo_mensaje', {
          conversacion_id: conversacion.id,
          usuario_id: usuario.id,
          empresa_id: conversacion.empresa_id,
          mensaje: input.mensaje,
          remitente: 'user',
          fecha: new Date()
        });
      }

      // 3. Procesar lógica del Bot (Cerebro)
      const respuesta = await coreProcesar(input);

      // 4. Si el bot generó respuesta, enviarla y notificar
      if (respuesta && respuesta.texto) {
        await ctx.reply(respuesta.texto);
        
        if (global.io) {
          global.io.emit('nuevo_mensaje', {
            conversacion_id: respuesta.conversacion_id || conversacion.id,
            usuario_id: usuario.id,
            empresa_id: conversacion.empresa_id,
            mensaje: respuesta.texto,
            remitente: 'bot',
            fecha: new Date()
          });
        }
      }

      // 5. Si el core devolvió una conversación DIFERENTE (nueva, de área), notificar al dashboard
      // Esto pasa cuando el cliente elige área: se crea una nueva conv y la vieja se cierra
      if (respuesta && respuesta.conversacion_id && respuesta.conversacion_id !== conversacion.id) {
        if (global.io) {
          global.io.emit('conversacion_actualizada', {
            id: respuesta.conversacion_id,
            empresa_id: conversacion.empresa_id,
            estado: 'ESPERANDO_AGENTE'
          });
        }
      }

    } catch (error) {
      console.error("Error Telegram:", error);
    }
  });

  bot.launch();
  console.log("Bot de Telegram iniciado");
}

async function enviarMensajeTelegram(external_id, texto) {
  if (botInstance) {
    try {
      await botInstance.telegram.sendMessage(external_id, texto);
    } catch (error) {
      console.error("Error enviando mensaje Telegram:", error);
    }
  }
}

module.exports = { iniciarTelegram, enviarMensajeTelegram };