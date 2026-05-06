const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'isp_chatbot',
  password: 'ch4t2026',
  port: 5433,
});

module.exports = pool;