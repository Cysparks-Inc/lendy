-- Fix Profile Security - Prevent users from editing critical fields
-- This migration ensures users can only edit personal details, not their role or branch

-- Step 1: Create a secure profile update function
CREATE OR REPLACE FUNCTION update_profile_personal_details(
    user_id uuid,
    full_name text DEFAULT NULL,
    phone_number text DEFAULT NULL,
    profile_picture_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only allow users to update their own profile
    IF user_id != auth.uid() THEN
        RAISE EXCEPTION 'You can only update your own profile';
    END IF;
    
    -- Update only allowed fields
    UPDATE profiles 
    SET 
        full_name = COALESCE(update_profile_personal_details.full_name, full_name),
        phone_number = COALESCE(update_profile_personal_details.phone_number, phone_number),
        profile_picture_url = COALESCE(update_profile_personal_details.profile_picture_url, profile_picture_url),
        updated_at = NOW()
    WHERE id = user_id;
    
    -- Ensure critical fields are never changed
    -- role, branch_id, created_by remain unchanged
END;
$$;

-- Step 2: Create a secure profile view for users
CREATE OR REPLACE VIEW user_profile_view AS
SELECT 
    id,
    full_name,
    email,
    phone_number,
    profile_picture_url,
    role,
    branch_id,
    created_at,
    updated_at
FROM profiles;

-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION update_profile_personal_details TO authenticated;
GRANT SELECT ON user_profile_view TO authenticated;

-- Step 4: Create RLS policy for profiles table
-- Users can only read their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Users can only update their own profile through the secure function
CREATE POLICY "Users can update own profile through function" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Step 5: Create a secure profile update trigger
CREATE OR REPLACE FUNCTION prevent_critical_field_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Prevent updates to critical fields
    IF OLD.role != NEW.role THEN
        RAISE EXCEPTION 'Role cannot be changed through direct updates. Use admin functions instead.';
    END IF;
    
    IF OLD.branch_id != NEW.branch_id THEN
        RAISE EXCEPTION 'Branch ID cannot be changed through direct updates. Use admin functions instead.';
    END IF;
    
    IF OLD.created_by != NEW.created_by THEN
        RAISE EXCEPTION 'Created by cannot be changed through direct updates.';
    END IF;
    
    -- Allow updates to personal fields
    RETURN NEW;
END;
$$;

-- Step 6: Create the trigger
DROP TRIGGER IF EXISTS prevent_critical_profile_updates ON profiles;
CREATE TRIGGER prevent_critical_profile_updates
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_critical_field_updates();

-- Step 7: Create admin-only function for role/branch changes
CREATE OR REPLACE FUNCTION admin_update_user_role(
    admin_user_id uuid,
    target_user_id uuid,
    new_role text,
    new_branch_id integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    admin_role text;
BEGIN
    -- Only super admins can change roles
    SELECT role INTO admin_role FROM profiles WHERE id = admin_user_id;
    
    IF admin_role != 'super_admin' THEN
        RAISE EXCEPTION 'Only super admins can change user roles';
    END IF;
    
    -- Update the user's role and branch
    UPDATE profiles 
    SET 
        role = new_role,
        branch_id = new_branch_id,
        updated_at = NOW()
    WHERE id = target_user_id;
    
    -- Log the change
    INSERT INTO audit_logs (action, table_name, record_id, old_values, new_values, user_id)
    VALUES (
        'UPDATE_ROLE',
        'profiles',
        target_user_id,
        jsonb_build_object('role', (SELECT role FROM profiles WHERE id = target_user_id)),
        jsonb_build_object('role', new_role, 'branch_id', new_branch_id),
        admin_user_id
    );
END;
$$;

-- Step 8: Grant admin function permissions
GRANT EXECUTE ON FUNCTION admin_update_user_role TO authenticated;

-- Step 9: Create audit_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    action text NOT NULL,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    old_values jsonb,
    new_values jsonb,
    user_id uuid REFERENCES profiles(id),
    created_at timestamp with time zone DEFAULT NOW()
);

-- Step 10: Grant permissions on audit_logs
GRANT SELECT ON audit_logs TO authenticated;
GRANT INSERT ON audit_logs TO authenticated;
