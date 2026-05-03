const { fetchEntityByHref, getToken, getAssemblyStateName } = require('./moyskladApi');

/**
 * Обработка тела вебхука после отправки HTTP 200 (не блокировать ответ МойСклад).
 * @param {object} body
 * @param {string|undefined} requestId query-параметр
 */
async function processMoyskladWebhookBody(body, requestId) {
  const events = body && Array.isArray(body.events) ? body.events : [];
  if (events.length === 0) {
    console.log('[moysklad-worker] no events', { requestId, keys: body ? Object.keys(body) : [] });
    return;
  }

  const hasToken = Boolean(getToken());
  console.log('[moysklad-worker]', {
    phase: 'start',
    requestId,
    eventCount: events.length,
    hasToken,
  });

  if (!hasToken) {
    console.log('[moysklad-worker] MOYSKLAD_TOKEN not set — skip order fetch (webhook accepted only)');
    return;
  }

  const targetState = getAssemblyStateName();

  for (let i = 0; i < events.length; i += 1) {
    const ev = events[i];
    const type = ev?.meta?.type;
    const href = ev?.meta?.href;
    const action = ev?.action;

    if (type !== 'customerorder' || !href) {
      continue;
    }

    try {
      const order = await fetchEntityByHref(href);
      if (!order) continue;

      const stateName = order.state?.name ?? '';
      const orderName = order.name ?? order.id ?? '?';
      const match = stateName === targetState;

      console.log('[moysklad-worker]', {
        requestId,
        eventIndex: i,
        action,
        order: orderName,
        stateName,
        assemblyMatch: match,
        expectedState: targetState,
      });

      if (match) {
        // Фаза B: enqueue notification, write DB, push Expo
        console.log('[moysklad-worker] TODO phase B: notify assemblers for order', orderName);
      }
    } catch (err) {
      console.error('[moysklad-worker] fetch order failed', { href, message: err.message });
    }
  }
}

module.exports = { processMoyskladWebhookBody };
