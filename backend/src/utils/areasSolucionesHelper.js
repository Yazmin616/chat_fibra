const db = require('../config/db');

async function getAreasSolucionesText(empresaId) {
  try {
    const eid = (empresaId && empresaId !== 'todas') ? empresaId : 'fibratec';
    const { rows } = await db.query(
      `SELECT * FROM public.areas_soluciones WHERE (empresa_id ? $1 OR empresa_id ? 'todas') AND activo = true ORDER BY id ASC`,
      [eid]
    );

    if (rows.length === 0) return '';

    let text = '\n';
    rows.forEach(area => {
      text += `\n*${area.nombre_area}*:\n`;
      if (area.descripcion) text += `${area.descripcion}\n`;
      if (area.soluciones && area.soluciones.length > 0) {
        area.soluciones.forEach(sol => {
          text += `• ${sol}\n`;
        });
      }
    });

    return text;
  } catch (err) {
    console.error('Error fetching areas soluciones:', err);
    return '';
  }
}

module.exports = {
  getAreasSolucionesText
};
