-- Fix profiles table to allow direct insertion by service role
-- This migration ensures that the create-user edge function can directly insert profiles

-- First, ensure the profiles table has all necessary columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role public.app_role,
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id),
ADD COLUMN IF NOT EXISTS profile_picture_url text;

-- Drop all existing RLS policies on profiles to start fresh
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Branch admins can view profiles in their branch" ON public.profiles;
DROP POLICY IF EXISTS "Only super admins can create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create a simple, working RLS policy that allows the service role to insert profiles
-- The service role bypasses RLS, so this policy is for regular users
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Allow super admins to manage all profiles
CREATE POLICY "Super admins can manage all profiles"
ON public.profiles FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'super_admin'::public.app_role
    )
);

-- Allow branch admins to view profiles in their branch
CREATE POLICY "Branch admins can view profiles in their branch"
ON public.profiles FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur1
        JOIN public.user_roles ur2 ON ur1.branch_id = ur2.branch_id
        WHERE ur1.user_id = auth.uid()
        AND ur2.user_id = profiles.id
        AND ur1.branch_id IS NOT NULL
        AND ur1.role = 'branch_admin'::public.app_role
    )
);

-- Ensure the user_roles table has the correct structure
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id),
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

-- Drop all existing RLS policies on user_roles to start fresh
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Branch admins can manage roles in their branch" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

-- Create simple, working RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

-- Allow super admins to manage all roles
CREATE POLICY "Super admins can manage all roles"
ON public.user_roles FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'super_admin'::public.app_role
    )
);

-- Allow branch admins to manage roles in their branch
CREATE POLICY "Branch admins can manage roles in their branch"
ON public.user_roles FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'branch_admin'::public.app_role
        AND (branch_id IS NULL OR branch_id IN (
            SELECT branch_id 
            FROM public.user_roles 
            WHERE user_id = auth.uid()
            AND branch_id IS NOT NULL
        ))
    )
);

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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_branch_id ON public.user_roles(branch_id);
CREATE INDEX IF NOT EXISTS idx_profiles_branch_id ON public.profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Add trigger for updated_at on user_roles if it doesn't exist
DROP TRIGGER IF EXISTS update_user_roles_updated_at ON public.user_roles;
CREATE TRIGGER update_user_roles_updated_at
    BEFORE UPDATE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- Add trigger for updated_at on profiles if it doesn't exist
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

