-- Migration 006: FK enforcement, RLS policies, public RPCs, push token support

-- ─── expo_push_token column ────────────────────────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- ─── Clear orphaned rows (local random UUIDs that don't match auth.users) ─────
-- Only needed on dev/staging. Comment out if prod data has real auth UUIDs.
DELETE FROM public.reminders
  WHERE organizer_id::text NOT IN (SELECT id::text FROM auth.users);
DELETE FROM public.user_settings
  WHERE organizer_id::text NOT IN (SELECT id::text FROM auth.users);
DELETE FROM public.bills
  WHERE organizer_id::text NOT IN (SELECT id::text FROM auth.users);

-- ─── Change organizer_id to UUID FK ───────────────────────────────────────────
ALTER TABLE public.bills
  ALTER COLUMN organizer_id TYPE UUID USING organizer_id::UUID;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bills_organizer_id_fkey'
  ) THEN
    ALTER TABLE public.bills
      ADD CONSTRAINT bills_organizer_id_fkey
      FOREIGN KEY (organizer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.reminders
  ALTER COLUMN organizer_id TYPE UUID USING organizer_id::UUID;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reminders_organizer_id_fkey'
  ) THEN
    ALTER TABLE public.reminders
      ADD CONSTRAINT reminders_organizer_id_fkey
      FOREIGN KEY (organizer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.user_settings
  ALTER COLUMN organizer_id TYPE UUID USING organizer_id::UUID;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_organizer_id_fkey'
  ) THEN
    ALTER TABLE public.user_settings
      ADD CONSTRAINT user_settings_organizer_id_fkey
      FOREIGN KEY (organizer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─── Enable RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.bills          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_links    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings  ENABLE ROW LEVEL SECURITY;

-- ─── RLS: bills ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bills' AND policyname = 'organizer_all'
  ) THEN
    CREATE POLICY organizer_all ON public.bills
      FOR ALL
      USING     (organizer_id = auth.uid())
      WITH CHECK (organizer_id = auth.uid());
  END IF;
END $$;

-- ─── RLS: participants ────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'participants' AND policyname = 'organizer_all'
  ) THEN
    CREATE POLICY organizer_all ON public.participants
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.bills
          WHERE bills.id = participants.bill_id
            AND bills.organizer_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.bills
          WHERE bills.id = participants.bill_id
            AND bills.organizer_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ─── RLS: line_items ──────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'line_items' AND policyname = 'organizer_all'
  ) THEN
    CREATE POLICY organizer_all ON public.line_items
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.bills
          WHERE bills.id = line_items.bill_id
            AND bills.organizer_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.bills
          WHERE bills.id = line_items.bill_id
            AND bills.organizer_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ─── RLS: share_links (public read for active links, organizer write) ─────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'share_links' AND policyname = 'public_read_active'
  ) THEN
    CREATE POLICY public_read_active ON public.share_links
      FOR SELECT
      USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'share_links' AND policyname = 'organizer_write'
  ) THEN
    CREATE POLICY organizer_write ON public.share_links
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.bills
          WHERE bills.id = share_links.bill_id
            AND bills.organizer_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.bills
          WHERE bills.id = share_links.bill_id
            AND bills.organizer_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ─── RLS: payments ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'organizer_all'
  ) THEN
    CREATE POLICY organizer_all ON public.payments
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.bills
          WHERE bills.id = payments.bill_id
            AND bills.organizer_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.bills
          WHERE bills.id = payments.bill_id
            AND bills.organizer_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ─── RLS: reminders ───────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reminders' AND policyname = 'organizer_all'
  ) THEN
    CREATE POLICY organizer_all ON public.reminders
      FOR ALL
      USING     (organizer_id = auth.uid())
      WITH CHECK (organizer_id = auth.uid());
  END IF;
END $$;

-- ─── RLS: user_settings ───────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'organizer_all'
  ) THEN
    CREATE POLICY organizer_all ON public.user_settings
      FOR ALL
      USING     (organizer_id = auth.uid())
      WITH CHECK (organizer_id = auth.uid());
  END IF;
END $$;

-- ─── Public RPC: get_bill_by_share_link ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_bill_by_share_link(p_code TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_id UUID;
  v_result  json;
BEGIN
  SELECT bill_id INTO v_bill_id
  FROM share_links
  WHERE code = p_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF v_bill_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'id',             b.id,
    'title',          b.title,
    'description',    b.description,
    'total_amount',   b.total_amount,
    'currency',       b.currency,
    'due_date',       b.due_date,
    'status',         b.status,
    'share_link',     b.share_link,
    'category',       b.category,
    'is_recurring',   b.is_recurring,
    'group_photo_url',b.group_photo_url,
    'split_type',     b.split_type,
    'tax_rate',       b.tax_rate,
    'created_at',     b.created_at,
    'updated_at',     b.updated_at,
    'participants', (
      SELECT COALESCE(json_agg(json_build_object(
        'id',           p.id,
        'name',         p.name,
        'email',        p.email,
        'phone',        p.phone,
        'amount',       p.amount,
        'is_paid',      p.is_paid,
        'paid_at',      p.paid_at,
        'avatar_color', p.avatar_color,
        'shares',       p.shares,
        'percent',      p.percent
      )), '[]'::json)
      FROM participants p WHERE p.bill_id = b.id
    ),
    'line_items', (
      SELECT COALESCE(json_agg(json_build_object(
        'id',          li.id,
        'description', li.description,
        'quantity',    li.quantity,
        'unit_price',  li.unit_price
      )), '[]'::json)
      FROM line_items li WHERE li.bill_id = b.id
    )
  ) INTO v_result
  FROM bills b
  WHERE b.id = v_bill_id;

  RETURN v_result;
END;
$$;

-- ─── Public RPC: mark_participant_paid ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_participant_paid(
  p_share_code    TEXT,
  p_participant_id UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_id UUID;
  v_result  json;
BEGIN
  SELECT bill_id INTO v_bill_id
  FROM share_links
  WHERE code = p_share_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF v_bill_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired share link';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM participants
    WHERE id = p_participant_id AND bill_id = v_bill_id
  ) THEN
    RAISE EXCEPTION 'Participant not found for this bill';
  END IF;

  UPDATE participants
  SET is_paid = true, paid_at = now()
  WHERE id = p_participant_id AND bill_id = v_bill_id AND is_paid = false
  RETURNING json_build_object(
    'id',      id,
    'bill_id', bill_id,
    'is_paid', is_paid,
    'paid_at', paid_at
  ) INTO v_result;

  RETURN COALESCE(v_result, '{"already_paid": true}'::json);
END;
$$;

-- ─── Notification trigger (requires pg_net extension + edge function deployed) ─
-- Before running this section:
--   1. Enable pg_net in Supabase Dashboard > Database > Extensions
--   2. Set in Supabase Dashboard > Settings > Database > Configuration > Custom config:
--        app.edge_function_url = https://<your-project-ref>.supabase.co/functions/v1
--        app.internal_secret   = <output of: openssl rand -hex 32>

CREATE OR REPLACE FUNCTION public.notify_participant_paid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.is_paid = false AND NEW.is_paid = true THEN
    PERFORM net.http_post(
      url     := current_setting('app.edge_function_url', true) || '/notify-organizer',
      headers := jsonb_build_object(
        'Content-Type',      'application/json',
        'x-internal-secret', current_setting('app.internal_secret', true)
      ),
      body    := jsonb_build_object(
        'participant_id', NEW.id,
        'bill_id',        NEW.bill_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS participants_payment_notify ON public.participants;
CREATE TRIGGER participants_payment_notify
  AFTER UPDATE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.notify_participant_paid();
