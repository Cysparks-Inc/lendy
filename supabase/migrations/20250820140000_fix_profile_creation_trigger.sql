-- Fix profile creation trigger and multiple super admin support
-- This migration ensures that when users are created, their profiles and roles are automatically created

-- First, drop the existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Update the handle_new_user function to properly handle role creation
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

-- Create the trigger to automatically create profiles and roles
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update the profiles RLS policies to allow the trigger to work
DROP POLICY IF EXISTS "Only super admins can create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Branch managers can view profiles in their branch" ON public.profiles;

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

-- Update the user_roles policies to ensure multiple super admins can work
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Branch managers can manage roles in their branch" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

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

-- Ensure the is_super_admin function works correctly
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

-- Ensure the has_role function works correctly
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

-- Ensure the is_admin function works correctly
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
    SELECT public.has_role(_user_id, 'admin');
$$;
