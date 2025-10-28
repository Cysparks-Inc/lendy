-- Fix: Update RLS policies for groups table to allow authenticated users to delete groups
BEGIN;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Groups can view own group" ON public.groups;
DROP POLICY IF EXISTS "Loan officers can view assigned groups" ON public.groups;
DROP POLICY IF EXISTS "Branch admins can manage groups in their branch" ON public.groups;
DROP POLICY IF EXISTS "Super admins can manage all groups" ON public.groups;
DROP POLICY IF EXISTS "Authenticated users can view groups" ON public.groups;
DROP POLICY IF EXISTS "Authenticated users can insert groups" ON public.groups;
DROP POLICY IF EXISTS "Authenticated users can update groups" ON public.groups;
DROP POLICY IF EXISTS "Authenticated users can delete groups" ON public.groups;

-- Re-enable RLS
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- SELECT: All authenticated users can view groups
CREATE POLICY "Authenticated users can view groups"
ON public.groups 
FOR SELECT 
TO authenticated 
USING (true);

-- INSERT: All authenticated users can create groups
CREATE POLICY "Authenticated users can insert groups"
ON public.groups 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- UPDATE: All authenticated users can update groups
CREATE POLICY "Authenticated users can update groups"
ON public.groups 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- DELETE: All authenticated users can delete groups (or only super admins)
CREATE POLICY "Authenticated users can delete groups"
ON public.groups 
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

