-- Fix infinite recursion in user_roles RLS policies
-- The issue: policies use is_super_admin() which queries user_roles, causing infinite recursion

BEGIN;

-- Drop all existing policies on user_roles
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Branch admins can manage roles in their branch" ON public.user_roles;
DROP POLICY IF EXISTS "Branch managers can manage roles in their branch" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Temporarily disable RLS
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create minimal, non-recursive policies for user_roles
-- All authenticated users can view user_roles
CREATE POLICY "Authenticated users can view user_roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (true);

-- All authenticated users can insert user_roles (restrict in application logic if needed)
CREATE POLICY "Authenticated users can insert user_roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (true);

-- All authenticated users can update user_roles
CREATE POLICY "Authenticated users can update user_roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- All authenticated users can delete user_roles
CREATE POLICY "Authenticated users can delete user_roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (true);

COMMIT;

