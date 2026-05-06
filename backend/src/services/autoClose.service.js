/**
 * SERVICIO DE AUTO-CIERRE POR INACTIVIDAD (MULTI-EMPRESA)
 */

const pool = require('../config/db');
const { enviarMensajeTelegram } = require('../adapters/telegram');

function iniciarAutoCierre(io) {
  console.log("[SERVICE] Tarea de auto-cierre iniciada.");
  
  setInterval(async () => {
    try {
      // 1. Buscamos todas las conversaciones que no estén cerradas
      const query = `
        SELECT c.id, u.external_id, u.canal, c.es_humano, c.empresa_id 
        FROM conversaciones c
        JOIN usuarios u ON c.usuario_id = u.id
        WHERE c.estado != 'cerrada' 
        AND c.estado NOT LIKE 'ENCUESTA%'
      `;
      const result = await pool.query(query);

      for (const conv of result.rows) {
        // 2. Para cada conversación, buscamos el tiempo de inactividad de SU empresa
        const configRes = await pool.query(
          'SELECT valor FROM configuraciones WHERE clave = $1 AND empresa_id = $2', 
          ['tiempo_inactividad', conv.empresa_id || 'fibratec']
        );
        const minutos = parseInt(configRes.rows[0]?.valor || '10');

        // 3. Verificar si el tiempo de inactividad ha expirado para esta conversación específica
        const checkInactivity = await pool.query(`
          SELECT id FROM conversaciones 
          WHERE id = $1 AND updated_at < NOW() - ($2 || ' minutes')::interval
        `, [conv.id, minutos]);

        if (checkInactivity.rows.length > 0) {
          const despedida = `El chat se ha desactivado automáticamente por inactividad. Si tiene alguna duda, puede contactarnos nuevamente. ¡Que tenga un excelente día!`;
          
          const esHumano = conv.es_humano;
          const nuevoEstado = esHumano ? 'ENCUESTA_AGENTE' : 'ENCUESTA_BOT';
          const surveySubject = esHumano ? 'asesor' : 'asistente virtual';
          const surveyText = `¿Cómo calificaría la atención de nuestro ${surveySubject}?\n\n1. Mal\n2. Regular\n3. Bien`;

          await pool.query('UPDATE conversaciones SET estado = $1, es_humano = false WHERE id = $2', [nuevoEstado, conv.id]);
          await pool.query('INSERT INTO mensajes (conversacion_id, texto, remitente) VALUES ($1, $2, $3)', [conv.id, despedida, 'bot']);
          await pool.query('INSERT INTO mensajes (conversacion_id, texto, remitente) VALUES ($1, $2, $3)', [conv.id, surveyText, 'bot']);
          await pool.query('INSERT INTO mensajes (conversacion_id, texto, remitente) VALUES ($1, $2, $3)', [conv.id, 'Cerrado por inactividad', 'sistema']);

          await enviarMensajeTelegram(conv.external_id, despedida);
          await enviarMensajeTelegram(conv.external_id, surveyText);

          io.emit('nuevo_mensaje', { conversacion_id: conv.id, mensaje: despedida, remitente: 'bot' });
          io.emit('nuevo_mensaje', { conversacion_id: conv.id, mensaje: surveyText, remitente: 'bot' });
          io.emit('nuevo_mensaje', { conversacion_id: conv.id, mensaje: 'Cerrado por inactividad', remitente: 'sistema' });
        }
      }
    } catch (error) {
      console.error("[AUTO-CLOSE SERVICE ERROR]", error);
    }
  }, 60000);
}

module.exports = { iniciarAutoCierre };
