-- Fix infinite recursion in profiles RLS policies
-- The issue: Policies that query profiles table cause infinite recursion

-- Step 1: Drop all problematic policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "profile_select_own" ON profiles;
DROP POLICY IF EXISTS "profile_update_own" ON profiles;
DROP POLICY IF EXISTS "profile_select_admin" ON profiles;
DROP POLICY IF EXISTS "profile_update_admin" ON profiles;
DROP POLICY IF EXISTS "profile_insert_admin" ON profiles;
DROP POLICY IF EXISTS "profile_delete_admin" ON profiles;
DROP POLICY IF EXISTS "profile_insert_own" ON profiles;
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Branch admins can view profiles in their branch" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile through function" ON profiles;
DROP POLICY IF EXISTS "Only super admins can create profiles" ON profiles;

-- Step 2: Drop the recursive function
DROP FUNCTION IF EXISTS public.is_super_admin_user(uuid);

-- Step 3: Temporarily disable RLS to clean up
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Step 4: Enable RLS with simple policies that don't query profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 5: Create simple, non-recursive policies
-- Users can view their own profile (simple check, no recursion)
CREATE POLICY "profile_select_own" 
ON profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Users can update their own profile (simple check, no recursion)
CREATE POLICY "profile_update_own" 
ON profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow inserts for authenticated users (needed for user creation)
CREATE POLICY "profile_insert_authenticated" 
ON profiles FOR INSERT 
TO authenticated 
WITH CHECK (true); -- Allow all authenticated users to create profiles

-- Allow service role to do everything (bypasses RLS)
-- No policy needed - service role bypasses RLS automatically

-- Step 6: Create a security definer function for admin checks that doesn't cause recursion
-- This function checks user_roles table instead of profiles table
CREATE OR REPLACE FUNCTION public.is_super_admin_user(user_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = user_id 
    AND user_roles.role::text = 'super_admin'
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_super_admin_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin_user(uuid) TO anon;

-- Step 7: Create admin policies using the non-recursive function
CREATE POLICY "profile_admin_all" 
ON profiles FOR ALL 
TO authenticated 
USING (public.is_super_admin_user(auth.uid()));

-- Done! The recursion is fixed because:
-- 1. Regular user policies only check auth.uid() = id (no profile query)
-- 2. Admin policies use security definer function that queries user_roles, not profiles
-- 3. Service role bypasses RLS entirely
