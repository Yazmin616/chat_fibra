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
      const usuario = await obtenerOcrearUsuario(input.canal, input.user_id, input.nombre, input.username);
      const conversacion = await obtenerOcrearConversacion(usuario.id, input.empresa_id);

      // 2. NOTIFICAR AL DASHBOARD INMEDIATAMENTE
      if (global.io) {
        global.io.emit('nuevo_mensaje', {
          conversacion_id: conversacion.id,
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
            conversacion_id: conversacion.id,
            mensaje: respuesta.texto,
            remitente: 'bot',
            fecha: new Date()
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