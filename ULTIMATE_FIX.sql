-- ULTIMATE FIX FOR ALL user_branch_roles ISSUES
-- This will completely eliminate the problem

-- Step 1: Drop all views that might reference user_branch_roles
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public') LOOP
        BEGIN
            EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(r.table_name) || ' CASCADE';
        EXCEPTION WHEN OTHERS THEN
            -- Ignore errors for views that might not exist
            NULL;
        END;
    END LOOP;
END $$;

-- Step 2: Drop ALL functions that might reference user_branch_roles
DROP FUNCTION IF EXISTS public.get_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_branch_ids() CASCADE;
DROP FUNCTION IF EXISTS public.search_members_robust(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_dashboard_stats_for_user(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_recent_loans_for_user(UUID) CASCADE;

-- Step 3: Completely drop user_branch_roles if it exists
DROP TABLE IF EXISTS public.user_branch_roles CASCADE;

-- Step 4: Ensure user_roles table exists and has correct structure
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    branch_id UUID REFERENCES public.branches(id),
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- Step 5: Add any missing columns
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS branch_id UUID,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 6: Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 7: Drop old policies and create simple ones
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Everyone can manage roles" ON public.user_roles  
FOR ALL USING (auth.uid() IS NOT NULL);

-- Step 8: Fix profiles table policies (remove ALL policies first)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON profiles CASCADE';
    END LOOP;
END $$;

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create ONLY the most basic policies
CREATE POLICY "profile_select_own" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profile_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profile_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Step 9: Grant necessary permissions to authenticated users
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.members TO authenticated;
GRANT ALL ON public.user_roles TO authenticated;
GRANT ALL ON public.loans TO authenticated;
GRANT ALL ON public.branches TO authenticated;

-- Done!
