'use strict';

/**
 * Создаёт или обновляет администратора (логин + пароль).
 * Usage: задайте DATABASE_URL, SEED_ADMIN_PASSWORD в server/.env, затем npm run db:seed
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const fs = require('fs');
const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Нужен DATABASE_URL в .env');
    process.exit(1);
  }
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || String(password).length < 8) {
    console.error('Задайте SEED_ADMIN_PASSWORD в .env (не короче 8 символов).');
    process.exit(1);
  }

  const login = (process.env.SEED_ADMIN_LOGIN || 'admin').trim();
  const displayName = (process.env.SEED_ADMIN_DISPLAY_NAME || 'Администратор').trim();
  const hash = bcrypt.hashSync(password, 10);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const schemaPath = path.join(__dirname, '..', 'src', 'db', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schemaSql);
    console.log('Схема БД применена (если ещё не была).');

    await pool.query(
      `INSERT INTO users (login, password_hash, display_name, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (login) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         display_name = EXCLUDED.display_name,
         updated_at = now()`,
      [login, hash, displayName]
    );
    console.log('Готово: пользователь', login, '(роль admin). Вход: POST /auth/login');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
