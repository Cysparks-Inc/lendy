-- Fix for migration 8: realizable_assets branch_id type mismatch
-- Run this AFTER migration 8 fails

-- The issue: migration 8 tries to create branch_id as bigint but branches.id is uuid

-- First, drop the realizable_assets table if it exists
DROP TABLE IF EXISTS public.realizable_assets CASCADE;

-- Now recreate it with the correct type
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
  branch_id uuid REFERENCES public.branches(id),  -- FIXED: Changed from bigint to uuid
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
-- Note: app_role enum has: 'super_admin', 'branch_admin', 'loan_officer', 'teller', 'auditor'
CREATE POLICY "Authenticated users can view realizable assets" 
ON public.realizable_assets 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert realizable assets" 
ON public.realizable_assets 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Authenticated users can update realizable assets" 
ON public.realizable_assets 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only super admins can delete realizable assets" 
ON public.realizable_assets 
FOR DELETE 
USING (is_super_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_realizable_assets_updated_at
BEFORE UPDATE ON public.realizable_assets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

