-- Fix profiles RLS to allow authenticated users to view all profiles
-- This is needed for the User Management page to show all users

BEGIN;

-- Drop existing restrictive policies on profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Branch admins can view profiles in their branch" ON public.profiles;
DROP POLICY IF EXISTS "Profile can only insert their own" ON public.profiles;
DROP POLICY IF EXISTS "Profile can only update their own" ON public.profiles;

-- Temporarily disable RLS
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for authenticated users to view all profiles
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Allow authenticated users to insert profiles
CREATE POLICY "Authenticated users can insert profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to delete profiles
CREATE POLICY "Authenticated users can delete profiles"
ON public.profiles FOR DELETE
TO authenticated
USING (true);

COMMIT;

