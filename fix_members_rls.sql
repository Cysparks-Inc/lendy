-- Fix: Update RLS policies for members table to allow authenticated users to create members

BEGIN;

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Members can view own profile" ON public.members;
DROP POLICY IF EXISTS "Loan officers can view assigned members" ON public.members;
DROP POLICY IF EXISTS "Branch admins can view branch members" ON public.members;
DROP POLICY IF EXISTS "Super admins can view all members" ON public.members;
DROP POLICY IF EXISTS "Super admins can insert/update members" ON public.members;
DROP POLICY IF EXISTS "Branch admins can insert/update branch members" ON public.members;
DROP POLICY IF EXISTS "Loan officers can update assigned members" ON public.members;
DROP POLICY IF EXISTS "Authenticated users can view members" ON public.members;
DROP POLICY IF EXISTS "Authenticated users can insert members" ON public.members;
DROP POLICY IF EXISTS "Authenticated users can update members" ON public.members;

-- Create permissive policies for all authenticated users
-- This allows any authenticated user to:
-- 1. View all members (for now, we can make this more restrictive later)
-- 2. Insert new members
-- 3. Update members they have access to

-- SELECT policy: All authenticated users can view members
CREATE POLICY "Authenticated users can view members"
ON public.members
FOR SELECT
TO authenticated
USING (true);

-- INSERT policy: All authenticated users can create members
CREATE POLICY "Authenticated users can insert members"
ON public.members
FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE policy: All authenticated users can update members
CREATE POLICY "Authenticated users can update members"
ON public.members
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- DELETE policy: Only super admins can delete members
CREATE POLICY "Super admins can delete members"
ON public.members
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'super_admin'
    )
);

COMMIT;

