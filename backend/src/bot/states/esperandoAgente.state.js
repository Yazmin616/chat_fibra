/**
 * @file esperandoAgente.state.js
 * @description Manejador del estado ESPERANDO_AGENTE.
 *
 * El cliente ya está en la cola. Si escribe nuevamente, se le confirma
 * que su mensaje fue recibido y se le pide que no cierre la conversación.
 */

/**
 * @param {string} _mensaje
 * @param {object} conversacion
 * @returns {{ respuesta: string, nuevoEstado: string }}
 */
async function handle(_mensaje, conversacion) {
  const area = conversacion.departamento || 'nuestro equipo';
  return {
    respuesta:   `⏳ Tu solicitud está en la fila de *${area}*.\n\nNo te preocupes, un asesor revisará todos tus mensajes al conectarse. Por favor no cierres esta conversación.`,
    nuevoEstado: conversacion.estado,
  };
}

module.exports = { handle };
