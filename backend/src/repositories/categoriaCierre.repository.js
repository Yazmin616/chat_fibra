const db = require('../config/db');

const ORDER = `ORDER BY CASE WHEN e.area IS NULL THEN 0 ELSE 1 END, COALESCE(e.area,''), e.nombre`;

const SEL = `
  SELECT e.id, e.nombre, e.descripcion, e.color, e.area, e.activa, e.empresa_id, e.created_at,
    COALESCE(
      array_agg(DISTINCT ce.empresa_id) FILTER (WHERE ce.empresa_id IS NOT NULL),
      ARRAY[e.empresa_id]::varchar[]
    ) AS empresas
  FROM categoria_cierre e
  LEFT JOIN cat_cierre_empresas ce ON ce.cat_cierre_id = e.id
`;

const VIS = `(
  e.empresa_id = $1
  OR EXISTS (
    SELECT 1 FROM cat_cierre_empresas x
    WHERE x.cat_cierre_id = e.id AND (x.empresa_id = $1 OR x.empresa_id = '__todas__')
  )
)`;

async function _setJunction(cat_cierre_id, empresas) {
  await db.query('DELETE FROM cat_cierre_empresas WHERE cat_cierre_id=$1', [cat_cierre_id]);
  if (!empresas?.length) return;
  const ph = empresas.map((_, i) => `($1, $${i + 2})`).join(', ');
  await db.query(
    `INSERT INTO cat_cierre_empresas(cat_cierre_id, empresa_id) VALUES ${ph} ON CONFLICT DO NOTHING`,
    [cat_cierre_id, ...empresas]
  );
}

// ── ADMIN ─────────────────────────────────────────────────────────────────────

const listAll = (areaFilter) => {
  let w = '', params = [];
  if (areaFilter === '__general__')                   { w = 'WHERE e.area IS NULL'; }
  else if (areaFilter && areaFilter !== 'todas')      { w = 'WHERE e.area = $1'; params = [areaFilter]; }
  return db.query(`${SEL} ${w} GROUP BY e.id ${ORDER}`, params);
};

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
    `${SEL} WHERE ${VIS} AND e.activa=true AND (e.area IS NULL OR e.area = $2) GROUP BY e.id ${ORDER}`,
    [empresa_id, area]
  );

const searchForAgent = (empresa_id, q, area) =>
  db.query(
    `${SEL} WHERE ${VIS} AND e.activa=true AND e.nombre ILIKE $2 AND (e.area IS NULL OR e.area = $3) GROUP BY e.id ${ORDER}`,
    [empresa_id, `%${q}%`, area]
  );

// ── CRUD ──────────────────────────────────────────────────────────────────────

const create = async (empresa_id, nombre, descripcion, area, color, empresas) => {
  const { rows: [cat] } = await db.query(
    `INSERT INTO categoria_cierre(empresa_id, nombre, descripcion, area, color)
     VALUES($1,$2,$3,$4,$5) RETURNING *`,
    [empresa_id, nombre, descripcion || null, area || null, color || '#6366f1']
  );
  await _setJunction(cat.id, empresas?.length ? empresas : [empresa_id]);
  return { rows: [{ ...cat, empresas: empresas?.length ? empresas : [empresa_id] }] };
};

const update = async (id, empresa_id, nombre, descripcion, area, color, activa, empresas) => {
  const { rows } = await db.query(
    `UPDATE categoria_cierre SET nombre=$1, descripcion=$2, area=$3, color=$4, activa=$5
     WHERE id=$6 AND empresa_id=$7 RETURNING *`,
    [nombre, descripcion || null, area || null, color || '#6366f1', activa !== false, id, empresa_id]
  );
  if (!rows.length) return { rows: [] };
  await _setJunction(id, empresas?.length ? empresas : [empresa_id]);
  return { rows: [{ ...rows[0], empresas: empresas?.length ? empresas : [empresa_id] }] };
};

const remove = (id, empresa_id) =>
  db.query(`DELETE FROM categoria_cierre WHERE id=$1 AND empresa_id=$2`, [id, empresa_id]);

const findById = (id) =>
  db.query(`SELECT * FROM categoria_cierre WHERE id=$1`, [id]);

module.exports = { listAll, list, search, listForAgent, searchForAgent, create, update, remove, findById };
