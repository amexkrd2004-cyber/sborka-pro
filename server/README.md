# СборкаПро — сервер (фазы A–B)

Node.js + Express: webhook **МойСклад**, **PostgreSQL**, JWT, список заказов в «Сборке», атомарный **захват заказа**.

## Требования

- Node.js **18+**
- **PostgreSQL** для фазы B (на Railway — плагин Postgres, переменная `DATABASE_URL`)

Без `DATABASE_URL` сервер поднимается в режиме **только фаза A** (`/health` → `"phase":"A"`, `"db":false`): вебхук и МойСклад работают как раньше.

## Быстрый старт (локально)

```bash
cd server
npm install
copy .env.example .env
```

Заполните в `.env` как минимум **`DATABASE_URL`**, **`JWT_SECRET`** (≥32 символов), **`MOYSKLAD_TOKEN`**, **`SEED_ADMIN_PASSWORD`** (≥8 символов), затем:

```bash
npm run db:seed
npm run dev
```

(PowerShell: `Copy-Item .env.example .env`.)

Проверка: `http://127.0.0.1:3000/health` — при рабочей БД `"phase":"B"`, `"db":true`.

## Эндпоинты

| Метод | Путь | Назначение |
|--------|------|------------|
| GET | `/health` | Живость; `db` — доступность PostgreSQL |
| POST | `/webhook/moysklad` | Вебхук МойСклад |
| POST | `/auth/login` | Тело `{ "login", "password" }` → JWT |
| GET | `/auth/me` | Текущий пользователь по `Authorization: Bearer` |
| POST | `/auth/register-token` | Сохранить Expo push-токен: `{ "expoPushToken" }` |
| GET | `/orders` | Список заказов в статусе **MOYSKLAD_ASSEMBLY_STATE_NAME** (Bearer) |
| GET | `/orders/:id` | Заказ по UUID МойСклад (Bearer) |
| POST | `/orders/:id/claim` | Атомарный захват заказа (Bearer) |
| PATCH | `/orders/:id/status` | Пока **501** — обновление статуса в МойСклад (следующий шаг) |

## МойСклад: вебхук

Вебхук регистрируется через **JSON API** (не пункт меню). URL: `https://<хост>/webhook/moysklad`.

Инструкция: **[`docs/railway-sborka-pro.md`](../docs/railway-sborka-pro.md)** (шаг 6).

```powershell
cd server
npm run moysklad:register-webhooks
```

Для отладки тела вебхука локально: `WEBHOOK_LOG_FULL_BODY=true`.

## Railway (фаза B)

1. В проекте добавьте **PostgreSQL**, в сервисе приложения задайте **`DATABASE_URL`** (часто подставляется ссылкой из плагина).
2. **`JWT_SECRET`** — случайная строка ≥32 символов.
3. Однократно выполните сид (локально с тем же `DATABASE_URL` или через **Railway → Shell** в каталоге с репозиторием):

   ```bash
   cd server && npm run db:seed
   ```

   Переменные сида: **`SEED_ADMIN_PASSWORD`** (обязательно), `SEED_ADMIN_LOGIN` (по умолчанию `admin`).

4. Задеплойте; проверьте `GET /health` и вход `POST /auth/login`.

Полная инструкция по GitHub и Root Directory `server`: **[`docs/railway-sborka-pro.md`](../docs/railway-sborka-pro.md)**.

## Переменные окружения

См. **`server/.env.example`**.

## Документация проекта

Корень: **`sborka.md`**. МойСклад: **`docs/moysklad-integration.md`**.
