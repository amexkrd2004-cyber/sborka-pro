'use strict';

const { getToken, getAssemblyStateName, DEFAULT_BASE, fetchEntityByHref } = require('./moyskladApi');

/**
 * Список заказов покупателя в статусе сборки (имя статуса = MOYSKLAD_ASSEMBLY_STATE_NAME).
 * @param {{ limit?: number }} opts
 * @returns {Promise<{ rows: object[], meta: object }>}
 */
async function listCustomerOrdersForAssembly({ limit = 50 } = {}) {
  const token = getToken();
  if (!token) {
    const e = new Error('MOYSKLAD_TOKEN not configured');
    e.code = 'MS_NO_TOKEN';
    throw e;
  }

  const stateName = getAssemblyStateName();
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const filter = `state.name=${stateName}`;
  const url = `${DEFAULT_BASE}/entity/customerorder?limit=${lim}&filter=${encodeURIComponent(filter)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json;charset=utf-8',
      'Accept-Encoding': 'gzip',
    },
  });

  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`MoySklad list orders ${res.status}: ${text.slice(0, 300)}`);
    err.code = 'MS_HTTP';
    err.status = res.status;
    throw err;
  }

  const data = JSON.parse(text);
  return { rows: data.rows || [], meta: data.meta };
}

/**
 * GET заказа по UUID (id в href МойСклад).
 * @param {string} orderId UUID
 */
async function getCustomerOrderById(orderId) {
  const token = getToken();
  if (!token) {
    const e = new Error('MOYSKLAD_TOKEN not configured');
    e.code = 'MS_NO_TOKEN';
    throw e;
  }

  const url = `${DEFAULT_BASE}/entity/customerorder/${orderId}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json;charset=utf-8',
      'Accept-Encoding': 'gzip',
    },
  });

  const text = await res.text();
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = new Error(`MoySklad get order ${res.status}: ${text.slice(0, 300)}`);
    err.code = 'MS_HTTP';
    err.status = res.status;
    throw err;
  }

  return JSON.parse(text);
}

async function getCustomerOrderStateName(order) {
  const direct = order?.state?.name;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const href = order?.state?.meta?.href;
  if (!href) return null;
  const state = await fetchEntityByHref(href);
  return typeof state?.name === 'string' ? state.name.trim() : null;
}

async function getCustomerOrderStatesMetadata() {
  const token = getToken();
  if (!token) {
    const e = new Error('MOYSKLAD_TOKEN not configured');
    e.code = 'MS_NO_TOKEN';
    throw e;
  }
  const url = `${DEFAULT_BASE}/entity/customerorder/metadata/states`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json;charset=utf-8',
      'Accept-Encoding': 'gzip',
    },
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`MoySklad states ${res.status}: ${text.slice(0, 300)}`);
    err.code = 'MS_HTTP';
    err.status = res.status;
    throw err;
  }
  const data = JSON.parse(text);
  return data.rows || [];
}

async function updateCustomerOrderState(orderId, targetStateName) {
  const token = getToken();
  if (!token) {
    const e = new Error('MOYSKLAD_TOKEN not configured');
    e.code = 'MS_NO_TOKEN';
    throw e;
  }
  const stateName = String(targetStateName || '').trim();
  const states = await getCustomerOrderStatesMetadata();
  const target = states.find((s) => String(s?.name || '').trim() === stateName);
  if (!target?.meta?.href) {
    const e = new Error(`State not found: ${stateName}`);
    e.code = 'MS_STATE_NOT_FOUND';
    throw e;
  }

  const patchUrl = `${DEFAULT_BASE}/entity/customerorder/${orderId}`;
  const res = await fetch(patchUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json;charset=utf-8',
      'Accept-Encoding': 'gzip',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      state: {
        meta: {
          href: target.meta.href,
          type: target.meta.type || 'state',
          mediaType: target.meta.mediaType || 'application/json',
        },
      },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`MoySklad update state ${res.status}: ${text.slice(0, 300)}`);
    err.code = 'MS_HTTP';
    err.status = res.status;
    throw err;
  }
  return JSON.parse(text);
}

module.exports = {
  listCustomerOrdersForAssembly,
  getCustomerOrderById,
  getCustomerOrderStateName,
  updateCustomerOrderState,
};
