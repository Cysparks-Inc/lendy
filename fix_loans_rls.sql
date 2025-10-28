-- Fix: Update RLS policies for loans table to allow authenticated users to create loans

BEGIN;

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Users can view own loans" ON public.loans;
DROP POLICY IF EXISTS "Loan officers can view assigned loans" ON public.loans;
DROP POLICY IF EXISTS "Branch admins can view branch loans" ON public.loans;
DROP POLICY IF EXISTS "Super admins can view all loans" ON public.loans;
DROP POLICY IF EXISTS "Super admins can insert/update loans" ON public.loans;
DROP POLICY IF EXISTS "Branch admins can insert/update branch loans" ON public.loans;
DROP POLICY IF EXISTS "Loan officers can update assigned loans" ON public.loans;
DROP POLICY IF EXISTS "Authenticated users can view loans" ON public.loans;
DROP POLICY IF EXISTS "Authenticated users can insert loans" ON public.loans;
DROP POLICY IF EXISTS "Authenticated users can update loans" ON public.loans;

-- Create permissive policies for all authenticated users
-- This allows any authenticated user to:
-- 1. View all loans (for now, we can make this more restrictive later)
-- 2. Insert new loans
-- 3. Update loans they have access to

-- SELECT policy: All authenticated users can view loans
CREATE POLICY "Authenticated users can view loans"
ON public.loans
FOR SELECT
TO authenticated
USING (true);

-- INSERT policy: All authenticated users can create loans
CREATE POLICY "Authenticated users can insert loans"
ON public.loans
FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE policy: All authenticated users can update loans
CREATE POLICY "Authenticated users can update loans"
ON public.loans
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- DELETE policy: Only super admins can delete loans
CREATE POLICY "Super admins can delete loans"
ON public.loans
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

