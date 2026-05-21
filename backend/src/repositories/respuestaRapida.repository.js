const db = require('../config/db');

const findByAgente = (agente_id) =>
  db.query(
    'SELECT * FROM respuestas_rapidas WHERE agente_id=$1 ORDER BY titulo ASC',
    [agente_id]
  );

const create = (agente_id, titulo, contenido) =>
  db.query(
    'INSERT INTO respuestas_rapidas (agente_id, titulo, contenido) VALUES ($1,$2,$3) RETURNING *',
    [agente_id, titulo, contenido]
  );

const update = (id, agente_id, titulo, contenido) =>
  db.query(
    'UPDATE respuestas_rapidas SET titulo=$1, contenido=$2 WHERE id=$3 AND agente_id=$4 RETURNING *',
    [titulo, contenido, id, agente_id]
  );

const remove = (id, agente_id) =>
  db.query(
    'DELETE FROM respuestas_rapidas WHERE id=$1 AND agente_id=$2',
    [id, agente_id]
  );

module.exports = { findByAgente, create, update, remove };
