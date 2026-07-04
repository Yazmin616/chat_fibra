const db = require('../config/db');

const findByAgente = (agente_id) =>
  db.query(
    'SELECT * FROM respuestas_rapidas WHERE agente_id=$1 ORDER BY titulo ASC',
    [agente_id]
  );

const findById = async (id, agente_id) => {
  const { rows } = await db.query(
    'SELECT * FROM respuestas_rapidas WHERE id=$1 AND agente_id=$2',
    [id, agente_id]
  );
  return rows[0] || null;
};

const create = (agente_id, titulo, contenido, url_media = null, tipo_media = null, nombre_archivo = null) =>
  db.query(
    `INSERT INTO respuestas_rapidas (agente_id, titulo, contenido, url_media, tipo_media, nombre_archivo)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [agente_id, titulo, contenido || null, url_media, tipo_media, nombre_archivo]
  );

const update = (id, agente_id, titulo, contenido, url_media = undefined, tipo_media = undefined, nombre_archivo = undefined) => {
  // url_media === undefined means "don't change"; null means "remove media"
  if (url_media === undefined) {
    return db.query(
      'UPDATE respuestas_rapidas SET titulo=$1, contenido=$2 WHERE id=$3 AND agente_id=$4 RETURNING *',
      [titulo, contenido || null, id, agente_id]
    );
  }
  return db.query(
    `UPDATE respuestas_rapidas
     SET titulo=$1, contenido=$2, url_media=$3, tipo_media=$4, nombre_archivo=$5
     WHERE id=$6 AND agente_id=$7 RETURNING *`,
    [titulo, contenido || null, url_media, tipo_media, nombre_archivo, id, agente_id]
  );
};

const remove = (id, agente_id) =>
  db.query(
    'DELETE FROM respuestas_rapidas WHERE id=$1 AND agente_id=$2 RETURNING url_media',
    [id, agente_id]
  );

module.exports = { findByAgente, findById, create, update, remove };
