/**
 * Минимальный клиент МойСклад JSON API (только то, что нужно для вебхуков).
 * Базовый хост: https://api.moysklad.ru/api/remap/1.2
 */

const DEFAULT_BASE = 'https://api.moysklad.ru/api/remap/1.2';

function getToken() {
  const t = process.env.MOYSKLAD_TOKEN;
  if (!t || !String(t).trim()) return null;
  return String(t).trim();
}

/**
 * GET по полному href из meta вебхука (уже полный URL сущности).
 * @param {string} href
 * @returns {Promise<object|null>}
 */
async function fetchEntityByHref(href) {
  const token = getToken();
  if (!token) return null;

  const res = await fetch(href, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json;charset=utf-8',
      'Accept-Encoding': 'gzip',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MoySklad GET ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

function getAssemblyStateName() {
  return (process.env.MOYSKLAD_ASSEMBLY_STATE_NAME || 'Сборка').trim();
}

module.exports = {
  getToken,
  fetchEntityByHref,
  getAssemblyStateName,
  DEFAULT_BASE,
};
