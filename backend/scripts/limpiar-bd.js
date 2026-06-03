/**
 * @file limpiar-bd.js
 * @description Limpia todos los datos de chat de la BD y reinicia los
 * contadores (sequences) a 1. Conserva la tabla `agentes` (cuentas de
 * login) y `respuestas_rapidas` (configuración de agentes).
 *
 * Uso:
 *   node scripts/limpiar-bd.js
 */

require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'isp_chatbot',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function limpiar() {
  const client = await pool.connect();
  try {
    console.log('⚠️  Iniciando limpieza de base de datos...\n');

    await client.query('BEGIN');

    // TRUNCATE en orden para respetar FKs.
    // RESTART IDENTITY reinicia los contadores (sequences) a 1.
    // CASCADE elimina registros dependientes automáticamente.
    await client.query(`
      TRUNCATE TABLE
        mensajes,
        calificaciones,
        infracciones,
        conversaciones,
        usuarios
      RESTART IDENTITY CASCADE
    `);

    await client.query('COMMIT');

    console.log('✅  Tablas limpiadas y contadores reiniciados a 1:');
    console.log('     - usuarios');
    console.log('     - conversaciones');
    console.log('     - mensajes');
    console.log('     - calificaciones');
    console.log('     - infracciones');
    console.log('\n🔒  Conservadas sin cambios:');
    console.log('     - agentes          (cuentas de login)');
    console.log('     - respuestas_rapidas (configuración de agentes)');
    console.log('     - migrations       (historial de migraciones)');
    console.log('\n✔   Base de datos lista.\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Error durante la limpieza:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

limpiar();
