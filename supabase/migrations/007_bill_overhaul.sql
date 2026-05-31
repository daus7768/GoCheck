-- Migration 007: Bill overhaul — payment, tax toggles, receipt, invoice (idempotent)

-- ─── bills: new columns ───────────────────────────────────────────────────────
ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS tax_sst          BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_service      BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_service_rate DECIMAL(5,2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS payment_method   VARCHAR(20)
    CHECK (payment_method IN ('duitnow', 'bank_transfer', 'ewallet', 'cash')),
  ADD COLUMN IF NOT EXISTS payment_details  TEXT,
  ADD COLUMN IF NOT EXISTS receipt_url      TEXT,
  ADD COLUMN IF NOT EXISTS invite_token     TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS invoice_number   TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMPTZ;

-- ─── Back-fill invite_token for existing rows that have NULL ──────────────────
UPDATE bills SET invite_token = gen_random_uuid()::text WHERE invite_token IS NULL;

-- ─── Category enum: extend with sports and events ─────────────────────────────
-- bills.category is currently a VARCHAR — add a CHECK constraint instead of enum
-- (safer for idempotency than ALTER TYPE on a real enum)
DO $$
BEGIN
  -- Drop old constraint if it exists
  ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_category_check;
  -- Add updated constraint
  ALTER TABLE bills ADD CONSTRAINT bills_category_check
    CHECK (category IN ('travel', 'food', 'housing', 'sports', 'events', 'other'));
EXCEPTION WHEN others THEN
  NULL; -- ignore if category column doesn't have a constraint
END;
$$;

-- ─── invoice_seq + auto-generate invoice_number ───────────────────────────────
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1001;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-'
      || LPAD(nextval('invoice_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_invoice_number ON bills;
CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON bills
  FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();
