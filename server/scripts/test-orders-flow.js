'use strict';

/**
 * Логин → GET /orders → при наличии заказов GET /orders/:id и POST /orders/:id/claim.
 * База URL: AUTH_TEST_BASE или корень из MOYSKLAD_WEBHOOK_URL.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function resolveApiBase() {
  let b = (process.env.AUTH_TEST_BASE || '').trim().replace(/\/+$/, '');
  if (b) {
    return b.startsWith('http://') || b.startsWith('https://') ? b : `https://${b}`;
  }
  const w = (process.env.MOYSKLAD_WEBHOOK_URL || '').trim();
  if (w) {
    try {
      const u = new URL(w);
      return `${u.protocol}//${u.host}`;
    } catch {
      /* ignore */
    }
  }
  return '';
}

async function login(base, login, password) {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ login, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`login HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  return data.token;
}

async function api(base, token, method, pathname) {
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { _raw: text.slice(0, 500) };
  }
  return { res, data };
}

async function main() {
  const base = resolveApiBase();
  const loginStr = (process.env.AUTH_TEST_LOGIN || process.env.SEED_ADMIN_LOGIN || 'admin').trim();
  const password = (process.env.AUTH_TEST_PASSWORD || process.env.SEED_ADMIN_PASSWORD || '').trim();

  if (!base) {
    console.error('Нужен AUTH_TEST_BASE или MOYSKLAD_WEBHOOK_URL в server/.env');
    process.exit(1);
  }
  if (!password) {
    console.error('Нужен AUTH_TEST_PASSWORD или SEED_ADMIN_PASSWORD');
    process.exit(1);
  }

  console.log('API base:', base);
  const token = await login(base, loginStr, password);
  console.log('login: OK (JWT получен, длина', String(token).length, 'симв.)');

  const list = await api(base, token, 'GET', '/orders');
  console.log('GET /orders → HTTP', list.res.status);
  if (!list.res.ok) {
    console.log(JSON.stringify(list.data, null, 2));
    process.exit(list.res.status === 503 && list.data.error === 'moysklad_not_configured' ? 2 : 1);
  }

  const orders = list.data.orders || [];
  console.log('orders.length:', orders.length);
  if (orders.length === 0) {
    console.log('МойСклад отвечает, список пустой (нет заказов в статусе сборки или фильтр). Дальнейшие шаги пропущены.');
    process.exit(0);
  }

  const id = orders[0].id;
  console.log('первый заказ id:', id, 'name:', orders[0].name);

  const one = await api(base, token, 'GET', `/orders/${id}`);
  console.log('GET /orders/:id → HTTP', one.res.status);
  if (!one.res.ok) {
    console.log(JSON.stringify(one.data, null, 2));
    process.exit(1);
  }
  console.log('карточка: id', one.data.order?.id, 'name', one.data.order?.name);

  const claim = await api(base, token, 'POST', `/orders/${id}/claim`);
  console.log('POST /orders/:id/claim → HTTP', claim.res.status);
  console.log(JSON.stringify(claim.data, null, 2));
  if (![200, 201].includes(claim.res.status) && claim.res.status !== 409) {
    process.exit(1);
  }
  console.log('\nЦепочка проверена.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
