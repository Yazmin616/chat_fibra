const flujoRepo  = require('../repositories/flujo.repository');
const logger     = require('../config/logger');
const flujoSeed  = require('../bot/flujoDefault');

/** GET /flujos/:empresa_id */
async function getFlujo(req, res) {
  try {
    const { empresa_id } = req.params;
    let flujo = await flujoRepo.getFlujo(empresa_id);

    // Si no existe, retornar el seed por defecto (sin guardar en BD)
    if (!flujo) {
      return res.json({
        empresa_id,
        nombre: 'Flujo principal',
        nodos: flujoSeed.nodos,
        conexiones: flujoSeed.conexiones,
        root_node: flujoSeed.rootNodeId,
        activo: false,
        version: 0,
      });
    }
    res.json(flujo);
  } catch (err) {
    logger.error('[FLUJO] getFlujo:', err.message);
    res.status(500).json({ error: 'Error al obtener flujo' });
  }
}

/** PUT /flujos/:empresa_id */
async function saveFlujo(req, res) {
  try {
    const { empresa_id } = req.params;
    const { nombre = 'Flujo principal', nodos, conexiones, root_node = 'entrada' } = req.body;

    if (!Array.isArray(nodos) || !Array.isArray(conexiones)) {
      return res.status(400).json({ error: 'nodos y conexiones deben ser arrays' });
    }

    const flujo = await flujoRepo.upsertFlujo(empresa_id, nombre, nodos, conexiones, root_node);
    res.json(flujo);
  } catch (err) {
    logger.error('[FLUJO] saveFlujo:', err.message);
    res.status(500).json({ error: 'Error al guardar flujo' });
  }
}

/** GET /flujos/:empresa_id/lista */
async function listFlujos(req, res) {
  try {
    const rows = await flujoRepo.listFlujos(req.params.empresa_id);
    res.json(rows);
  } catch (err) {
    logger.error('[FLUJO] listFlujos:', err.message);
    res.status(500).json({ error: 'Error al listar flujos' });
  }
}

/** PATCH /flujos/:id/activo */
async function toggleActivo(req, res) {
  try {
    const row = await flujoRepo.setActivo(req.params.id, req.body.activo);
    if (!row) return res.status(404).json({ error: 'Flujo no encontrado' });
    res.json(row);
  } catch (err) {
    logger.error('[FLUJO] toggleActivo:', err.message);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
}

module.exports = { getFlujo, saveFlujo, listFlujos, toggleActivo };
