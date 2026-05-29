-- Reminders & per-organizer settings.
-- These use the same open-policy MVP model as bills (anon key, local organizer_id).

-- ─── reminders ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reminders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id   VARCHAR(255) NOT NULL,
  bill_id        UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  recipient_name VARCHAR(255) NOT NULL,
  channel        VARCHAR(20)  NOT NULL,
  sent_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_organizer_id ON reminders(organizer_id);
CREATE INDEX IF NOT EXISTS idx_reminders_bill_id      ON reminders(bill_id);
CREATE INDEX IF NOT EXISTS idx_reminders_sent_at      ON reminders(sent_at DESC);

-- ─── user_settings ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id VARCHAR(255) NOT NULL UNIQUE,
  reminders    JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_organizer_id ON user_settings(organizer_id);

CREATE OR REPLACE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Row Level Security (open MVP policies, matching bills) ──────────────────────

ALTER TABLE reminders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminders_select" ON reminders;
DROP POLICY IF EXISTS "reminders_insert" ON reminders;
CREATE POLICY "reminders_select" ON reminders FOR SELECT USING (true);
CREATE POLICY "reminders_insert" ON reminders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "user_settings_select" ON user_settings;
DROP POLICY IF EXISTS "user_settings_insert" ON user_settings;
DROP POLICY IF EXISTS "user_settings_update" ON user_settings;
CREATE POLICY "user_settings_select" ON user_settings FOR SELECT USING (true);
CREATE POLICY "user_settings_insert" ON user_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "user_settings_update" ON user_settings FOR UPDATE USING (true);
