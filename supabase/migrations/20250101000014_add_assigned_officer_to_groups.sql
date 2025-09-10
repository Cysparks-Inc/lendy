-- Add assigned_officer_id column to groups table
-- This allows admins to assign loan officers to groups

-- Add the assigned_officer_id column to groups table
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS assigned_officer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add a comment to document the column
COMMENT ON COLUMN public.groups.assigned_officer_id IS 'ID of the loan officer assigned to manage this group';

-- Create an index for better performance when querying by assigned officer
CREATE INDEX IF NOT EXISTS idx_groups_assigned_officer_id ON public.groups(assigned_officer_id);

-- Update RLS policies to allow loan officers to see groups assigned to them
-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view groups" ON public.groups;
DROP POLICY IF EXISTS "Users can insert groups" ON public.groups;
DROP POLICY IF EXISTS "Users can update groups" ON public.groups;

-- Create new RLS policies that consider assigned officers
CREATE POLICY "Users can view groups"
    ON public.groups FOR SELECT
    USING (
        -- Super admins can see all groups
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
        OR
        -- Branch admins can see groups in their branch
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'branch_admin'
            AND branch_id = groups.branch_id
        )
        OR
        -- Loan officers can see groups assigned to them
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'loan_officer'
            AND id = groups.assigned_officer_id
        )
    );

CREATE POLICY "Users can insert groups"
    ON public.groups FOR INSERT
    WITH CHECK (
        -- Only super admins and branch admins can create groups
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'branch_admin')
        )
    );

CREATE POLICY "Users can update groups"
    ON public.groups FOR UPDATE
    USING (
        -- Super admins can update all groups
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
        OR
        -- Branch admins can update groups in their branch
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'branch_admin'
            AND branch_id = groups.branch_id
        )
        OR
        -- Loan officers can update groups assigned to them (limited fields)
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'loan_officer'
            AND id = groups.assigned_officer_id
        )
    );
