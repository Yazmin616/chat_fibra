/**
 * @file runMigrations.js
 * @description Runner de migraciones como módulo reutilizable.
 * Se usa desde index.js al arrancar el servidor.
 * El script migrate.js (npm run migrate) sigue funcionando independientemente.
 */

const fs   = require('fs');
const path = require('path');
const db   = require('./db');
const logger = require('./logger');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function runMigrations() {
  const client = await db.connect();
  try {
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

    let aplicadas = 0;
    for (const file of files) {
      const { rowCount } = await client.query(
        'SELECT 1 FROM migrations WHERE filename=$1', [file]
      );
      if (rowCount > 0) continue;

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
      logger.info(`[DB] Migración aplicada: ${file}`);
      aplicadas++;
    }

    if (aplicadas === 0) {
      logger.info('[DB] Base de datos al día. Sin migraciones pendientes.');
    }
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
