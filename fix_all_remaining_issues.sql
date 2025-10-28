-- Final comprehensive fix for all database issues
-- This addresses:
-- 1. Missing user_branch_roles references in functions
-- 2. Infinite recursion in profiles
-- 3. All remaining table mismatches

-- Step 1: Drop ALL policies on profiles to reset everything
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON profiles';
    END LOOP;
END $$;

-- Step 2: Completely disable and re-enable RLS on profiles
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 3: Create ONLY the most basic policies
CREATE POLICY "profile_select_own" 
ON profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "profile_update_own" 
ON profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "profile_insert_own" 
ON profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- Step 4: Fix any functions that reference user_branch_roles
-- First, ensure user_branch_roles table doesn't exist at all
DROP TABLE IF EXISTS public.user_branch_roles CASCADE;

-- Step 5: Fix the comprehensive_loan_fixes migration's function
CREATE OR REPLACE FUNCTION public.search_members_robust(search_text TEXT, current_user_id UUID)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    member_id TEXT,
    phone TEXT,
    email TEXT,
    status TEXT,
    branch_id UUID,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.full_name,
        m.member_id,
        m.phone,
        m.email,
        m.status::TEXT,
        m.branch_id,
        m.created_at
    FROM public.members m
    WHERE (
        m.full_name ILIKE '%' || search_text || '%'
        OR m.member_id ILIKE '%' || search_text || '%'
        OR m.phone ILIKE '%' || search_text || '%'
        OR m.email ILIKE '%' || search_text || '%'
    )
    AND (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = current_user_id
            AND p.role::text = 'loan_officer'
            AND p.id = m.assigned_officer_id
        )
        OR
        m.branch_id = ANY(
            SELECT ur.branch_id FROM public.user_roles ur
            WHERE ur.user_id = current_user_id AND ur.branch_id IS NOT NULL
        )
    )
    ORDER BY m.full_name
    LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_members_robust(TEXT, UUID) TO authenticated;

-- Step 6: Grant all necessary permissions
GRANT ALL ON public.user_roles TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.members TO authenticated;

-- Done!
