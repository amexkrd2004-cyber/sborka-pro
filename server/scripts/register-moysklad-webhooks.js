'use strict';

const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {
  /* dotenv optional */
}

function parseCli() {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--token' && argv[i + 1]) {
      out.token = argv[++i];
    } else if (argv[i] === '--url' && argv[i + 1]) {
      out.url = argv[++i];
    }
  }
  return out;
}

async function main() {
  const cli = parseCli();
  const token = cli.token || process.env.MOYSKLAD_TOKEN;
  const webhookUrl = cli.url || process.env.MOYSKLAD_WEBHOOK_URL;

  if (!token || !webhookUrl) {
    console.error(
      'Нужны токен и полный URL вебхука (https://…/webhook/moysklad):\n' +
        '  Заполните MOYSKLAD_TOKEN и MOYSKLAD_WEBHOOK_URL в server/.env, затем: npm run moysklad:register-webhooks\n' +
        '  или: node scripts/register-moysklad-webhooks.js --token "…" --url "https://…/webhook/moysklad"'
    );
    process.exit(1);
  }

  if (!/^https:\/\//i.test(webhookUrl)) {
    console.error('URL должен начинаться с https://');
    process.exit(1);
  }

  const apiUrl = 'https://api.moysklad.ru/api/remap/1.2/entity/webhook';

  for (const action of ['UPDATE', 'CREATE']) {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json;charset=utf-8',
      },
      body: JSON.stringify({ url: webhookUrl, action, entityType: 'customerorder' }),
    });
    const bodyText = await res.text();
    if (!res.ok) {
      let dup = false;
      if (res.status === 412) {
        try {
          const j = JSON.parse(bodyText);
          dup = Array.isArray(j.errors) && j.errors.some((e) => Number(e.code) === 30003);
        } catch {
          /* ignore */
        }
      }
      if (dup) {
        console.log(`${action}: уже зарегистрирован (дубликат), пропуск`);
        continue;
      }
      console.error(`Ошибка ${action}: HTTP ${res.status}\n${bodyText}`);
      process.exit(1);
    }
    console.log(`${action}: OK (${res.status})`);
  }

  console.log('Готово: вебхуки CREATE и UPDATE для customerorder зарегистрированы.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
