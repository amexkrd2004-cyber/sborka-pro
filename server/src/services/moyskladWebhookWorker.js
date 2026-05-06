const { fetchEntityByHref, getToken, getAssemblyStateName } = require('./moyskladApi');
const { getPool } = require('../db');
const { sendExpoPushBatch } = require('./expoPush');

/**
 * В ответе GET заказа `state.name` часто отсутствует — только `state.meta.href` на справочник статусов.
 * @param {object} order
 * @returns {Promise<string>}
 */
async function getCustomerOrderStateName(order) {
  const inline = order?.state?.name;
  if (inline != null && String(inline).trim() !== '') {
    return String(inline).trim();
  }
  const stateHref = order?.state?.meta?.href;
  if (!stateHref) return '';
  const st = await fetchEntityByHref(stateHref);
  if (!st) return '';
  const n = st.name;
  return n != null ? String(n).trim() : '';
}

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

      const stateName = await getCustomerOrderStateName(order);
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
        const pool = getPool();
        await pool.query(
          `INSERT INTO assembly_log (moysklad_order_id, event_type, payload)
           VALUES ($1::uuid, 'assembly_match', $2::jsonb)`,
          [
            String(order.id).toLowerCase(),
            JSON.stringify({ requestId, orderName, stateName, source: 'webhook' }),
          ]
        );

        const orderUuid = String(order.id).toLowerCase();
        const escIns = await pool.query(
          `INSERT INTO order_escalations (moysklad_order_id, fire_at, attempts, max_attempts, repeat_interval_sec)
           VALUES ($1::uuid, now() + interval '10 minutes', 0, 4, 900)
           ON CONFLICT (moysklad_order_id) DO NOTHING
           RETURNING moysklad_order_id, fire_at`,
          [orderUuid]
        );
        if (escIns.rowCount > 0) {
          console.log('[moysklad-worker] escalation scheduled', {
            order: orderName,
            orderId: orderUuid,
            fireAt: escIns.rows[0]?.fire_at,
          });
        } else {
          console.log('[moysklad-worker] escalation already pending (timer not reset)', {
            order: orderName,
            orderId: orderUuid,
          });
        }

        const tokensRes = await pool.query(
          `SELECT expo_push_token
           FROM push_tokens
           WHERE expo_push_token IS NOT NULL
             AND length(trim(expo_push_token)) > 0`
        );
        const pushTokens = tokensRes.rows.map((r) => String(r.expo_push_token || '').trim());

        if (escIns.rowCount === 0) {
          continue;
        }

        if (pushTokens.length === 0) {
          console.log('[moysklad-worker] no push tokens registered');
          continue;
        }

        const push = await sendExpoPushBatch(
          pushTokens.map((to) => ({
            to,
            title: 'Новый заказ в сборке',
            body: `Заказ ${orderName} ожидает сборки`,
            data: { orderId: order.id, orderName, stateName },
            channelId: 'default',
            priority: 'high',
          }))
        );
        await pool.query(
          `INSERT INTO assembly_log (moysklad_order_id, event_type, payload)
           VALUES ($1::uuid, 'push_sent', $2::jsonb)`,
          [
            orderUuid,
            JSON.stringify({
              requestId,
              sent: push.sent,
              errors: push.errors.length,
              errorDetails: push.errors.slice(0, 5),
            }),
          ]
        );
        const staleTokens = push.errors
          .filter((e) => e?.details?.error === 'DeviceNotRegistered' && e?.to)
          .map((e) => String(e.to).trim());
        if (staleTokens.length > 0) {
          await pool.query(
            `DELETE FROM push_tokens WHERE expo_push_token = ANY($1::text[])`,
            [staleTokens]
          );
          console.log('[moysklad-worker] removed stale push tokens', {
            count: staleTokens.length,
          });
        }
        console.log('[moysklad-worker] push sent', {
          order: orderName,
          recipients: push.sent,
          errors: push.errors.length,
          errorDetails: push.errors.slice(0, 3),
        });
      }
    } catch (err) {
      console.error('[moysklad-worker] fetch order failed', { href, message: err.message });
    }
  }
}

module.exports = { processMoyskladWebhookBody };
