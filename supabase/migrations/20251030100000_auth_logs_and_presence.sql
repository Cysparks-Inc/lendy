-- Auth logs and presence tracking

-- Extend profiles for presence
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

-- Table for authentication logs
CREATE TABLE IF NOT EXISTS public.auth_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK (event IN ('login','logout')),
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.auth_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can view logs
DROP POLICY IF EXISTS auth_logs_select_super_admin ON public.auth_logs;
CREATE POLICY auth_logs_select_super_admin ON public.auth_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'super_admin'
  )
);

-- Allow insert of own log (optional - edge function will use service role)
DROP POLICY IF EXISTS auth_logs_insert_owner ON public.auth_logs;
CREATE POLICY auth_logs_insert_owner ON public.auth_logs
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own presence
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_update_presence_owner ON public.profiles;
CREATE POLICY profiles_update_presence_owner ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);


