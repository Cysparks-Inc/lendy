-- Add super_admin role to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Update user roles function to handle super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
    SELECT public.has_role(_user_id, 'super_admin');
$function$;

-- Add branch_id column to user_roles table for branch-based access control
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS branch_id uuid,
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Add branch table for managing branches
CREATE TABLE IF NOT EXISTS public.branches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    code text UNIQUE NOT NULL,
    location text,
    contact_person text,
    phone_number text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS on branches table
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Create policies for branches
CREATE POLICY "Super admins can manage all branches" 
ON public.branches 
FOR ALL 
USING (is_super_admin(auth.uid()));

CREATE POLICY "Staff can view their branch" 
ON public.branches 
FOR SELECT 
USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'staff'::app_role)
);

-- Add branch_id to customers for branch-based access
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);

-- Update customer policies for branch-based access
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
CREATE POLICY "Users can view customers from their branch or all if super admin" 
ON public.customers 
FOR SELECT 
USING (
    is_super_admin(auth.uid()) OR
    (
        (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)) 
        AND (
            branch_id IS NULL OR 
            branch_id IN (
                SELECT branch_id 
                FROM public.user_roles 
                WHERE user_id = auth.uid()
            )
        )
    )
);

-- Update user roles policies to allow super admin to manage users
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Super admins can manage all roles" 
ON public.user_roles 
FOR ALL 
USING (is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage roles in their branch" 
ON public.user_roles 
FOR ALL 
USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    (branch_id IS NULL OR branch_id IN (
        SELECT branch_id 
        FROM public.user_roles 
        WHERE user_id = auth.uid()
    ))
);

-- Create audit triggers for new tables
DROP TRIGGER IF EXISTS audit_branches_trigger ON public.branches;
CREATE TRIGGER audit_branches_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.branches
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

-- Update profiles table to disable public registration
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Only allow super admins to create profiles (disable self-registration)
CREATE POLICY "Only super admins can create profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (is_super_admin(auth.uid()));

-- Add updated_at trigger to branches
CREATE TRIGGER update_branches_updated_at
    BEFORE UPDATE ON public.branches
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();