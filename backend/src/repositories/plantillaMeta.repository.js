const db = require('../config/db');

const getAll = (empresaId) => 
  db.query('SELECT * FROM plantillas_meta WHERE empresa_id = $1 ORDER BY nombre ASC', [empresaId]);

const getById = (id, empresaId) =>
  db.query('SELECT * FROM plantillas_meta WHERE id = $1 AND empresa_id = $2', [id, empresaId]);

const create = (empresaId, nombre, categoria, idioma, estado, cuerpo, variables) =>
  db.query(
    `INSERT INTO plantillas_meta (empresa_id, nombre, categoria, idioma, estado, cuerpo, variables)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [empresaId, nombre, categoria, idioma, estado, cuerpo, JSON.stringify(variables)]
  );

const update = (id, empresaId, nombre, categoria, idioma, estado, cuerpo, variables) =>
  db.query(
    `UPDATE plantillas_meta
     SET nombre = $1, categoria = $2, idioma = $3, estado = $4, cuerpo = $5, variables = $6
     WHERE id = $7 AND empresa_id = $8 RETURNING *`,
    [nombre, categoria, idioma, estado, cuerpo, JSON.stringify(variables), id, empresaId]
  );

const deleteById = (id, empresaId) =>
  db.query('DELETE FROM plantillas_meta WHERE id = $1 AND empresa_id = $2', [id, empresaId]);

module.exports = {
  getAll,
  getById,
  create,
  update,
  deleteById
};
