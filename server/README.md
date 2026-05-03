# СборкаПро — сервер (фаза A)

Node.js + Express: приём **webhook** из МойСклад и заготовка под REST API.

## Требования

- Node.js **18+**

## Быстрый старт (локально)

```bash
cd server
npm install
copy .env.example .env
npm run dev
```

(PowerShell: `Copy-Item .env.example .env`. Для CI после коммита `package-lock.json` можно использовать `npm ci`.)

Проверка: откройте в браузере `http://127.0.0.1:3000/health`.

## Эндпоинты (сейчас)

| Метод | Путь | Назначение |
|--------|------|------------|
| GET | `/health` | Проверка живости |
| POST | `/webhook/moysklad` | Приём вебхука МойСклад (лог + `200 { ok: true }`) |

## МойСклад: настройка вебхука

Вебхук **не создаётся** пунктом меню «Вебхуки» (его может не быть): регистрация через **JSON API** и токен из **Настройки → Обмен данными → Токены**. URL вашего сервера: `https://<хост>/webhook/moysklad` (**HTTPS**; `localhost` МойСклад не вызовет).

Полная инструкция: **[`docs/railway-sborka-pro.md`](../docs/railway-sborka-pro.md)** (раздел **«Шаг 6»**).

Зарегистрировать вебхуки **CREATE** и **UPDATE** для заказов из консоли (обходит ошибку **415** у `Invoke-RestMethod` в PowerShell 5):

```powershell
cd server
# В .env: MOYSKLAD_TOKEN и MOYSKLAD_WEBHOOK_URL = полный https://…/webhook/moysklad
npm run moysklad:register-webhooks
```

После регистрации измените заказ покупателя — в логах сервера появится `[webhook/moysklad]`.

Для отладки **полного** тела запроса (осторожно, только локально): в `.env` задайте `WEBHOOK_LOG_FULL_BODY=true`.

## Переменные окружения

См. `.env.example`. Токены МойСклад и JWT понадобятся на **фазе B**.

## Деплой на Railway

Пошаговая инструкция (GitHub, **Root Directory = `server`**, домен, вебхук): **[`docs/railway-sborka-pro.md`](../docs/railway-sborka-pro.md)**.

## Документация проекта

Корень репозитория: `sborka.md`. Схема МойСклад (вебхуки, токен, статус «Сборка»): **[`docs/moysklad-integration.md`](../docs/moysklad-integration.md)**.
