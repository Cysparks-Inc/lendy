-- Create storage bucket for profile pictures
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-pictures', 'profile-pictures', true);

-- Create RLS policies for profile pictures storage
CREATE POLICY "Users can view profile pictures" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'profile-pictures');

CREATE POLICY "Users can upload their own profile picture" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own profile picture" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own profile picture" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add profile_picture_url column to profiles table
ALTER TABLE public.profiles ADD COLUMN profile_picture_url text;

-- Fix the profile creation trigger issue by updating the handle_new_user function
-- This function needs to bypass RLS to create profiles automatically
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
    END IF;
    
    RETURN NEW;
END;
$$;

-- Ensure the trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update the profiles RLS policies to allow the trigger to work
DROP POLICY IF EXISTS "Only super admins can create profiles" ON public.profiles;

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

-- Create a realizable_assets table for real data instead of mock data
CREATE TABLE public.realizable_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_type text NOT NULL CHECK (asset_type IN ('collateral', 'recoverable_loan', 'liquid_asset', 'investment')),
  description text NOT NULL,
  member_id uuid REFERENCES public.members(id),
  loan_id uuid REFERENCES public.loans(id),
  original_value numeric NOT NULL DEFAULT 0,
  current_market_value numeric NOT NULL DEFAULT 0,
  realizable_value numeric NOT NULL DEFAULT 0,
  realization_period integer NOT NULL DEFAULT 30, -- days
  risk_factor numeric NOT NULL DEFAULT 0 CHECK (risk_factor >= 0 AND risk_factor <= 100),
  location text,
  branch_id bigint REFERENCES public.branches(id),
  last_valuation_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_process', 'realized', 'disputed')),
  recovery_likelihood text NOT NULL DEFAULT 'medium' CHECK (recovery_likelihood IN ('high', 'medium', 'low')),
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on realizable_assets
ALTER TABLE public.realizable_assets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for realizable_assets
CREATE POLICY "Authenticated users can view realizable assets" 
ON public.realizable_assets 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Authenticated users can insert realizable assets" 
ON public.realizable_assets 
FOR INSERT 
WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)) AND (created_by = auth.uid()));

CREATE POLICY "Authenticated users can update realizable assets" 
ON public.realizable_assets 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Only admins can delete realizable assets" 
ON public.realizable_assets 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_realizable_assets_updated_at
BEFORE UPDATE ON public.realizable_assets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();