-- Фаза B: схема PostgreSQL (idempotent)

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login VARCHAR(128) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(255),
  role VARCHAR(32) NOT NULL DEFAULT 'assembler',
  warehouse_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_role_check CHECK (role IN ('admin', 'assembler'))
);

CREATE TABLE IF NOT EXISTS assembly_claims (
  moysklad_order_id UUID PRIMARY KEY,
  claimed_by_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_tokens (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assembly_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moysklad_order_id UUID NOT NULL,
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assembly_log_order ON assembly_log (moysklad_order_id);

CREATE TABLE IF NOT EXISTS order_escalations (
  moysklad_order_id UUID PRIMARY KEY,
  fire_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 4,
  repeat_interval_sec INTEGER NOT NULL DEFAULT 900,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_escalations_fire ON order_escalations (fire_at);

ALTER TABLE order_escalations
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_escalations
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 4;
ALTER TABLE order_escalations
  ADD COLUMN IF NOT EXISTS repeat_interval_sec INTEGER NOT NULL DEFAULT 900;

CREATE TABLE IF NOT EXISTS order_refusals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moysklad_order_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(128) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
