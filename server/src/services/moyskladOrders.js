'use strict';

const { getToken, getAssemblyStateName, DEFAULT_BASE } = require('./moyskladApi');

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

module.exports = {
  listCustomerOrdersForAssembly,
  getCustomerOrderById,
};
