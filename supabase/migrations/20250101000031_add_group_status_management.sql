-- Migration: Add active/inactive status management for groups
-- This adds the ability to set groups as active or inactive instead of deleting them

-- Add status columns to groups table
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES public.profiles(id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_groups_is_active ON public.groups(is_active);

-- Add comments
COMMENT ON COLUMN public.groups.is_active IS 'Whether the group is active (true) or inactive (false)';
COMMENT ON COLUMN public.groups.deactivated_at IS 'When the group was deactivated';
COMMENT ON COLUMN public.groups.deactivated_by IS 'Which admin deactivated the group';

-- Create function to deactivate a group (admin only)
CREATE OR REPLACE FUNCTION deactivate_group(group_id INTEGER, admin_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
    group_exists BOOLEAN;
BEGIN
    -- Check if user is super admin or branch admin
    SELECT role INTO user_role
    FROM profiles
    WHERE id = admin_user_id;
    
    IF user_role NOT IN ('super_admin', 'branch_admin') THEN
        RAISE EXCEPTION 'Only admins can deactivate groups';
    END IF;
    
    -- Check if group exists and is active
    SELECT EXISTS(
        SELECT 1 FROM groups 
        WHERE id = group_id AND is_active = true
    ) INTO group_exists;
    
    IF NOT group_exists THEN
        RAISE EXCEPTION 'Group not found or already inactive';
    END IF;
    
    -- Deactivate the group
    UPDATE groups 
    SET 
        is_active = false,
        deactivated_at = NOW(),
        deactivated_by = admin_user_id
    WHERE id = group_id;
    
    RETURN true;
END;
$$;

-- Create function to activate a group (admin only)
CREATE OR REPLACE FUNCTION activate_group(group_id INTEGER, admin_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
    group_exists BOOLEAN;
BEGIN
    -- Check if user is super admin or branch admin
    SELECT role INTO user_role
    FROM profiles
    WHERE id = admin_user_id;
    
    IF user_role NOT IN ('super_admin', 'branch_admin') THEN
        RAISE EXCEPTION 'Only admins can activate groups';
    END IF;
    
    -- Check if group exists and is inactive
    SELECT EXISTS(
        SELECT 1 FROM groups 
        WHERE id = group_id AND is_active = false
    ) INTO group_exists;
    
    IF NOT group_exists THEN
        RAISE EXCEPTION 'Group not found or already active';
    END IF;
    
    -- Activate the group
    UPDATE groups 
    SET 
        is_active = true,
        deactivated_at = NULL,
        deactivated_by = NULL
    WHERE id = group_id;
    
    RETURN true;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION deactivate_group(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION activate_group(INTEGER, UUID) TO authenticated;

-- Add comments
COMMENT ON FUNCTION deactivate_group(INTEGER, UUID) IS 'Deactivate a group (admin only)';
COMMENT ON FUNCTION activate_group(INTEGER, UUID) IS 'Activate a group (admin only)';

-- Update RLS policies to only show active groups by default
DROP POLICY IF EXISTS "Users can view groups" ON public.groups;
CREATE POLICY "Users can view active groups" ON public.groups
    FOR SELECT USING (
        is_active = true AND (
            -- Super admin can see all groups
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            ) OR
            -- Branch admin can see groups from their branch
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'branch_admin' 
                AND branch_id = groups.branch_id
            ) OR
            -- Loan officer can see groups assigned to them
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'loan_officer' 
                AND id = groups.loan_officer_id
            ) OR
            -- Auditor can see all groups
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'auditor'
            )
        )
    );

-- Create policy for admins to view inactive groups
CREATE POLICY "Admins can view inactive groups" ON public.groups
    FOR SELECT USING (
        is_active = false AND (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            ) OR
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'branch_admin' 
                AND branch_id = groups.branch_id
            )
        )
    );
