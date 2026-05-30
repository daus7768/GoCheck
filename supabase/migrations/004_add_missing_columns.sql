-- Migration 004: Add missing columns and tables (idempotent — safe to re-run)

-- ─── bills: add group_photo_url, split_type, tax_rate ────────────────────────
ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS group_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS split_type      VARCHAR(20) DEFAULT 'equal'
    CHECK (split_type IN ('equal', 'custom', 'percent', 'shares')),
  ADD COLUMN IF NOT EXISTS tax_rate        DECIMAL(5,2) DEFAULT 0;

-- ─── participants: add phone, avatar_color, shares, percent ──────────────────
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS phone        VARCHAR(30),
  ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(7)  DEFAULT '#4F46E5',
  ADD COLUMN IF NOT EXISTS shares       DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS percent      DECIMAL(7,4);

-- ─── line_items ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS line_items (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id     UUID          NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  description TEXT          NOT NULL DEFAULT '',
  quantity    DECIMAL(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_items_bill_id ON line_items(bill_id);

ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "line_items_select" ON line_items;
DROP POLICY IF EXISTS "line_items_insert" ON line_items;
DROP POLICY IF EXISTS "line_items_update" ON line_items;
DROP POLICY IF EXISTS "line_items_delete" ON line_items;
CREATE POLICY "line_items_select" ON line_items FOR SELECT USING (true);
CREATE POLICY "line_items_insert" ON line_items FOR INSERT WITH CHECK (true);
CREATE POLICY "line_items_update" ON line_items FOR UPDATE USING (true);
CREATE POLICY "line_items_delete" ON line_items FOR DELETE USING (true);

-- ─── reminders ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reminders (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id   VARCHAR(255)  NOT NULL,
  bill_id        UUID          NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  participant_id UUID          NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  recipient_name VARCHAR(255)  NOT NULL,
  channel        VARCHAR(20)   NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  sent_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_organizer ON reminders(organizer_id);
CREATE INDEX IF NOT EXISTS idx_reminders_bill_part ON reminders(bill_id, participant_id);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reminders_select" ON reminders;
DROP POLICY IF EXISTS "reminders_insert" ON reminders;
DROP POLICY IF EXISTS "reminders_delete" ON reminders;
CREATE POLICY "reminders_select" ON reminders FOR SELECT USING (true);
CREATE POLICY "reminders_insert" ON reminders FOR INSERT WITH CHECK (true);
CREATE POLICY "reminders_delete" ON reminders FOR DELETE USING (true);

-- ─── user_settings ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  organizer_id VARCHAR(255) PRIMARY KEY,
  reminders    JSONB        NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_settings_select" ON user_settings;
DROP POLICY IF EXISTS "user_settings_insert" ON user_settings;
DROP POLICY IF EXISTS "user_settings_update" ON user_settings;
CREATE POLICY "user_settings_select" ON user_settings FOR SELECT USING (true);
CREATE POLICY "user_settings_insert" ON user_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "user_settings_update" ON user_settings FOR UPDATE USING (true);
