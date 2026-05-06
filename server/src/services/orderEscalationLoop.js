'use strict';

const { getPool, isDbEnabled } = require('../db');
const { getAssemblyStateName } = require('./moyskladApi');
const { getCustomerOrderById, getCustomerOrderStateName } = require('./moyskladOrders');
const { sendExpoPushBatch } = require('./expoPush');

const INTERVAL_MS = 45_000;

function startOrderEscalationLoop() {
  if (!isDbEnabled()) return;
  const tick = () => {
    processDueEscalations().catch((err) => console.error('[escalation]', err.message));
  };
  setInterval(tick, INTERVAL_MS);
  setTimeout(tick, 5_000);
  console.log('[escalation] проверка «не взят 10 мин» каждые', INTERVAL_MS / 1000, 'с');
}

async function processDueEscalations() {
  const pool = getPool();
  if (!pool) return;

  const { rows } = await pool.query(
    `SELECT moysklad_order_id, attempts, max_attempts, repeat_interval_sec FROM order_escalations
     WHERE fire_at <= now()
     ORDER BY fire_at ASC
     LIMIT 30`
  );
  if (rows.length === 0) return;

  console.log('[escalation] due', { count: rows.length });

  const targetState = String(getAssemblyStateName() || '').trim();

  for (const r of rows) {
    const orderId = String(r.moysklad_order_id);
    const attempts = Number(r.attempts || 0);
    const maxAttempts = Math.max(Number(r.max_attempts || 4), 1);
    const repeatIntervalSec = Math.max(Number(r.repeat_interval_sec || 900), 60);
    try {
      const claimed = await pool.query(
        `SELECT 1 FROM assembly_claims WHERE moysklad_order_id = $1::uuid`,
        [orderId]
      );
      if (claimed.rowCount > 0) {
        await pool.query(`DELETE FROM order_escalations WHERE moysklad_order_id = $1::uuid`, [
          orderId,
        ]);
        console.log('[escalation] skip: already claimed', { orderId });
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

      const stateName = String((await getCustomerOrderStateName(order)) || '').trim();
      if (stateName !== targetState) {
        await pool.query(`DELETE FROM order_escalations WHERE moysklad_order_id = $1::uuid`, [
          orderId,
        ]);
        console.log('[escalation] skip: status changed', { orderId, stateName, expected: targetState });
        continue;
      }

      const orderName = order.name ?? order.id;
      const tokensRes = await pool.query(
        `SELECT expo_push_token FROM push_tokens
         WHERE expo_push_token IS NOT NULL AND length(trim(expo_push_token)) > 0`
      );
      const pushTokens = tokensRes.rows.map((x) => String(x.expo_push_token || '').trim());

      if (pushTokens.length === 0) {
        console.warn('[escalation] no push tokens — alarm not delivered', { orderId, order: orderName });
      }

      if (pushTokens.length > 0) {
        const push = await sendExpoPushBatch(
          pushTokens.map((to) => ({
            to,
            title: 'Срочно: заказ не взят',
            body: `${orderName} не взят в работу. Подтвердите сигнал или возьмите заказ.`,
            data: {
              orderId,
              orderName,
              stateName,
              kind: 'escalation_alarm',
              attempt: attempts + 1,
              maxAttempts,
            },
            // На части устройств custom-канал может быть неинициализирован; default уже проверен в бою.
            channelId: 'default',
            priority: 'high',
          }))
        );
        console.log('[escalation] alarm push sent', {
          order: orderName,
          orderId,
          attempt: attempts + 1,
          maxAttempts,
          recipients: push.sent,
          errors: push.errors.length,
          errorDetails: push.errors.slice(0, 3),
        });
      }

      const nextAttempts = attempts + 1;
      if (nextAttempts >= maxAttempts) {
        await pool.query(`DELETE FROM order_escalations WHERE moysklad_order_id = $1::uuid`, [
          orderId,
        ]);
        console.log('[escalation] alarm finished by max attempts', {
          orderId,
          attempts: nextAttempts,
        });
      } else {
        await pool.query(
          `UPDATE order_escalations
           SET attempts = $2::int,
               fire_at = now() + ($3::int * interval '1 second')
           WHERE moysklad_order_id = $1::uuid`,
          [orderId, nextAttempts, repeatIntervalSec]
        );
        console.log('[escalation] next alarm scheduled', {
          orderId,
          nextAttempt: nextAttempts + 1,
          inSeconds: repeatIntervalSec,
        });
      }
    } catch (err) {
      console.error('[escalation] order', orderId, err.message);
    }
  }
}

module.exports = { startOrderEscalationLoop };
