-- Extend auth_logs event set and make user_id optional for failed attempts
DO $$
BEGIN
  -- Relax NOT NULL on user_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='auth_logs' AND column_name='user_id' AND is_nullable='NO'
  ) THEN
    ALTER TABLE public.auth_logs ALTER COLUMN user_id DROP NOT NULL;
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Replace event constraint to include new events
DO $$
DECLARE
  cons_name text;
BEGIN
  SELECT constraint_name INTO cons_name
  FROM information_schema.constraint_column_usage
  WHERE table_schema='public' AND table_name='auth_logs' AND column_name='event'
  LIMIT 1;
  IF cons_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.auth_logs DROP CONSTRAINT %I', cons_name);
  END IF;
  ALTER TABLE public.auth_logs
  ADD CONSTRAINT auth_logs_event_check CHECK (event IN (
    'login','logout','login_failed','mfa_enrolled','mfa_disabled','user_created','user_deactivated','user_reactivated'
  ));
END $$;

-- Triggers on profiles to capture user_created and activation changes
CREATE OR REPLACE FUNCTION public.log_profile_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.auth_logs(user_id, event, ip, user_agent) VALUES (NEW.id, 'user_created', NULL, NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_profile_creation ON public.profiles;
CREATE TRIGGER trg_log_profile_creation
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.log_profile_creation();

CREATE OR REPLACE FUNCTION public.log_profile_activation_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    IF NEW.is_active = TRUE THEN
      INSERT INTO public.auth_logs(user_id, event) VALUES (NEW.id, 'user_reactivated');
    ELSE
      INSERT INTO public.auth_logs(user_id, event) VALUES (NEW.id, 'user_deactivated');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_profile_activation_change ON public.profiles;
CREATE TRIGGER trg_log_profile_activation_change
AFTER UPDATE OF is_active ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.log_profile_activation_change();

-- System metrics for uptime and component checks
CREATE TABLE IF NOT EXISTS public.system_metrics (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat TIMESTAMPTZ,
  db_ok BOOLEAN DEFAULT TRUE,
  storage_ok BOOLEAN DEFAULT TRUE,
  edge_ok BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_metrics_select_admins ON public.system_metrics;
CREATE POLICY system_metrics_select_admins ON public.system_metrics
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin'))
);

-- Retention: keep only latest 30 days of auth_logs
CREATE OR REPLACE FUNCTION public.cleanup_auth_logs_30d()
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.auth_logs WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


