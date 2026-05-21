const infraccionRepo = require('../repositories/infraccion.repository');
const agenteRepo     = require('../repositories/agente.repository');

/**
 * Lista infracciones filtradas por rol:
 *   - Admin: ve todas (opcionalmente filtradas por empresa).
 *   - Asesor: solo ve las de su área.
 */
async function listar(agente_id, empresa_id) {
  let departamento = null;
  if (agente_id) {
    const { rows } = await agenteRepo.findById(agente_id);
    if (rows.length > 0 && rows[0].rol !== 'admin') {
      departamento = rows[0].area;
    }
  }
  const { rows } = await infraccionRepo.findAll(empresa_id, departamento);
  return rows;
}

/**
 * Cuenta las infracciones de hoy (para badge en sidebar).
 */
async function contarHoy(agente_id, empresa_id) {
  let departamento = null;
  if (agente_id) {
    const { rows } = await agenteRepo.findById(agente_id);
    if (rows.length > 0 && rows[0].rol !== 'admin') {
      departamento = rows[0].area;
    }
  }
  const { rows } = await infraccionRepo.countToday(empresa_id, departamento);
  return parseInt(rows[0]?.total || 0);
}

module.exports = { listar, contarHoy };
