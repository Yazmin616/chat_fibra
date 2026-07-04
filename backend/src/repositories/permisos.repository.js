const db = require('../config/db');

// ── Consulta ──────────────────────────────────────────────────────────────────

async function getPermisos(usuario_id) {
  const [emp, are, mod] = await Promise.all([
    db.query('SELECT empresa_id FROM usuario_empresas WHERE usuario_id=$1 ORDER BY empresa_id', [usuario_id]),
    db.query('SELECT empresa_id, area FROM usuario_areas WHERE usuario_id=$1 ORDER BY empresa_id, area', [usuario_id]),
    db.query('SELECT modulo FROM usuario_modulos WHERE usuario_id=$1 ORDER BY modulo', [usuario_id]),
  ]);

  // Agrupar áreas por empresa
  const areasPorEmpresa = {};
  for (const row of are.rows) {
    if (!areasPorEmpresa[row.empresa_id]) areasPorEmpresa[row.empresa_id] = [];
    areasPorEmpresa[row.empresa_id].push(row.area);
  }

  return {
    empresas: emp.rows.map(r => r.empresa_id),
    areas:    Object.entries(areasPorEmpresa).map(([empresa_id, areas]) => ({ empresa_id, areas })),
    modulos:  mod.rows.map(r => r.modulo),
  };
}

// ── Asignación (reemplaza todo en transacción) ────────────────────────────────

async function setPermisos(usuario_id, { empresas, areas, modulos }, admin_id) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Borrar existentes
    await client.query('DELETE FROM usuario_empresas WHERE usuario_id=$1', [usuario_id]);
    await client.query('DELETE FROM usuario_areas    WHERE usuario_id=$1', [usuario_id]);
    await client.query('DELETE FROM usuario_modulos  WHERE usuario_id=$1', [usuario_id]);

    // Insertar empresas
    if (empresas?.length) {
      const ph = empresas.map((_, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO usuario_empresas(usuario_id, empresa_id) VALUES ${ph} ON CONFLICT DO NOTHING`,
        [usuario_id, ...empresas]
      );
    }

    // Insertar áreas
    if (areas?.length) {
      const vals = [];
      const params = [usuario_id];
      for (const { empresa_id, areas: areasArr } of areas) {
        for (const area of areasArr) {
          params.push(empresa_id, area);
          vals.push(`($1, $${params.length - 1}, $${params.length})`);
        }
      }
      if (vals.length) {
        await client.query(
          `INSERT INTO usuario_areas(usuario_id, empresa_id, area) VALUES ${vals.join(', ')} ON CONFLICT DO NOTHING`,
          params
        );
      }
    }

    // Insertar módulos
    if (modulos?.length) {
      const ph = modulos.map((_, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO usuario_modulos(usuario_id, modulo) VALUES ${ph} ON CONFLICT DO NOTHING`,
        [usuario_id, ...modulos]
      );
    }

    // Log de auditoría
    await client.query(
      `INSERT INTO permiso_log(admin_id, usuario_id, payload) VALUES($1,$2,$3)`,
      [admin_id, usuario_id, JSON.stringify({ empresas, areas, modulos })]
    );

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ── Verificaciones rápidas (usadas por middleware) ────────────────────────────

async function tieneEmpresa(usuario_id, empresa_id) {
  const { rows } = await db.query(
    `SELECT 1 FROM usuario_empresas WHERE usuario_id=$1 AND (empresa_id=$2 OR empresa_id='__todas__')`,
    [usuario_id, empresa_id]
  );
  return rows.length > 0;
}

async function tieneModulo(usuario_id, modulo) {
  const { rows } = await db.query(
    `SELECT 1 FROM usuario_modulos WHERE usuario_id=$1 AND modulo=$2`,
    [usuario_id, modulo]
  );
  return rows.length > 0;
}

// ── Log ───────────────────────────────────────────────────────────────────────

const getLog = (usuario_id) =>
  db.query(
    `SELECT pl.id, pl.payload, pl.created_at,
            a.nombre AS admin_nombre
     FROM permiso_log pl
     JOIN agentes a ON a.id = pl.admin_id
     WHERE pl.usuario_id=$1
     ORDER BY pl.created_at DESC
     LIMIT 20`,
    [usuario_id]
  );

module.exports = { getPermisos, setPermisos, tieneEmpresa, tieneModulo, getLog };
