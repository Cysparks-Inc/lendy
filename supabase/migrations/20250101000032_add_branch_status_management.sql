-- Migration: Add active/inactive status management for branches
-- This adds the ability to set branches as active or inactive instead of deleting them

-- Add status columns to branches table
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES public.profiles(id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_branches_is_active ON public.branches(is_active);

-- Add comments
COMMENT ON COLUMN public.branches.is_active IS 'Whether the branch is active (true) or inactive (false)';
COMMENT ON COLUMN public.branches.deactivated_at IS 'When the branch was deactivated';
COMMENT ON COLUMN public.branches.deactivated_by IS 'Which admin deactivated the branch';

-- Create function to deactivate a branch (super admin only)
CREATE OR REPLACE FUNCTION deactivate_branch(branch_id INTEGER, admin_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
    branch_exists BOOLEAN;
BEGIN
    -- Check if user is super admin
    SELECT role INTO user_role
    FROM profiles
    WHERE id = admin_user_id;
    
    IF user_role != 'super_admin' THEN
        RAISE EXCEPTION 'Only super admins can deactivate branches';
    END IF;
    
    -- Check if branch exists and is active
    SELECT EXISTS(
        SELECT 1 FROM branches 
        WHERE id = branch_id AND is_active = true
    ) INTO branch_exists;
    
    IF NOT branch_exists THEN
        RAISE EXCEPTION 'Branch not found or already inactive';
    END IF;
    
    -- Deactivate the branch
    UPDATE branches 
    SET 
        is_active = false,
        deactivated_at = NOW(),
        deactivated_by = admin_user_id
    WHERE id = branch_id;
    
    RETURN true;
END;
$$;

-- Create function to activate a branch (super admin only)
CREATE OR REPLACE FUNCTION activate_branch(branch_id INTEGER, admin_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
    branch_exists BOOLEAN;
BEGIN
    -- Check if user is super admin
    SELECT role INTO user_role
    FROM profiles
    WHERE id = admin_user_id;
    
    IF user_role != 'super_admin' THEN
        RAISE EXCEPTION 'Only super admins can activate branches';
    END IF;
    
    -- Check if branch exists and is inactive
    SELECT EXISTS(
        SELECT 1 FROM branches 
        WHERE id = branch_id AND is_active = false
    ) INTO branch_exists;
    
    IF NOT branch_exists THEN
        RAISE EXCEPTION 'Branch not found or already active';
    END IF;
    
    -- Activate the branch
    UPDATE branches 
    SET 
        is_active = true,
        deactivated_at = NULL,
        deactivated_by = NULL
    WHERE id = branch_id;
    
    RETURN true;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION deactivate_branch(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION activate_branch(INTEGER, UUID) TO authenticated;

-- Add comments
COMMENT ON FUNCTION deactivate_branch(INTEGER, UUID) IS 'Deactivate a branch (super admin only)';
COMMENT ON FUNCTION activate_branch(INTEGER, UUID) IS 'Activate a branch (super admin only)';

-- Update RLS policies to only show active branches by default
DROP POLICY IF EXISTS "Users can view branches" ON public.branches;
CREATE POLICY "Users can view active branches" ON public.branches
    FOR SELECT USING (
        is_active = true AND (
            -- Super admin can see all branches
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            ) OR
            -- Branch admin can see their own branch
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'branch_admin' 
                AND branch_id = branches.id
            ) OR
            -- Loan officer can see their assigned branch
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'loan_officer' 
                AND branch_id = branches.id
            ) OR
            -- Auditor can see all branches
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'auditor'
            )
        )
    );

-- Create policy for super admins to view inactive branches
CREATE POLICY "Super admins can view inactive branches" ON public.branches
    FOR SELECT USING (
        is_active = false AND EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );
