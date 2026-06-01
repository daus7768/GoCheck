-- Migration 009: Enable Supabase Realtime for participants
-- Without this, postgres_changes subscriptions on participants never receive events.
-- Idempotent: re-running on a table already in the publication is a no-op error,
-- so we guard with a DO block.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
  END IF;
END $$;

-- REPLICA IDENTITY FULL: ships the full row (not just PK) with UPDATE events.
-- Required so subscribers using filters like bill_id=eq.<uuid> actually
-- receive the event — otherwise Postgres only sends the PK and the filter
-- silently drops the change.
ALTER TABLE public.participants REPLICA IDENTITY FULL;
