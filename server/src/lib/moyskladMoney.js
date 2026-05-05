'use strict';

/**
 * В JSON API МойСклад денежные поля заказа покупателя заданы в минимальных единицах валюты
 * (для рубля — копейках). Например 3_990_000 коп. = 39 900,00 ₽.
 */

const ROOT_MINOR_FIELDS = ['sum', 'payedSum', 'shippedSum'];
const ATTR_NAMES = {
  deliveryType: 'Тип доставки',
  pickerNote: 'Примечание для сборщика',
  shipmentNumber: 'Номер отправления',
};

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

function readAttrByName(order, attrName) {
  const attrs = Array.isArray(order?.attributes) ? order.attributes : [];
  const hit = attrs.find((a) => String(a?.name || '').trim() === attrName);
  if (!hit || hit.value == null) return null;
  const v = hit.value;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object' && typeof v.name === 'string') return v.name;
  return null;
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
  out.customFields = {
    deliveryType: readAttrByName(order, ATTR_NAMES.deliveryType),
    pickerNote: readAttrByName(order, ATTR_NAMES.pickerNote),
    shipmentNumber: readAttrByName(order, ATTR_NAMES.shipmentNumber),
  };
  return out;
}

module.exports = {
  summarizeOrderSum,
  normalizeCustomerOrder,
};
