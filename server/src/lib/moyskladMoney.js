'use strict';

/**
 * В JSON API МойСклад денежные поля заказа покупателя заданы в минимальных единицах валюты
 * (для рубля — копейках). Например 3_990_000 коп. = 39 900,00 ₽.
 */

const ROOT_MINOR_FIELDS = ['sum', 'payedSum', 'shippedSum'];

function minorToMajor(value) {
  if (value == null) return value;
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n / 100;
}

/** Для сводки в GET /orders (список). */
function summarizeOrderSum(sumRaw) {
  return minorToMajor(sumRaw);
}

/** Полная карточка GET /orders/:id — приводим корневые денежные поля к рублям для клиентов. */
function normalizeCustomerOrder(order) {
  if (!order || typeof order !== 'object') return order;
  const out = { ...order };
  for (const key of ROOT_MINOR_FIELDS) {
    if (typeof out[key] === 'number') {
      out[key] = minorToMajor(out[key]);
    }
  }
  return out;
}

module.exports = {
  summarizeOrderSum,
  normalizeCustomerOrder,
};
