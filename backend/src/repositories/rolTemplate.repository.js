const db = require('../config/db');

const getAll = () =>
  db.query(
    `SELECT rol, empresas, areas, modulos, updated_by, updated_at
     FROM rol_permisos_template
     ORDER BY rol`
  );

const getByRol = (rol) =>
  db.query(
    `SELECT rol, empresas, areas, modulos
     FROM rol_permisos_template WHERE rol=$1`,
    [rol]
  );

async function upsert(rol, { empresas, areas, modulos }, admin_id) {
  const { rows } = await db.query(
    `INSERT INTO rol_permisos_template(rol, empresas, areas, modulos, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (rol) DO UPDATE
       SET empresas   = EXCLUDED.empresas,
           areas      = EXCLUDED.areas,
           modulos    = EXCLUDED.modulos,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
     RETURNING *`,
    [rol, JSON.stringify(empresas), JSON.stringify(areas), JSON.stringify(modulos), admin_id]
  );
  // Auditoría: usuario_id = NULL indica cambio en plantilla de rol (no en usuario específico)
  await db.query(
    `INSERT INTO permiso_log(admin_id, usuario_id, payload)
     VALUES ($1, NULL, $2)`,
    [admin_id, JSON.stringify({ accion: 'actualizar_plantilla_rol', rol, empresas, areas, modulos })]
  );
  return rows[0];
}

// Aplica la plantilla del rol a TODOS los agentes que lo tienen.
// Devuelve los IDs afectados para que el controller emita Socket.IO.
async function applyToRole(rol, admin_id) {
  const tplRes = await getByRol(rol);
  if (!tplRes.rows.length) throw new Error(`No existe plantilla para el rol "${rol}"`);

  const tpl = tplRes.rows[0];
  const agentesRes = await db.query('SELECT id FROM agentes WHERE rol=$1', [rol]);

  const permisosRepo = require('./permisos.repository');
  for (const row of agentesRes.rows) {
    await permisosRepo.setPermisos(
      row.id,
      { empresas: tpl.empresas, areas: tpl.areas, modulos: tpl.modulos },
      admin_id
    );
  }
  return agentesRes.rows.map(r => r.id);
}

module.exports = { getAll, getByRol, upsert, applyToRole };
