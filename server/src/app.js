const express = require('express');
const webhookRouter = require('./routes/webhook');

function createApp() {
  const app = express();

  app.disable('x-powered-by');

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'sborka-pro-server', phase: 'A' });
  });

  app.use('/webhook', webhookRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'not_found', path: req.path });
  });

  return app;
}

module.exports = { createApp };
