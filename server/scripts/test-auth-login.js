'use strict';

/**
 * Проверка POST /auth/login без PowerShell/curl (обходит кавычки и кодировки).
 * Переменные в server/.env — см. .env.example (AUTH_TEST_*).
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  let base = (process.env.AUTH_TEST_BASE || '').trim().replace(/\/+$/, '');
  const login = (process.env.AUTH_TEST_LOGIN || process.env.SEED_ADMIN_LOGIN || 'admin').trim();
  const password = (process.env.AUTH_TEST_PASSWORD || process.env.SEED_ADMIN_PASSWORD || '').trim();

  if (!base) {
    console.error(
      'Задайте в server/.env:\n' +
        '  AUTH_TEST_BASE=https://ваш-домен.up.railway.app\n' +
        '  AUTH_TEST_LOGIN=логин_как_в_БД\n' +
        '  AUTH_TEST_PASSWORD=пароль\n' +
        'Если не задать LOGIN/PASSWORD — возьмутся SEED_ADMIN_LOGIN / SEED_ADMIN_PASSWORD (как при сиде).'
    );
    process.exit(1);
  }

  if (!password) {
    console.error('Нужны AUTH_TEST_PASSWORD или SEED_ADMIN_PASSWORD в server/.env');
    process.exit(1);
  }

  if (!base.startsWith('http://') && !base.startsWith('https://')) {
    base = `https://${base}`;
  }

  const url = `${base}/auth/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ login, password }),
  });
  const text = await res.text();
  console.log('URL:', url);
  console.log('login:', login);
  console.log('HTTP', res.status);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.log(text);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
  if (!res.ok) {
    if (data.error === 'invalid_credentials') {
      console.error(
        '\nПодсказка: логин в запросе должен совпадать с тем, что в таблице users (часто это SEED_ADMIN_LOGIN на момент npm run db:seed). Если сидили с логином не admin — в теле нельзя слать admin.'
      );
    }
    process.exit(1);
  }
  console.log('\nОК: токен получен (поле token выше).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
