const db = require('../config/db');

const ORDER = `ORDER BY CASE WHEN e.area IS NULL THEN 0 ELSE 1 END, COALESCE(e.area,''), e.nombre`;

// Fragmento SELECT base — siempre incluye el array de empresas asignadas
const SEL = `
  SELECT e.id, e.nombre, e.descripcion, e.color, e.area, e.empresa_id, e.created_at,
    COALESCE(
      array_agg(DISTINCT ee.empresa_id) FILTER (WHERE ee.empresa_id IS NOT NULL),
      ARRAY[e.empresa_id]::varchar[]
    ) AS empresas
  FROM etiquetas e
  LEFT JOIN etiqueta_empresas ee ON ee.etiqueta_id = e.id
`;

// Cláusula de visibilidad: owned by OR junction matches (sentinela '__todas__' = todas)
// $1 siempre = empresa_id
const VIS = `(
  e.empresa_id = $1
  OR EXISTS (
    SELECT 1 FROM etiqueta_empresas x
    WHERE x.etiqueta_id = e.id AND (x.empresa_id = $1 OR x.empresa_id = '__todas__')
  )
)`;

// Insertar (o reemplazar) filas en la junction table
async function _setJunction(etiqueta_id, empresas) {
  await db.query('DELETE FROM etiqueta_empresas WHERE etiqueta_id=$1', [etiqueta_id]);
  if (!empresas?.length) return;
  const ph = empresas.map((_, i) => `($1, $${i + 2})`).join(', ');
  await db.query(
    `INSERT INTO etiqueta_empresas(etiqueta_id, empresa_id) VALUES ${ph} ON CONFLICT DO NOTHING`,
    [etiqueta_id, ...empresas]
  );
}

// ── ADMIN ─────────────────────────────────────────────────────────────────────

// Sin filtro de empresa (admin ve todo)
const listAll = (areaFilter) => {
  let w = '', params = [];
  if (areaFilter === '__general__')          { w = 'WHERE e.area IS NULL'; }
  else if (areaFilter && areaFilter !== 'todas') { w = 'WHERE e.area = $1'; params = [areaFilter]; }
  return db.query(`${SEL} ${w} GROUP BY e.id ${ORDER}`, params);
};

// Filtrado por visibilidad para una empresa concreta
const list = (empresa_id, areaFilter) => {
  const params = [empresa_id];
  let areaClause = '';
  if (areaFilter === '__general__') {
    areaClause = ' AND e.area IS NULL';
  } else if (areaFilter && areaFilter !== 'todas') {
    params.push(areaFilter);
    areaClause = ` AND e.area = $${params.length}`;
  }
  return db.query(`${SEL} WHERE ${VIS}${areaClause} GROUP BY e.id ${ORDER}`, params);
};

const search = (empresa_id, q, areaFilter) => {
  const params = [empresa_id, `%${q}%`];
  let areaClause = '';
  if (areaFilter === '__general__') {
    areaClause = ' AND e.area IS NULL';
  } else if (areaFilter && areaFilter !== 'todas') {
    params.push(areaFilter);
    areaClause = ` AND e.area = $${params.length}`;
  }
  return db.query(
    `${SEL} WHERE ${VIS} AND e.nombre ILIKE $2${areaClause} GROUP BY e.id ${ORDER}`,
    params
  );
};

// ── AGENTE ────────────────────────────────────────────────────────────────────

const listForAgent = (empresa_id, area) =>
  db.query(
    `${SEL} WHERE ${VIS} AND (e.area IS NULL OR e.area = $2) GROUP BY e.id ${ORDER}`,
    [empresa_id, area]
  );

const searchForAgent = (empresa_id, q, area) =>
  db.query(
    `${SEL} WHERE ${VIS} AND e.nombre ILIKE $2 AND (e.area IS NULL OR e.area = $3) GROUP BY e.id ${ORDER}`,
    [empresa_id, `%${q}%`, area]
  );

const listForAgentMulti = (empresas, area) => {
  const ph = empresas.map((_, i) => `$${i + 1}`).join(', ');
  const queryStr = `
    ${SEL}
    WHERE (
      e.empresa_id IN (${ph})
      OR EXISTS (
        SELECT 1 FROM etiqueta_empresas x
        WHERE x.etiqueta_id = e.id AND (x.empresa_id IN (${ph}) OR x.empresa_id = '__todas__')
      )
    )
    AND (e.area IS NULL OR e.area = $${empresas.length + 1})
    GROUP BY e.id
    ${ORDER}
  `;
  return db.query(queryStr, [...empresas, area]);
};

const searchForAgentMulti = (empresas, q, area) => {
  const ph = empresas.map((_, i) => `$${i + 1}`).join(', ');
  const queryStr = `
    ${SEL}
    WHERE (
      e.empresa_id IN (${ph})
      OR EXISTS (
        SELECT 1 FROM etiqueta_empresas x
        WHERE x.etiqueta_id = e.id AND (x.empresa_id IN (${ph}) OR x.empresa_id = '__todas__')
      )
    )
    AND e.nombre ILIKE $${empresas.length + 1}
    AND (e.area IS NULL OR e.area = $${empresas.length + 2})
    GROUP BY e.id
    ${ORDER}
  `;
  return db.query(queryStr, [...empresas, `%${q}%`, area]);
};

// ── CRUD ──────────────────────────────────────────────────────────────────────

const create = async (empresa_id, nombre, descripcion, color, area, empresas) => {
  const { rows: [etq] } = await db.query(
    `INSERT INTO etiquetas(empresa_id, nombre, descripcion, color, area)
     VALUES($1,$2,$3,$4,$5) RETURNING *`,
    [empresa_id, nombre, descripcion || null, color, area || null]
  );
  await _setJunction(etq.id, empresas?.length ? empresas : [empresa_id]);
  return { rows: [{ ...etq, empresas: empresas?.length ? empresas : [empresa_id] }] };
};

const update = async (id, empresa_id, nombre, descripcion, color, area, empresas) => {
  const { rows } = await db.query(
    `UPDATE etiquetas SET nombre=$1, descripcion=$2, color=$3, area=$4
     WHERE id=$5 AND empresa_id=$6 RETURNING *`,
    [nombre, descripcion || null, color, area || null, id, empresa_id]
  );
  if (!rows.length) return { rows: [] };
  await _setJunction(id, empresas?.length ? empresas : [empresa_id]);
  return { rows: [{ ...rows[0], empresas: empresas?.length ? empresas : [empresa_id] }] };
};

const remove = (id, empresa_id) =>
  db.query(`DELETE FROM etiquetas WHERE id=$1 AND empresa_id=$2`, [id, empresa_id]);

// ── CONVERSACIÓN ─────────────────────────────────────────────────────────────

const getByConversacion = (conversacion_id) =>
  db.query(
    `SELECT e.id, e.nombre, e.color, e.descripcion, e.area, ce.asignada_at, ce.asignada_por
     FROM conversacion_etiquetas ce
     JOIN etiquetas e ON e.id = ce.etiqueta_id
     WHERE ce.conversacion_id = $1
     ORDER BY e.nombre`,
    [conversacion_id]
  );

const assign = (conversacion_id, etiqueta_id, asignada_por) =>
  db.query(
    `INSERT INTO conversacion_etiquetas(conversacion_id, etiqueta_id, asignada_por)
     VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
    [conversacion_id, etiqueta_id, asignada_por || null]
  );

const unassign = (conversacion_id, etiqueta_id) =>
  db.query(
    `DELETE FROM conversacion_etiquetas WHERE conversacion_id=$1 AND etiqueta_id=$2`,
    [conversacion_id, etiqueta_id]
  );

module.exports = {
  listAll, list, search, listForAgent, searchForAgent, listForAgentMulti, searchForAgentMulti,
  create, update, remove,
  getByConversacion, assign, unassign,
};
