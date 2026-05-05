'use strict';

const { getPool, isDbEnabled } = require('../db');
const { getAssemblyStateName } = require('./moyskladApi');
const { getCustomerOrderById, getCustomerOrderStateName } = require('./moyskladOrders');
const { sendExpoPushBatch } = require('./expoPush');

const INTERVAL_MS = 45_000;

function startOrderEscalationLoop() {
  if (!isDbEnabled()) return;
  setInterval(() => {
    processDueEscalations().catch((err) => console.error('[escalation]', err.message));
  }, INTERVAL_MS);
  console.log('[escalation] проверка «не взят 10 мин» каждые', INTERVAL_MS / 1000, 'с');
}

async function processDueEscalations() {
  const pool = getPool();
  if (!pool) return;

  const { rows } = await pool.query(
    `SELECT moysklad_order_id FROM order_escalations
     WHERE fire_at <= now()
     ORDER BY fire_at ASC
     LIMIT 30`
  );
  if (rows.length === 0) return;

  const targetState = getAssemblyStateName();

  for (const r of rows) {
    const orderId = r.moysklad_order_id;
    try {
      const claimed = await pool.query(
        `SELECT 1 FROM assembly_claims WHERE moysklad_order_id = $1::uuid`,
        [orderId]
      );
      if (claimed.rowCount > 0) {
        await pool.query(`DELETE FROM order_escalations WHERE moysklad_order_id = $1::uuid`, [
          orderId,
        ]);
        continue;
      }

      let order;
      try {
        order = await getCustomerOrderById(orderId);
      } catch (err) {
        console.warn('[escalation] get order', orderId, err.message);
        await pool.query(`DELETE FROM order_escalations WHERE moysklad_order_id = $1::uuid`, [
          orderId,
        ]);
        continue;
      }

      if (!order) {
        await pool.query(`DELETE FROM order_escalations WHERE moysklad_order_id = $1::uuid`, [
          orderId,
        ]);
        continue;
      }

      const stateName = await getCustomerOrderStateName(order);
      if (stateName !== targetState) {
        await pool.query(`DELETE FROM order_escalations WHERE moysklad_order_id = $1::uuid`, [
          orderId,
        ]);
        continue;
      }

      const orderName = order.name ?? order.id;
      const tokensRes = await pool.query(
        `SELECT expo_push_token FROM push_tokens
         WHERE expo_push_token IS NOT NULL AND length(trim(expo_push_token)) > 0`
      );
      const pushTokens = tokensRes.rows.map((x) => String(x.expo_push_token || '').trim());

      if (pushTokens.length > 0) {
        await sendExpoPushBatch(
          pushTokens.map((to) => ({
            to,
            title: 'Срочно: заказ не взят',
            body: `${orderName} в «${targetState}» более 10 мин — возьмите в работу`,
            data: { orderId, orderName, stateName, kind: 'escalation' },
            channelId: 'urgent',
            priority: 'high',
          }))
        );
      }

      await pool.query(`DELETE FROM order_escalations WHERE moysklad_order_id = $1::uuid`, [
        orderId,
      ]);
    } catch (err) {
      console.error('[escalation] order', orderId, err.message);
    }
  }
}

module.exports = { startOrderEscalationLoop };
