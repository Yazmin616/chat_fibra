const plantillasService = require('../services/plantillas.service');

async function getPlantillas(req, res) {
  try {
    const { empresa_id } = req.query;
    const eid = (empresa_id && empresa_id !== 'todas') ? empresa_id : 'fibratec';
    
    const plantillas = await plantillasService.getAllTemplates(eid);
    res.json(plantillas);
  } catch (err) {
    console.error('[Plantillas Controller] Error al obtener plantillas:', err);
    res.status(500).json({ error: 'Error al obtener plantillas' });
  }
}

async function savePlantilla(req, res) {
  try {
    const { clave } = req.params;
    const { texto, empresa_id } = req.body;
    const eid = (empresa_id && empresa_id !== 'todas') ? empresa_id : 'fibratec';
    
    if (texto === undefined) {
      return res.status(400).json({ error: 'El campo "texto" es requerido' });
    }
    
    await plantillasService.saveTemplate(eid, clave, texto);
    res.json({ message: 'Plantilla guardada exitosamente' });
  } catch (err) {
    console.error(`[Plantillas Controller] Error al guardar plantilla ${req.params.clave}:`, err);
    res.status(400).json({ error: err.message || 'Error al guardar plantilla' });
  }
}

module.exports = {
  getPlantillas,
  savePlantilla
};
