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

const getNpsStats = async (req, res, next) => {
  try {
    const { empresa_id } = req.query;
    const agente_id = req.agente?.id;
    const rows = await dashboardService.getNpsStats(empresa_id, agente_id);
    res.json(rows);
  } catch (err) { next(err); }
};

const getSolucionesStaff = async (req, res, next) => {
  try {
    const { empresa_id, area, agente_id: filtro_agente, desde, hasta, q, page, limit } = req.query;
    const solicitante_id = req.agente?.id;
    const rows = await dashboardService.getSolucionesStaff({
      solicitante_id,
      empresa_id,
      area,
      filtro_agente,
      desde,
      hasta,
      q,
      page:  parseInt(page  || 1),
      limit: parseInt(limit || 50),
    });
    res.json(rows);
  } catch (err) { next(err); }
};

module.exports = { getKpis, getCalificaciones, getAgenteStats, getNpsStats, getSolucionesStaff };

