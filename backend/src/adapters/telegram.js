/**
 * ADAPTADOR DE TELEGRAM
 * Este módulo gestiona la conexión con la API de Telegram usando la librería Telegraf.
 * Se encarga de recibir mensajes, enviarlos al core para procesarlos y devolver la respuesta al cliente.
 */

const { Telegraf } = require('telegraf');
const { coreProcesar } = require('../core/core');

let botInstance = null;

/**
 * Inicializa el bot de Telegram y define los manejadores de eventos.
 */
function iniciarTelegram() {
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
  botInstance = bot;

  // Manejador de mensajes de texto
  bot.on('text', async (ctx) => {
    try {
      // 1. Mapear datos de Telegram a un formato estándar para el Core
      const input = {
        user_id: ctx.from.id.toString(),
        canal: "telegram",
        empresa_id: "A",
        mensaje: ctx.message.text,
        tipo: "texto",
        nombre: `${ctx.from.first_name || ""} ${ctx.from.last_name || ""}`.trim(),
        username: ctx.from.username || ""
      };

      // 2. Procesar el mensaje a través del Core (Cerebro)
      const respuesta = await coreProcesar(input);

      // 3. Notificar al Dashboard vía Socket.io si existe una respuesta o cambio
      const conversacion_id = respuesta?.conversacion_id;
      if (global.io && conversacion_id) {
        // Emitir el mensaje del usuario para que aparezca en el panel del agente
        global.io.emit('nuevo_mensaje', {
          conversacion_id,
          mensaje: input.mensaje,
          remitente: 'user',
          fecha: new Date()
        });
      }

      // 4. Si el bot generó una respuesta automática, enviarla de vuelta a Telegram
      if (respuesta && respuesta.texto) {
        await ctx.reply(respuesta.texto);
      }

    } catch (error) {
      console.error("Error Telegram:", error);
    }
  });

  bot.launch();
  console.log("Bot de Telegram iniciado");
}

/**
 * Función auxiliar para enviar mensajes de forma proactiva (ej: desde el Dashboard o Auto-cierre)
 * @param {string} external_id - ID de Telegram del destinatario
 * @param {string} texto - Mensaje a enviar
 */
async function enviarMensajeTelegram(external_id, texto) {
  if (botInstance) {
    try {
      await botInstance.telegram.sendMessage(external_id, texto);
    } catch (error) {
      console.error("Error enviando mensaje proactivo Telegram:", error);
    }
  }
}

module.exports = { iniciarTelegram, enviarMensajeTelegram };