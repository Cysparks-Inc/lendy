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