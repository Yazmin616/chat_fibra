const repo = require('../repositories/plantillaMeta.repository');

const getAll = async (req, res, next) => {
  try {
    const empresaId = req.query.empresa_id || 'fibratec';
    const { rows } = await repo.getAll(empresaId);
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const empresaId = req.body.empresa_id || 'fibratec';
    const { nombre, categoria, idioma, estado, cuerpo, variables } = req.body;
    const { rows } = await repo.create(empresaId, nombre, categoria, idioma, estado, cuerpo, variables || []);
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const empresaId = req.body.empresa_id || 'fibratec';
    const { id } = req.params;
    const { nombre, categoria, idioma, estado, cuerpo, variables } = req.body;
    const { rows } = await repo.update(id, empresaId, nombre, categoria, idioma, estado, cuerpo, variables || []);
    if (rows.length === 0) return res.status(404).json({ error: 'Plantilla no encontrada' });
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const empresaId = req.query.empresa_id || 'fibratec';
    const { id } = req.params;
    await repo.deleteById(id, empresaId);
    res.json({ message: 'Plantilla eliminada' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll,
  create,
  update,
  remove
};
