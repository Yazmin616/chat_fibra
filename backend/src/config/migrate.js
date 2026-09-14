/**
 * @file migrate.js
 * @description Runner de migraciones SQL. Aplica cada archivo .sql en orden
 * numérico y registra en la tabla `migrations` los que ya fueron ejecutados
 * (idempotente: nunca aplica la misma migración dos veces).
 *
 * Uso:
 *   node src/config/migrate.js
 *   npm run migrate          (alias en package.json)
 */

require('dotenv').config();

const { Pool }  = require('pg');
const fs        = require('fs');
const path      = require('path');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'isp_chatbot',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function run() {
  const client = await pool.connect();
  try {
    // Crear tabla de control si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id         SERIAL PRIMARY KEY,
        filename   VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rowCount } = await client.query(
        'SELECT 1 FROM migrations WHERE filename=$1', [file]
      );
      if (rowCount > 0) {
        console.log(`[migrate] ya aplicada: ${file}`);
        continue;
      }

      const rawSql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const sql = rawSql.replace(/^\uFEFF/, '').trim();
      if (!sql) continue;
      console.log(`[migrate] aplicando:   ${file} ...`);
      await client.query(sql);
      await client.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
      console.log(`[migrate] OK:          ${file}`);
    }

    console.log('[migrate] Todas las migraciones al día.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('[migrate] ERROR:', err.message);
  process.exit(1);
});
