const express = require('express');
const { isDbEnabled, pingDb } = require('./db');
const webhookRouter = require('./routes/webhook');
const authRouter = require('./routes/auth');
const ordersRouter = require('./routes/orders');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', async (_req, res) => {
    let db = false;
    if (isDbEnabled()) {
      try {
        await pingDb();
        db = true;
      } catch {
        db = false;
      }
    }
    res.json({
      ok: true,
      service: 'sborka-pro-server',
      phase: db ? 'B' : 'A',
      db,
    });
  });

  app.use('/webhook', webhookRouter);
  app.use('/auth', authRouter);
  app.use('/orders', ordersRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'not_found', path: req.path });
  });

  return app;
}

module.exports = { createApp };
