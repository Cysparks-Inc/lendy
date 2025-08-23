-- Fix table structure and ensure correct table names
-- This migration addresses the table structure issues causing profile creation failures

-- First, let's check if we have the correct user_roles table structure
-- Drop the old user_branch_roles table if it exists and is not the one we want
DROP TABLE IF EXISTS public.user_branch_roles CASCADE;

-- Ensure the user_roles table has the correct structure
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL,
    branch_id UUID REFERENCES public.branches(id),
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- Add any missing columns to existing user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id),
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

-- Enable RLS on user_roles if not already enabled
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies that might be causing conflicts
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Branch admins can manage roles in their branch" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

-- Create the correct RLS policies for user_roles
-- Super admins can manage all roles
CREATE POLICY "Super admins can manage all roles"
ON public.user_roles FOR ALL
USING (is_super_admin(auth.uid()));

-- Branch admins can manage roles in their branch
CREATE POLICY "Branch admins can manage roles in their branch"
ON public.user_roles FOR ALL
USING (
    has_role(auth.uid(), 'branch_admin'::app_role) AND
    (branch_id IS NULL OR branch_id IN (
        SELECT branch_id 
        FROM public.user_roles 
        WHERE user_id = auth.uid()
        AND branch_id IS NOT NULL
    ))
);

-- Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

-- Ensure the profiles table has the correct structure
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id),
ADD COLUMN IF NOT EXISTS role public.app_role,
ADD COLUMN IF NOT EXISTS profile_picture_url text;

-- Enable RLS on profiles if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies that might be causing conflicts
DROP POLICY IF EXISTS "Only super admins can create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Branch admins can view profiles in their branch" ON public.profiles;

-- Create the correct RLS policies for profiles
-- Allow users to view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Allow super admins to manage all profiles
CREATE POLICY "Super admins can manage all profiles"
ON public.profiles FOR ALL
USING (is_super_admin(auth.uid()));

-- Allow branch admins to view profiles in their branch
CREATE POLICY "Branch admins can view profiles in their branch"
ON public.profiles FOR SELECT
USING (
    has_role(auth.uid(), 'branch_admin'::app_role) AND
    EXISTS (
        SELECT 1 FROM public.user_roles ur1
        JOIN public.user_roles ur2 ON ur1.branch_id = ur2.branch_id
        WHERE ur1.user_id = auth.uid()
        AND ur2.user_id = profiles.id
        AND ur1.branch_id IS NOT NULL
    )
);

-- Ensure the handle_new_user function exists and is correct
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert profile with all the user metadata
    INSERT INTO public.profiles (id, full_name, email, phone_number)
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name', 
            NEW.raw_user_meta_data->>'name',
            NEW.email
        ),
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'phone_number',
            NEW.raw_user_meta_data->>'phone',
            ''
        )
    );
    
    -- Also create the user role entry if role is specified in metadata
    IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
        BEGIN
            INSERT INTO public.user_roles (user_id, role, branch_id, created_by)
            VALUES (
                NEW.id,
                (NEW.raw_user_meta_data->>'role')::public.app_role,
                CASE 
                    WHEN NEW.raw_user_meta_data->>'branchId' IS NOT NULL 
                    THEN (NEW.raw_user_meta_data->>'branchId')::uuid
                    ELSE NULL
                END,
                CASE 
                    WHEN NEW.raw_user_meta_data->>'created_by' IS NOT NULL 
                    THEN (NEW.raw_user_meta_data->>'created_by')::uuid
                    ELSE NEW.id
                END
            );
        EXCEPTION WHEN OTHERS THEN
            -- Log the error but don't fail the profile creation
            RAISE WARNING 'Failed to create user role for user %: %', NEW.id, SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Ensure the trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure the helper functions exist and work correctly
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id AND role = 'super_admin'::public.app_role
    );
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE user_id = _user_id
        AND ur.role = _role
    );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
    SELECT public.has_role(_user_id, 'admin');
$$;

-- Add trigger for updated_at on user_roles if it doesn't exist
DROP TRIGGER IF EXISTS update_user_roles_updated_at ON public.user_roles;
CREATE TRIGGER update_user_roles_updated_at
    BEFORE UPDATE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_branch_id ON public.user_roles(branch_id);
CREATE INDEX IF NOT EXISTS idx_profiles_branch_id ON public.profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
