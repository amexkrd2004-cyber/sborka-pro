const express = require('express');
const { redactDeep, summarizeWebhookPayload } = require('../lib/safeLog');
const { processMoyskladWebhookBody } = require('../services/moyskladWebhookWorker');

const router = express.Router();

/**
 * МойСклад: POST с телом { auditContext, events } и query requestId.
 * См. docs/moysklad-integration.md
 */
router.post('/moysklad', express.json({ limit: '1mb' }), (req, res) => {
  const summary = summarizeWebhookPayload(req.body);
  const requestId = typeof req.query.requestId === 'string' ? req.query.requestId : undefined;
  const logFull = process.env.WEBHOOK_LOG_FULL_BODY === 'true';

  console.log('[webhook/moysklad]', new Date().toISOString(), { requestId, ...summary });

  if (logFull && req.body) {
    const rid = requestId ?? 'n/a';
    const bodyText = JSON.stringify(redactDeep(req.body), null, 2);
    // Один вызов console.log — иначе при двух одновременных POST строки разных тел перемешиваются в логе.
    console.log(`[webhook/moysklad body] requestId=${rid}\n${bodyText}`);
  }

  // Снимок тела до ответа: после res.json() объект req иногда переиспользуется, иначе worker видит пустые events.
  const bodySnapshot =
    req.body != null && typeof req.body === 'object'
      ? JSON.parse(JSON.stringify(req.body))
      : req.body;

  res.status(200).json({ ok: true });

  console.log('[webhook/moysklad] worker queued', {
    requestId,
    eventCount: summary.eventCount,
  });

  setImmediate(() => {
    processMoyskladWebhookBody(bodySnapshot, requestId).catch((err) => {
      console.error('[webhook/moysklad async]', err.message);
    });
  });
});

module.exports = router;
