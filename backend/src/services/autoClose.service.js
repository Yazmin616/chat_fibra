/**
 * SERVICIO DE AUTO-CIERRE POR INACTIVIDAD
 * Este servicio corre en segundo plano y monitorea las conversaciones
 * para cerrarlas si el cliente o el agente dejan de escribir por mucho tiempo.
 */

const pool = require('../config/db');
const { enviarMensajeTelegram } = require('../adapters/telegram');

/**
 * Inicia el intervalo de revisión de inactividad.
 * @param {Object} io - Instancia de Socket.io para notificar al dashboard.
 */
function iniciarAutoCierre(io) {
  console.log("[SERVICE] Tarea de auto-cierre iniciada.");
  
  // Ejecutar cada 60 segundos
  setInterval(async () => {
    try {
      // 1. Consultar el tiempo de inactividad configurado por el usuario (desde la tabla configuraciones)
      const configRes = await pool.query('SELECT valor FROM configuraciones WHERE clave = $1', ['tiempo_inactividad']);
      const minutos = parseInt(configRes.rows[0]?.valor || '10');

      // 2. Buscar conversaciones que:
      // - No estén cerradas.
      // - No estén esperando respuesta de encuesta (para no interrumpir el CSAT).
      // - Su última actualización (updated_at) sea mayor a X minutos.
      const query = `
        SELECT c.id, u.external_id, u.canal, c.es_humano 
        FROM conversaciones c
        JOIN usuarios u ON c.usuario_id = u.id
        WHERE c.estado != 'cerrada' 
        AND c.estado NOT LIKE 'ENCUESTA%'
        AND c.updated_at < NOW() - ($1 || ' minutes')::interval
      `;
      const result = await pool.query(query, [minutos]);

      for (const conv of result.rows) {
        // Mensaje cordial de despedida por inactividad
        const despedida = `El chat es desactivado automáticamente después de ${minutos} min de inactividad. Daremos finalizado el chat, si tiene alguna duda con gusto puede contarnos nuevamente, ¡Que tenga excelente día!`;
        
        // Determinar si evaluará a un asesor humano o al bot virtual
        const esHumano = conv.es_humano;
        const nuevoEstado = esHumano ? 'ENCUESTA_AGENTE' : 'ENCUESTA_BOT';
        const surveySubject = esHumano ? 'asesor' : 'asistente virtual';
        const surveyText = `¿Cómo calificaría la atención de nuestro ${surveySubject}? 🌟\n\nResponda con un número:\n1️⃣ Mal\n2️⃣ Regular\n3️⃣ Bien`;

        // 3. ACTUALIZAR BASE DE DATOS
        // Cambiamos estado a ENCUESTA_... para que el core espere la calificación
        await pool.query('UPDATE conversaciones SET estado = $1, es_humano = false WHERE id = $2', [nuevoEstado, conv.id]);
        
        // Guardar logs de los mensajes de despedida
        await pool.query('INSERT INTO mensajes (conversacion_id, texto, remitente) VALUES ($1, $2, $3)', [conv.id, despedida, 'bot']);
        await pool.query('INSERT INTO mensajes (conversacion_id, texto, remitente) VALUES ($1, $2, $3)', [conv.id, surveyText, 'bot']);
        await pool.query('INSERT INTO mensajes (conversacion_id, texto, remitente) VALUES ($1, $2, $3)', [conv.id, 'Cerrado por inactividad', 'sistema']);

        // 4. ENVÍO REAL AL CLIENTE (Telegram)
        await enviarMensajeTelegram(conv.external_id, despedida);
        await enviarMensajeTelegram(conv.external_id, surveyText);

        // 5. NOTIFICAR AL DASHBOARD (Socket.io)
        // Esto permite que el agente vea el cierre en tiempo real sin recargar
        io.emit('nuevo_mensaje', { conversacion_id: conv.id, mensaje: despedida, remitente: 'bot' });
        io.emit('nuevo_mensaje', { conversacion_id: conv.id, mensaje: surveyText, remitente: 'bot' });
        io.emit('nuevo_mensaje', { conversacion_id: conv.id, mensaje: 'Cerrado por inactividad', remitente: 'sistema' });
      }
    } catch (error) {
      console.error("[AUTO-CLOSE SERVICE ERROR]", error);
    }
  }, 60000);
}

module.exports = { iniciarAutoCierre };
