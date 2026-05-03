const express = require('express');
const { redactDeep, summarizeWebhookPayload } = require('../lib/safeLog');

const router = express.Router();

/**
 * МойСклад шлёт POST с JSON (см. документацию «Вебхуки»).
 * На фазе A: принимаем, логируем безопасно, отвечаем 200 быстро.
 */
router.post('/moysklad', express.json({ limit: '1mb' }), (req, res) => {
  const summary = summarizeWebhookPayload(req.body);
  const logFull = process.env.WEBHOOK_LOG_FULL_BODY === 'true';

  console.log('[webhook/moysklad]', new Date().toISOString(), summary);

  if (logFull && req.body) {
    console.log('[webhook/moysklad body]', JSON.stringify(redactDeep(req.body), null, 2));
  }

  res.status(200).json({ ok: true });
});

module.exports = router;
