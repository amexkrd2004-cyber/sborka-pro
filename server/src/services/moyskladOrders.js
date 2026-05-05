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

function getStateNameByHref(states, href) {
  const normalizedHref = String(href || '').trim();
  if (!normalizedHref) return null;
  const hit = (states || []).find((s) => String(s?.meta?.href || '').trim() === normalizedHref);
  return hit && typeof hit.name === 'string' ? hit.name.trim() : null;
}

async function getCustomerOrderStateName(order) {
  const direct = order?.state?.name;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const href = order?.state?.meta?.href;
  if (!href) return null;
  const states = await getCustomerOrderStatesMetadata();
  return getStateNameByHref(states, href);
}

async function getCustomerOrderStatesMetadata() {
  const token = getToken();
  if (!token) {
    const e = new Error('MOYSKLAD_TOKEN not configured');
    e.code = 'MS_NO_TOKEN';
    throw e;
  }
  const metaUrl = `${DEFAULT_BASE}/entity/customerorder/metadata`;
  const metaRes = await fetch(metaUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json;charset=utf-8',
      'Accept-Encoding': 'gzip',
    },
  });
  const metaText = await metaRes.text();
  if (metaRes.ok) {
    const metaData = JSON.parse(metaText);
    if (Array.isArray(metaData.states)) {
      return metaData.states;
    }
  }

  // Fallback для окружений, где список статусов отдается отдельным ресурсом.
  const statesUrl = `${DEFAULT_BASE}/entity/customerorder/metadata/states`;
  const statesRes = await fetch(statesUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json;charset=utf-8',
      'Accept-Encoding': 'gzip',
    },
  });
  const statesText = await statesRes.text();
  if (!statesRes.ok) {
    const err = new Error(
      `MoySklad states ${statesRes.status}: ${statesText.slice(0, 300)}`
    );
    err.code = 'MS_HTTP';
    err.status = statesRes.status;
    throw err;
  }
  const data = JSON.parse(statesText);
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
