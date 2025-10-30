-- Nightly scheduled backup using pg_cron + pg_net + vault

-- Enable required extensions (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function that calls the backup edge function using service role key stored in vault
CREATE OR REPLACE FUNCTION public.run_nightly_backup()
RETURNS VOID AS $$
DECLARE
  functions_url TEXT;
BEGIN
  -- Set once: ALTER DATABASE current SET app.settings.functions_url = 'https://<project-ref>.functions.supabase.co/functions/v1';
  functions_url := current_setting('app.settings.functions_url', true);
  IF functions_url IS NULL OR functions_url = '' THEN
    RAISE NOTICE 'Backup skipped: app.settings.functions_url not set';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := functions_url || '/backup-snapshot',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule daily at 02:00 UTC (adjust as needed)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nightly_backups') THEN
    PERFORM cron.schedule('nightly_backups', '0 2 * * *', 'SELECT public.run_nightly_backup();');
  END IF;
END $$;

-- Hints:
-- 1) Set the functions URL once (from SQL editor) with your project ref:
--    ALTER DATABASE current SET app.settings.functions_url = 'https://<project-ref>.functions.supabase.co/functions/v1';
-- 2) Verify schedule: SELECT * FROM cron.job;
-- 3) Run immediately to test: SELECT public.run_nightly_backup();


