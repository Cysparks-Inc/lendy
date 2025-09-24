-- Migration: Add active/inactive status management for users
-- This adds the ability to set users as active or inactive to prevent login while keeping delete option

-- Add status columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES public.profiles(id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- Add comments
COMMENT ON COLUMN public.profiles.is_active IS 'Whether the user is active (true) or inactive (false) - inactive users cannot login';
COMMENT ON COLUMN public.profiles.deactivated_at IS 'When the user was deactivated';
COMMENT ON COLUMN public.profiles.deactivated_by IS 'Which admin deactivated the user';

-- Create function to deactivate a user (admin only)
CREATE OR REPLACE FUNCTION deactivate_user(user_id UUID, admin_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
    target_user_role TEXT;
    user_exists BOOLEAN;
BEGIN
    -- Check if admin user has permission
    SELECT role INTO user_role
    FROM profiles
    WHERE id = admin_user_id;
    
    -- Get target user role
    SELECT role INTO target_user_role
    FROM profiles
    WHERE id = user_id;
    
    -- Check permissions
    IF user_role = 'super_admin' THEN
        -- Super admin can deactivate anyone
        NULL;
    ELSIF user_role = 'branch_admin' AND target_user_role IN ('loan_officer', 'auditor') THEN
        -- Branch admin can deactivate loan officers and auditors
        NULL;
    ELSE
        RAISE EXCEPTION 'Insufficient permissions to deactivate this user';
    END IF;
    
    -- Check if user exists and is active
    SELECT EXISTS(
        SELECT 1 FROM profiles 
        WHERE id = user_id AND is_active = true
    ) INTO user_exists;
    
    IF NOT user_exists THEN
        RAISE EXCEPTION 'User not found or already inactive';
    END IF;
    
    -- Prevent self-deactivation
    IF user_id = admin_user_id THEN
        RAISE EXCEPTION 'Cannot deactivate yourself';
    END IF;
    
    -- Deactivate the user
    UPDATE profiles 
    SET 
        is_active = false,
        deactivated_at = NOW(),
        deactivated_by = admin_user_id
    WHERE id = user_id;
    
    RETURN true;
END;
$$;

-- Create function to activate a user (admin only)
CREATE OR REPLACE FUNCTION activate_user(user_id UUID, admin_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
    target_user_role TEXT;
    user_exists BOOLEAN;
BEGIN
    -- Check if admin user has permission
    SELECT role INTO user_role
    FROM profiles
    WHERE id = admin_user_id;
    
    -- Get target user role
    SELECT role INTO target_user_role
    FROM profiles
    WHERE id = user_id;
    
    -- Check permissions
    IF user_role = 'super_admin' THEN
        -- Super admin can activate anyone
        NULL;
    ELSIF user_role = 'branch_admin' AND target_user_role IN ('loan_officer', 'auditor') THEN
        -- Branch admin can activate loan officers and auditors
        NULL;
    ELSE
        RAISE EXCEPTION 'Insufficient permissions to activate this user';
    END IF;
    
    -- Check if user exists and is inactive
    SELECT EXISTS(
        SELECT 1 FROM profiles 
        WHERE id = user_id AND is_active = false
    ) INTO user_exists;
    
    IF NOT user_exists THEN
        RAISE EXCEPTION 'User not found or already active';
    END IF;
    
    -- Activate the user
    UPDATE profiles 
    SET 
        is_active = true,
        deactivated_at = NULL,
        deactivated_by = NULL
    WHERE id = user_id;
    
    RETURN true;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION deactivate_user(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION activate_user(UUID, UUID) TO authenticated;

-- Add comments
COMMENT ON FUNCTION deactivate_user(UUID, UUID) IS 'Deactivate a user (admin only)';
COMMENT ON FUNCTION activate_user(UUID, UUID) IS 'Activate a user (admin only)';

-- Update RLS policies to only show active users by default
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
CREATE POLICY "Users can view active profiles" ON public.profiles
    FOR SELECT USING (
        is_active = true AND (
            -- Super admin can see all active users
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            ) OR
            -- Branch admin can see active users from their branch
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'branch_admin' 
                AND branch_id = profiles.branch_id
            ) OR
            -- Users can see their own profile
            id = auth.uid() OR
            -- Auditor can see all active users
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'auditor'
            )
        )
    );

-- Create policy for admins to view inactive users
CREATE POLICY "Admins can view inactive profiles" ON public.profiles
    FOR SELECT USING (
        is_active = false AND (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            ) OR
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'branch_admin' 
                AND branch_id = profiles.branch_id
            )
        )
    );

-- Update the auth check function to include active status
CREATE OR REPLACE FUNCTION check_user_active(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1 FROM profiles 
        WHERE id = user_id AND is_active = true
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_user_active(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION check_user_active(UUID) IS 'Check if a user is active and can login';
