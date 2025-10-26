-- Quick fix: Create is_super_admin function
-- Run this in SQL Editor BEFORE migration 9 (20250820140000)
-- This will fix the error: function is_super_admin(uuid) does not exist

-- First, try to add the 'super_admin' role to the enum if it doesn't exist
DO $$
BEGIN
    -- Check if 'super_admin' value exists in app_role enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'super_admin' 
        AND enumtypid = 'public.app_role'::regtype
    ) THEN
        ALTER TYPE public.app_role ADD VALUE 'super_admin';
    END IF;
END $$;

-- Create is_super_admin function using a safe approach
-- This checks the user_roles table for super_admin role
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Return true if user has super_admin role in user_roles table
    RETURN EXISTS (
        SELECT 1 
        FROM public.user_roles 
        WHERE user_id = _user_id 
        AND role::text = 'super_admin'
    );
EXCEPTION
    WHEN OTHERS THEN
        -- If anything goes wrong, return false
        RETURN false;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO anon;

-- Create has_role function (also missing from earlier migrations)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Return true if user has the specified role in user_roles table
    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = _user_id
        AND ur.role = _role
    );
EXCEPTION
    WHEN OTHERS THEN
        -- If anything goes wrong, return false
        RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon;

-- Create update_updated_at function (also used in migrations)
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Add branch_id column to user_roles table if it doesn't exist
-- This is needed for migration 8
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

-- IMPORTANT: Before running migration 8, you need to modify line 154
-- Change: branch_id bigint REFERENCES public.branches(id),
-- To:     branch_id uuid REFERENCES public.branches(id),
--
-- The issue is that migration 8 has a type mismatch: it uses bigint but branches.id is uuid
--
-- Alternative: Drop and recreate the table with the correct type after migration 8 runs
