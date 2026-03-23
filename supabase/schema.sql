-- ============================================================
-- AgentOS — Supabase Schema
-- ============================================================

-- Agents table
CREATE TABLE agents (
  id              BIGSERIAL PRIMARY KEY,
  agent_id        TEXT UNIQUE NOT NULL,
  owner           TEXT NOT NULL,
  name            TEXT NOT NULL,
  template        SMALLINT NOT NULL DEFAULT 0,
  tone_index      SMALLINT NOT NULL DEFAULT 0,
  language        TEXT NOT NULL DEFAULT 'Español',
  system_prompt   TEXT NOT NULL,
  config_hash     TEXT NOT NULL,
  price_usdc      NUMERIC(10,6) NOT NULL DEFAULT 0.01,
  access_type     SMALLINT NOT NULL DEFAULT 0,
  nft_collection  TEXT,
  payment_wallet  TEXT NOT NULL,
  -- LLM config
  llm_provider    TEXT NOT NULL DEFAULT 'openai' CHECK (llm_provider IN ('openai','anthropic','groq','together')),
  encrypted_api_key TEXT,                       -- AES-256-GCM encrypted, NULL = usa key de plataforma
  has_own_key     BOOLEAN NOT NULL DEFAULT false,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','closed')),
  uses_total      BIGINT NOT NULL DEFAULT 0,
  revenue_total   NUMERIC(18,6) NOT NULL DEFAULT 0,  -- revenue del OWNER (post-fee)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments table (con split de comisión)
CREATE TABLE agent_payments (
  id              BIGSERIAL PRIMARY KEY,
  agent_id        TEXT NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  tx_hash         TEXT NOT NULL,
  amount_usdc     NUMERIC(10,6) NOT NULL,   -- total pagado por el usuario
  platform_usdc   NUMERIC(10,6) NOT NULL,   -- parte de AgentOS
  owner_usdc      NUMERIC(10,6) NOT NULL,   -- parte del creador del agente
  fee_bps         SMALLINT NOT NULL,         -- fee en basis points (ej: 500 = 5%)
  payer           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Platform payouts (cola de pagos pendientes al owner)
CREATE TABLE platform_payouts (
  id              BIGSERIAL PRIMARY KEY,
  agent_id        TEXT NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  owner_wallet    TEXT NOT NULL,
  owner_usdc      NUMERIC(10,6) NOT NULL,
  platform_usdc   NUMERIC(10,6) NOT NULL,
  source_tx_hash  TEXT NOT NULL,
  payout_tx_hash  TEXT,                      -- tx de pago al owner (se llena al procesar)
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);

-- Platform revenue (resumen diario para el dashboard de AgentOS)
CREATE TABLE platform_revenue (
  id              BIGSERIAL PRIMARY KEY,
  date            DATE NOT NULL UNIQUE,
  total_volume    NUMERIC(18,6) NOT NULL DEFAULT 0,   -- total procesado
  platform_fees   NUMERIC(18,6) NOT NULL DEFAULT 0,   -- lo que ganó AgentOS
  owner_payouts   NUMERIC(18,6) NOT NULL DEFAULT 0,   -- lo que ganaron los owners
  tx_count        BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Query logs
CREATE TABLE agent_queries (
  id          BIGSERIAL PRIMARY KEY,
  agent_id    TEXT NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  user_message TEXT NOT NULL,
  response    TEXT,
  tokens_used INTEGER,
  latency_ms  INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX idx_agents_owner    ON agents(owner);
CREATE INDEX idx_agents_status   ON agents(status);
CREATE INDEX idx_payments_agent  ON agent_payments(agent_id);
CREATE INDEX idx_payouts_status  ON platform_payouts(status);
CREATE INDEX idx_payouts_owner   ON platform_payouts(owner_wallet);

-- ── Functions ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_agent_uses(agent_id_param TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE agents
  SET uses_total = uses_total + 1, updated_at = NOW()
  WHERE agent_id = agent_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION add_agent_revenue(agent_id_param TEXT, amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE agents
  SET revenue_total = revenue_total + amount, updated_at = NOW()
  WHERE agent_id = agent_id_param;
END;
$$ LANGUAGE plpgsql;

-- Actualiza el resumen diario de revenue de la plataforma
CREATE OR REPLACE FUNCTION update_platform_revenue(
  volume NUMERIC,
  fee    NUMERIC,
  payout NUMERIC
) RETURNS VOID AS $$
BEGIN
  INSERT INTO platform_revenue (date, total_volume, platform_fees, owner_payouts, tx_count)
  VALUES (CURRENT_DATE, volume, fee, payout, 1)
  ON CONFLICT (date) DO UPDATE SET
    total_volume  = platform_revenue.total_volume  + volume,
    platform_fees = platform_revenue.platform_fees + fee,
    owner_payouts = platform_revenue.owner_payouts + payout,
    tx_count      = platform_revenue.tx_count + 1;
END;
$$ LANGUAGE plpgsql;

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE agents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_payouts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_revenue   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agentes activos son públicos"
  ON agents FOR SELECT USING (status = 'active');

CREATE POLICY "Solo service_role inserta pagos"
  ON agent_payments FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Solo service_role gestiona payouts"
  ON platform_payouts FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Solo service_role lee revenue"
  ON platform_revenue FOR ALL USING (auth.role() = 'service_role');

-- Agents table
CREATE TABLE agents (
  id              BIGSERIAL PRIMARY KEY,
  agent_id        TEXT UNIQUE NOT NULL,         -- timestamp string (= on-chain agentId)
  owner           TEXT NOT NULL,                -- wallet pubkey del creador
  name            TEXT NOT NULL,
  template        SMALLINT NOT NULL DEFAULT 0,  -- 0=Responder, 1=DeFi, 2=Content
  tone_index      SMALLINT NOT NULL DEFAULT 0,
  language        TEXT NOT NULL DEFAULT 'Español',
  system_prompt   TEXT NOT NULL,                -- el prompt completo en texto
  config_hash     TEXT NOT NULL,                -- sha256 del system_prompt (= lo que va on-chain)
  price_usdc      NUMERIC(10,6) NOT NULL DEFAULT 0.01,
  access_type     SMALLINT NOT NULL DEFAULT 0,  -- 0=Public, 1=NFT-Gated
  nft_collection  TEXT,                         -- address de colección NFT si aplica
  payment_wallet  TEXT NOT NULL,                -- wallet que recibe los pagos x402
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','closed')),
  uses_total      BIGINT NOT NULL DEFAULT 0,
  revenue_total   NUMERIC(18,6) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments table
CREATE TABLE agent_payments (
  id          BIGSERIAL PRIMARY KEY,
  agent_id    TEXT NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  tx_hash     TEXT NOT NULL,
  amount_usdc NUMERIC(10,6) NOT NULL,
  payer       TEXT,                             -- wallet del pagador (si disponible)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Query logs table
CREATE TABLE agent_queries (
  id          BIGSERIAL PRIMARY KEY,
  agent_id    TEXT NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  user_message TEXT NOT NULL,
  response    TEXT,
  tokens_used INTEGER,
  latency_ms  INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX idx_agents_owner    ON agents(owner);
CREATE INDEX idx_agents_status   ON agents(status);
CREATE INDEX idx_agents_template ON agents(template);
CREATE INDEX idx_payments_agent  ON agent_payments(agent_id);
CREATE INDEX idx_queries_agent   ON agent_queries(agent_id);

-- ── Function: increment uses ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_agent_uses(agent_id_param TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE agents
  SET
    uses_total = uses_total + 1,
    updated_at = NOW()
  WHERE agent_id = agent_id_param;
END;
$$ LANGUAGE plpgsql;

-- ── Function: add revenue ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION add_agent_revenue(agent_id_param TEXT, amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE agents
  SET
    revenue_total = revenue_total + amount,
    updated_at = NOW()
  WHERE agent_id = agent_id_param;
END;
$$ LANGUAGE plpgsql;

-- ── RLS Policies ──────────────────────────────────────────────────────────

ALTER TABLE agents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_queries  ENABLE ROW LEVEL SECURITY;

-- Agentes: lectura pública de agentes activos
CREATE POLICY "Agentes activos son públicos"
  ON agents FOR SELECT
  USING (status = 'active');

-- Payments: solo el service_role puede insertar
CREATE POLICY "Solo service_role inserta pagos"
  ON agent_payments FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Queries: solo el service_role puede insertar
CREATE POLICY "Solo service_role inserta queries"
  ON agent_queries FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ── Sample data (devnet) ──────────────────────────────────────────────────

INSERT INTO agents (agent_id, owner, name, template, system_prompt, config_hash, price_usdc, payment_wallet)
VALUES (
  '1700000000000',
  'Demo1111111111111111111111111111111111111111',
  'Demo Agent',
  0,
  'Eres un agente demo de AgentOS. Ayudas a los usuarios a entender cómo funciona la plataforma.',
  'demo_hash_placeholder',
  0.01,
  'Demo2222222222222222222222222222222222222222'
);
