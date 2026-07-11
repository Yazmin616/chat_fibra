const db = require('../config/db');
const agenteRepo = require('../repositories/agente.repository');
const conversacionRepo = require('../repositories/conversacion.repository');
const { marcarTomada } = require('./transferencia.service');
const { emitToConv } = require('../utils/rooms');

/**
 * Aplica el algoritmo de asignación equitativa (Round-Robin) a una conversación "En Espera".
 * Solo se ejecuta si la configuración `autoasignacion_equitativa` está activa para la empresa.
 * @param {number} conversacion_id
 * @param {string} empresa_id
 * @param {string} departamento
 * @param {import('socket.io').Server} [io] - Opcional, para notificar al agente asignado
 */
async function aplicarRoundRobin(conversacion_id, empresa_id, departamento, io) {
  try {
    // 1. Verificar configuración
    const { rows } = await db.query(
      `SELECT valor FROM configuraciones 
       WHERE (empresa_id = $1 OR empresa_id = 'todas') AND clave = 'autoasignacion_equitativa'
       ORDER BY CASE WHEN empresa_id = $1 THEN 0 ELSE 1 END LIMIT 1`,
      [empresa_id]
    );
    if (rows.length === 0 || rows[0].valor !== 'true') return;

    // 2. Buscar siguiente agente online de esa área
    const { rows: agRows } = await agenteRepo.getNextAgentForRoundRobin(departamento);
    if (agRows.length === 0) return; // No hay agentes online en esa área

    const agente_id = agRows[0].id;

    // 3. Asignar chat y actualizar timestamp del agente
    await conversacionRepo.assignAgente(conversacion_id, agente_id);
    await agenteRepo.updateUltimoChatAsignado(agente_id);

    // 4. Obtener nombre del agente para `marcarTomada`
    const nombreFinal = await db.query('SELECT nombre FROM agentes WHERE id=$1', [agente_id])
      .then(({ rows: [ag] }) => ag?.nombre || null)
      .catch(() => null);

    marcarTomada(conversacion_id, agente_id, nombreFinal).catch(() => {});

    // 5. Notificar al socket si está disponible
    if (io) {
      emitToConv(io, departamento, 'conversacion_actualizada', {
        id: conversacion_id,
        empresa_id,
        estado: 'atendiendo',
        agente_id
      });
    }
  } catch (error) {
    console.error('[ASIGNACION EQUITATIVA] Error al aplicar Round-Robin:', error);
  }
}

module.exports = {
  aplicarRoundRobin
};
