-- GoCheck initial schema
-- Run this in Supabase Dashboard → SQL Editor, or via: supabase db push

-- ─── bills ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id    VARCHAR(255) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  total_amount    DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  currency        VARCHAR(3)   NOT NULL DEFAULT 'MYR',
  due_date        TIMESTAMPTZ  NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'complete', 'cancelled')),
  share_link      VARCHAR(255) NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bills_organizer_id ON bills(organizer_id);
CREATE INDEX IF NOT EXISTS idx_bills_share_link   ON bills(share_link);
CREATE INDEX IF NOT EXISTS idx_bills_created_at   ON bills(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bills_status       ON bills(status);

-- ─── participants ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS participants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id    UUID        NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255),
  amount     DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  is_paid    BOOLEAN      NOT NULL DEFAULT FALSE,
  paid_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_participants_bill_id   ON participants(bill_id);
CREATE INDEX IF NOT EXISTS idx_participants_bill_paid ON participants(bill_id, is_paid);

-- ─── payments (audit trail) ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id        UUID NOT NULL REFERENCES bills(id)        ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  amount         DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  status         VARCHAR(20)   NOT NULL DEFAULT 'confirmed'
                   CHECK (status IN ('pending', 'confirmed', 'failed')),
  confirmed_at   TIMESTAMPTZ DEFAULT NOW(),
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address     VARCHAR(45),
  user_agent     TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_bill_id        ON payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_participant_id ON payments(participant_id);
CREATE INDEX IF NOT EXISTS idx_payments_timestamp      ON payments(timestamp DESC);

-- ─── share_links ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS share_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(50)  NOT NULL UNIQUE,
  bill_id         UUID         NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  access_count    INTEGER      NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_share_links_code    ON share_links(code);
CREATE INDEX IF NOT EXISTS idx_share_links_bill_id ON share_links(bill_id);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_bills_updated_at
  BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_participants_updated_at
  BEFORE UPDATE ON participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- MVP uses open policies (no auth). Lock these down in Phase 2 with auth.

ALTER TABLE bills        ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links  ENABLE ROW LEVEL SECURITY;

-- bills: public CRUD (MVP)
CREATE POLICY "bills_select" ON bills FOR SELECT USING (true);
CREATE POLICY "bills_insert" ON bills FOR INSERT WITH CHECK (true);
CREATE POLICY "bills_update" ON bills FOR UPDATE USING (true);
CREATE POLICY "bills_delete" ON bills FOR DELETE USING (true);

-- participants: public CRUD
CREATE POLICY "participants_select" ON participants FOR SELECT USING (true);
CREATE POLICY "participants_insert" ON participants FOR INSERT WITH CHECK (true);
CREATE POLICY "participants_update" ON participants FOR UPDATE USING (true);
CREATE POLICY "participants_delete" ON participants FOR DELETE USING (true);

-- payments: public read + insert
CREATE POLICY "payments_select" ON payments FOR SELECT USING (true);
CREATE POLICY "payments_insert" ON payments FOR INSERT WITH CHECK (true);

-- share_links: public read + write
CREATE POLICY "share_links_select" ON share_links FOR SELECT USING (true);
CREATE POLICY "share_links_insert" ON share_links FOR INSERT WITH CHECK (true);
CREATE POLICY "share_links_update" ON share_links FOR UPDATE USING (true);
