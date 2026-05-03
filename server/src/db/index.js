'use strict';

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let pool = null;

function isDbEnabled() {
  return Boolean(process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim());
}

function getPool() {
  return pool;
}

async function pingDb() {
  if (!pool) throw new Error('database not initialized');
  await pool.query('SELECT 1');
}

/**
 * Применить schema.sql. Без DATABASE_URL — no-op.
 * @returns {Promise<boolean>} true если БД подключена и схема применена
 */
async function initDb() {
  if (!isDbEnabled()) {
    console.log('[db] DATABASE_URL не задан — работа без БД (только вебхук и /health, фаза A).');
    return false;
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 8,
    idleTimeoutMillis: 30_000,
  });

  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
  console.log('[db] схема применена (PostgreSQL).');
  return true;
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  initDb,
  getPool,
  isDbEnabled,
  pingDb,
  closePool,
};
