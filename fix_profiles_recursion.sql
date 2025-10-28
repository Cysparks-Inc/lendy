-- Fix infinite recursion in profiles RLS policies
-- The issue: Any policy that queries the profiles table causes infinite recursion

-- Step 1: Drop ALL existing policies on profiles
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON profiles';
    END LOOP;
END $$;

-- Step 2: Drop only the recursive function, keep is_admin
DROP FUNCTION IF EXISTS public.is_super_admin_user(uuid);
-- Don't drop is_admin - it's used by other tables and causes dependency errors

-- Step 3: Completely disable RLS on profiles to stop all recursion
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Step 4: Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 5: Create ONLY the most basic policies that don't query ANY tables
-- Users can view their own profile (ONLY checks auth.uid(), no queries)
CREATE POLICY "profile_select_own" 
ON profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Users can update their own profile (ONLY checks auth.uid(), no queries)
CREATE POLICY "profile_update_own" 
ON profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (needed for registration)
CREATE POLICY "profile_insert_own" 
ON profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- NO ADMIN POLICIES - rely on service role and edge functions for admin operations
-- This completely eliminates recursion because no policies query the profiles table

-- Done! The recursion is fixed because:
-- 1. All policies only use auth.uid() = id (no table queries at all)
-- 2. No admin policies that would query other tables
-- 3. Admin operations should use the service role (bypasses RLS)
