const db = require('../config/db');

async function getFlujo(empresa_id) {
  const { rows } = await db.query(
    'SELECT * FROM flujos_bot WHERE empresa_id=$1 ORDER BY id LIMIT 1',
    [empresa_id]
  );
  return rows[0] || null;
}

async function upsertFlujo(empresa_id, nombre, nodos, conexiones, root_node) {
  const { rows } = await db.query(
    `INSERT INTO flujos_bot (empresa_id, nombre, nodos, conexiones, root_node, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (empresa_id, nombre)
     DO UPDATE SET nodos=$3, conexiones=$4, root_node=$5, version=flujos_bot.version+1, updated_at=NOW()
     RETURNING *`,
    [empresa_id, nombre, JSON.stringify(nodos), JSON.stringify(conexiones), root_node]
  );
  return rows[0];
}

async function listFlujos(empresa_id) {
  const { rows } = await db.query(
    'SELECT id, empresa_id, nombre, root_node, activo, version, updated_at FROM flujos_bot WHERE empresa_id=$1 ORDER BY id',
    [empresa_id]
  );
  return rows;
}

async function setActivo(id, activo) {
  const { rows } = await db.query(
    'UPDATE flujos_bot SET activo=$2, updated_at=NOW() WHERE id=$1 RETURNING *',
    [id, activo]
  );
  return rows[0];
}

module.exports = { getFlujo, upsertFlujo, listFlujos, setActivo };
