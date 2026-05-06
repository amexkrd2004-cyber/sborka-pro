require('dotenv').config();

const { initDb } = require('./db');
const { createApp } = require('./app');
const { startOrderEscalationLoop } = require('./services/orderEscalationLoop');

const port = Number(process.env.PORT) || 3000;

async function main() {
  const dbOk = await initDb();
  const app = createApp();

  if (dbOk) {
    startOrderEscalationLoop();
  }

  app.listen(port, () => {
    console.log(`Sborka Pro server listening on http://127.0.0.1:${port}`);
    console.log(`Health: GET http://127.0.0.1:${port}/health`);
    console.log(`Webhook: POST http://127.0.0.1:${port}/webhook/moysklad`);
    console.log(`Auth: POST http://127.0.0.1:${port}/auth/login`);
    console.log(`Orders: GET http://127.0.0.1:${port}/orders (Bearer JWT)`);
  });
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
