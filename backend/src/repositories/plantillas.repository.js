const db = require('../config/db');

async function findAll(empresa_id) {
  const q = `
    SELECT clave, texto, descripcion
    FROM plantillas_bot
    WHERE empresa_id = $1
    ORDER BY clave ASC
  `;
  return db.query(q, [empresa_id]);
}

async function findByClave(empresa_id, clave) {
  const q = `
    SELECT texto
    FROM plantillas_bot
    WHERE empresa_id = $1 AND clave = $2
  `;
  return db.query(q, [empresa_id, clave]);
}

async function upsert(empresa_id, clave, texto, descripcion = null) {
  const q = `
    INSERT INTO plantillas_bot (empresa_id, clave, texto, descripcion, updated_at)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    ON CONFLICT (empresa_id, clave) DO UPDATE
    SET texto = EXCLUDED.texto,
        descripcion = COALESCE(EXCLUDED.descripcion, plantillas_bot.descripcion),
        updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  return db.query(q, [empresa_id, clave, texto, descripcion]);
}

async function deleteByClave(empresa_id, clave) {
  const q = `
    DELETE FROM plantillas_bot
    WHERE empresa_id = $1 AND clave = $2
  `;
  return db.query(q, [empresa_id, clave]);
}

module.exports = {
  findAll,
  findByClave,
  upsert,
  deleteByClave
};
