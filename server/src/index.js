require('dotenv').config();

const { createApp } = require('./app');

const port = Number(process.env.PORT) || 3000;
const app = createApp();

app.listen(port, () => {
  console.log(`Sborka Pro server listening on http://127.0.0.1:${port}`);
  console.log(`Health: GET http://127.0.0.1:${port}/health`);
  console.log(`Webhook: POST http://127.0.0.1:${port}/webhook/moysklad`);
});
