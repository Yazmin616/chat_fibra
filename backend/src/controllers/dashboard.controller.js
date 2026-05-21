const dashboardService = require('../services/dashboard.service');

const getKpis = async (req, res, next) => {
  try {
    const { agente_id, empresa_id, filtro_agente_id, filtro_area } = req.query;
    const data = await dashboardService.getKpis(agente_id, empresa_id, filtro_agente_id, filtro_area);
    res.json(data);
  } catch (err) { next(err); }
};

const getCalificaciones = async (req, res, next) => {
  try {
    const { agente_id, empresa_id, filtro_agente_id, filtro_area } = req.query;
    const rows = await dashboardService.getCalificaciones(agente_id, empresa_id, filtro_agente_id, filtro_area);
    res.json(rows);
  } catch (err) { next(err); }
};

const getAgenteStats = async (req, res, next) => {
  try {
    const data = await dashboardService.getAgenteStats(req.params.id);
    res.json(data);
  } catch (err) { next(err); }
};

module.exports = { getKpis, getCalificaciones, getAgenteStats };
