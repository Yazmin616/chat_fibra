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
      // Si es asesor, verificar si es coordinador de algún área
      const db = require('../config/db');
      const { rows: coordinatedAreas } = await db.query(
        "SELECT nombre_area FROM public.areas_soluciones WHERE coordinador_id = $1",
        [agente_id]
      );
      if (coordinatedAreas.length > 0) {
        departamento = coordinatedAreas.map(r => r.nombre_area);
      } else {
        departamento = [rows[0].area];
      }
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
      // Si es asesor, verificar si es coordinador de algún área
      const db = require('../config/db');
      const { rows: coordinatedAreas } = await db.query(
        "SELECT nombre_area FROM public.areas_soluciones WHERE coordinador_id = $1",
        [agente_id]
      );
      if (coordinatedAreas.length > 0) {
        departamento = coordinatedAreas.map(r => r.nombre_area);
      } else {
        departamento = [rows[0].area];
      }
    }
  }
  const { rows } = await infraccionRepo.countToday(empresa_id, departamento);
  return parseInt(rows[0]?.total || 0);
}

module.exports = { listar, contarHoy };
