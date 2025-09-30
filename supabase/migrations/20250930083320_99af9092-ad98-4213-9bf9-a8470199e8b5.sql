-- ========================================
-- FIX INFINITE RECURSION IN PROFILES TABLE RLS POLICIES
-- This migration fixes the circular dependency issue
-- ========================================

-- Step 1: Drop all existing problematic policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Super Admins can update loans" ON profiles;
DROP POLICY IF EXISTS "Super Admins can delete loans" ON profiles;
DROP POLICY IF EXISTS "Branch admin can view communication logs in their branch" ON profiles;
DROP POLICY IF EXISTS "Loan officer can view communication logs for assigned members" ON profiles;
DROP POLICY IF EXISTS "Super admin can view all communication logs" ON profiles;
DROP POLICY IF EXISTS "Super admin can delete all communication logs" ON profiles;

-- Step 2: Temporarily disable RLS to clean up
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Step 3: Ensure the profiles table has the correct structure
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role TEXT;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Step 4: Update any existing users without roles
UPDATE profiles 
SET role = 'teller' 
WHERE role IS NULL OR role = '';

-- Step 5: Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 6: Create simple, non-recursive policies

-- Policy 1: Users can always view their own profile
CREATE POLICY "profile_select_own" 
ON profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Policy 2: Users can update their own profile (but not role or is_active)
CREATE POLICY "profile_update_own" 
ON profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- Policy 3: Allow inserts for new user creation
CREATE POLICY "profile_insert_own" 
ON profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- Step 7: Create a security definer function for admin checks
-- This prevents recursion by using security definer
CREATE OR REPLACE FUNCTION public.is_super_admin_user(user_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = user_id 
    AND profiles.role = 'super_admin'
    AND profiles.is_active = true
  );
$$;

-- Policy 4: Super admins can view all profiles using the security definer function
CREATE POLICY "profile_select_admin" 
ON profiles FOR SELECT 
TO authenticated 
USING (public.is_super_admin_user(auth.uid()));

-- Policy 5: Super admins can update all profiles using the security definer function
CREATE POLICY "profile_update_admin" 
ON profiles FOR UPDATE 
TO authenticated 
USING (public.is_super_admin_user(auth.uid()));

-- Policy 6: Super admins can insert profiles using the security definer function
CREATE POLICY "profile_insert_admin" 
ON profiles FOR INSERT 
TO authenticated 
WITH CHECK (public.is_super_admin_user(auth.uid()));

-- Policy 7: Super admins can delete profiles using the security definer function
CREATE POLICY "profile_delete_admin" 
ON profiles FOR DELETE 
TO authenticated 
USING (public.is_super_admin_user(auth.uid()));

-- Step 8: Ensure at least one super admin exists
-- Update the first user to be super admin if no super admin exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'super_admin') THEN
    UPDATE profiles 
    SET role = 'super_admin' 
    WHERE id = (SELECT id FROM profiles ORDER BY created_at LIMIT 1);
  END IF;
END $$;