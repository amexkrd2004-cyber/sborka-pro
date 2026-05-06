'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { requireDb } = require('../middleware/requireDb');
const {
  listCustomerOrdersForAssembly,
  getCustomerOrderById,
  getCustomerOrderStateName,
  updateCustomerOrderState,
} = require('../services/moyskladOrders');
const { normalizeCustomerOrder, summarizeOrderSum } = require('../lib/moyskladMoney');
const { getPool } = require('../db');

const router = express.Router();

/** МойСклад отдаёт UUID не всегда в «каноническом» виде RFC (4-й блок может начинаться не с 8/9/a/b). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_TRANSITIONS = {
  Сборка: ['Сборка (в работе)', 'Проблема со сборкой'],
  'Сборка (в работе)': ['Собран', 'Проблема со сборкой'],
  Собран: ['Отгружен', 'Проблема со сборкой'],
  'Проблема со сборкой': ['Сборка (в работе)'],
};

router.use(requireAuth);
router.use(requireDb);

function summarizeOrder(row) {
  const id = row.id;
  const name = row.name;
  const moment = row.moment;
  const sum = summarizeOrderSum(row.sum);
  const stateName = row.state?.name ?? null;
  const href = row.meta?.href ?? null;
  return { id, name, moment, sum, stateName, href };
}

/** Список заказов в статусе «Сборка» (фильтр МойСклад). */
router.get('/', async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const { rows } = await listCustomerOrdersForAssembly({ limit });
    res.json({ orders: rows.map(summarizeOrder) });
  } catch (err) {
    if (err.code === 'MS_NO_TOKEN') {
      return res.status(503).json({ error: 'moysklad_not_configured', message: err.message });
    }
    console.error('[orders] list failed', err.message);
    return res.status(502).json({ error: 'moysklad_error', message: err.message });
  }
});

/** Подтвердить alarm по всем текущим заказам в сборке: остановить все активные эскалации. */
router.post('/escalations/ack-all', async (req, res) => {
  const pool = getPool();
  const del = await pool.query(`DELETE FROM order_escalations RETURNING moysklad_order_id`);
  return res.json({ ok: true, stoppedCount: del.rowCount || 0 });
});

/** Смена статуса в МойСклад под согласованные переходы. */
router.patch('/:id/status', express.json(), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'bad_request', message: 'id должен быть UUID заказа МойСклад.' });
  }
  const targetStatus = typeof req.body?.targetStatus === 'string' ? req.body.targetStatus.trim() : '';
  if (!targetStatus) {
    return res
      .status(400)
      .json({ error: 'bad_request', message: 'Нужно поле targetStatus (строка).' });
  }

  try {
    const id = req.params.id;
    const currentOrder = await getCustomerOrderById(id);
    if (!currentOrder) return res.status(404).json({ error: 'not_found' });
    const currentStatus = await getCustomerOrderStateName(currentOrder);
    const allowed = STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      return res.status(409).json({
        error: 'invalid_transition',
        currentStatus,
        targetStatus,
        allowedTransitions: allowed,
      });
    }
    const updated = await updateCustomerOrderState(id, targetStatus);
    const normalized = normalizeCustomerOrder(updated);
    normalized.stateName = targetStatus;

    const pool = getPool();
    await pool.query(
      `INSERT INTO assembly_log (moysklad_order_id, user_id, event_type, payload)
       VALUES ($1::uuid, $2::uuid, 'status_changed', $3::jsonb)`,
      [id.toLowerCase(), req.user.id, JSON.stringify({ from: currentStatus, to: targetStatus, source: 'api' })]
    );
    await pool.query(`DELETE FROM order_escalations WHERE moysklad_order_id = $1::uuid`, [
      id.toLowerCase(),
    ]);

    return res.json({
      ok: true,
      currentStatus,
      targetStatus,
      order: normalized,
    });
  } catch (err) {
    if (err.code === 'MS_NO_TOKEN') {
      return res.status(503).json({ error: 'moysklad_not_configured', message: err.message });
    }
    if (err.code === 'MS_STATE_NOT_FOUND' || err.code === 'MS_STATES_UNAVAILABLE') {
      return res.status(400).json({ error: 'bad_request', message: err.message });
    }
    console.error('[orders] patch status failed', err.message);
    return res.status(502).json({ error: 'moysklad_error', message: err.message });
  }
});

/** Атомарный захват заказа: кто первый INSERT — тот взял в сборку. */
router.post('/:id/claim', async (req, res) => {
  const id = req.params.id;
  if (!UUID_RE.test(id)) {
    return res.status(400).json({ error: 'bad_request', message: 'id должен быть UUID заказа МойСклад.' });
  }

  const orderId = id.toLowerCase();
  const userId = req.user.id;
  const pool = getPool();

  const ins = await pool.query(
    `INSERT INTO assembly_claims (moysklad_order_id, claimed_by_user_id)
     VALUES ($1::uuid, $2::uuid)
     ON CONFLICT (moysklad_order_id) DO NOTHING
     RETURNING moysklad_order_id, claimed_by_user_id, claimed_at`,
    [orderId, userId]
  );

  if (ins.rowCount === 0) {
    const cur = await pool.query(
      `SELECT c.moysklad_order_id, c.claimed_by_user_id, c.claimed_at, u.login AS claimed_by_login
       FROM assembly_claims c
       JOIN users u ON u.id = c.claimed_by_user_id
       WHERE c.moysklad_order_id = $1::uuid`,
      [orderId]
    );
    const row = cur.rows[0];
    const mine = row && String(row.claimed_by_user_id) === String(userId);
    if (mine) {
      await pool.query(`DELETE FROM order_escalations WHERE moysklad_order_id = $1::uuid`, [orderId]);
      return res.status(200).json({ claimed: true, already: true, claimedAt: row.claimed_at });
    }
    return res.status(409).json({
      claimed: false,
      takenBy: row ? { login: row.claimed_by_login, at: row.claimed_at } : undefined,
    });
  }

  await pool.query(
    `INSERT INTO assembly_log (moysklad_order_id, user_id, event_type, payload)
     VALUES ($1::uuid, $2::uuid, 'claimed', $3::jsonb)`,
    [orderId, userId, JSON.stringify({ source: 'api' })]
  );
  await pool.query(`DELETE FROM order_escalations WHERE moysklad_order_id = $1::uuid`, [orderId]);

  res.status(201).json({
    claimed: true,
    moyskladOrderId: ins.rows[0].moysklad_order_id,
    claimedAt: ins.rows[0].claimed_at,
  });
});

/** Подтверждение alarm-сигнала: останавливает дальнейшие эскалации по заказу. */
router.post('/:id/escalation-ack', async (req, res) => {
  const id = req.params.id;
  if (!UUID_RE.test(id)) {
    return res.status(400).json({ error: 'bad_request', message: 'id должен быть UUID заказа МойСклад.' });
  }
  const pool = getPool();
  const orderId = id.toLowerCase();
  const del = await pool.query(
    `DELETE FROM order_escalations
     WHERE moysklad_order_id = $1::uuid
     RETURNING moysklad_order_id`,
    [orderId]
  );
  await pool.query(
    `INSERT INTO assembly_log (moysklad_order_id, user_id, event_type, payload)
     VALUES ($1::uuid, $2::uuid, 'escalation_ack', $3::jsonb)`,
    [orderId, req.user.id, JSON.stringify({ source: 'api' })]
  );
  return res.json({ ok: true, stopped: del.rowCount > 0 });
});

/** Карточка заказа по id МойСклад (UUID). */
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  if (!UUID_RE.test(id)) {
    return res.status(400).json({ error: 'bad_request', message: 'id должен быть UUID заказа МойСклад.' });
  }
  try {
    const order = await getCustomerOrderById(id);
    if (!order) {
      return res.status(404).json({ error: 'not_found' });
    }
    const normalized = normalizeCustomerOrder(order);
    const stateName = await getCustomerOrderStateName(order);
    if (stateName) normalized.stateName = stateName;
    res.json({ order: normalized });
  } catch (err) {
    if (err.code === 'MS_NO_TOKEN') {
      return res.status(503).json({ error: 'moysklad_not_configured', message: err.message });
    }
    console.error('[orders] get failed', err.message);
    return res.status(502).json({ error: 'moysklad_error', message: err.message });
  }
});

module.exports = router;
