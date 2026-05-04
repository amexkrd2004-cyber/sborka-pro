'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { requireDb } = require('../middleware/requireDb');
const { listCustomerOrdersForAssembly, getCustomerOrderById } = require('../services/moyskladOrders');
const { getPool } = require('../db');

const router = express.Router();

/** МойСклад отдаёт UUID не всегда в «каноническом» виде RFC (4-й блок может начинаться не с 8/9/a/b). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.use(requireAuth);
router.use(requireDb);

function summarizeOrder(row) {
  const id = row.id;
  const name = row.name;
  const moment = row.moment;
  const sum = row.sum;
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

/** Смена статуса в МойСклад — следующий подэтап фазы B. */
router.patch('/:id/status', (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'bad_request', message: 'id должен быть UUID заказа МойСклад.' });
  }
  res.status(501).json({
    error: 'not_implemented',
    message: 'PATCH статуса заказа в МойСклад будет в следующем коммите фазы B.',
  });
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

  res.status(201).json({
    claimed: true,
    moyskladOrderId: ins.rows[0].moysklad_order_id,
    claimedAt: ins.rows[0].claimed_at,
  });
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
    res.json({ order });
  } catch (err) {
    if (err.code === 'MS_NO_TOKEN') {
      return res.status(503).json({ error: 'moysklad_not_configured', message: err.message });
    }
    console.error('[orders] get failed', err.message);
    return res.status(502).json({ error: 'moysklad_error', message: err.message });
  }
});

module.exports = router;
