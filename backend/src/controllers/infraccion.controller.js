const infraccionService = require('../services/infraccion.service');

const getInfracciones = async (req, res, next) => {
  try {
    const { agente_id, empresa_id } = req.query;
    const rows = await infraccionService.listar(agente_id, empresa_id);
    res.json(rows);
  } catch (err) { next(err); }
};

const getConteoHoy = async (req, res, next) => {
  try {
    const { agente_id, empresa_id } = req.query;
    const total = await infraccionService.contarHoy(agente_id, empresa_id);
    res.json({ total });
  } catch (err) { next(err); }
};

module.exports = { getInfracciones, getConteoHoy };
