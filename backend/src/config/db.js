/**
 * @file db.js
 * @description Configura y exporta el pool de conexiones a PostgreSQL.
 *
 * Todas las credenciales se leen desde variables de entorno (.env).
 * Si una variable no existe se usan valores de desarrollo como fallback
 * (solo válidos en local; en producción TODAS deben estar definidas en .env).
 *
 * Uso:
 *   const db = require('./config/db');
 *   const { rows } = await db.query('SELECT * FROM tabla WHERE id=$1', [id]);
 */

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'isp_chatbot',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

module.exports = pool;
