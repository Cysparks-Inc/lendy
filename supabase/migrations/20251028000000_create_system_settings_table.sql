-- Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.system_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Singleton table, only one row allowed
  company_name TEXT NOT NULL DEFAULT 'Lendy Microfinance',
  company_email TEXT,
  company_phone TEXT,
  default_interest_rate DECIMAL(5, 2) DEFAULT 0.00,
  default_penalty_rate DECIMAL(5, 2) DEFAULT 0.00,
  max_loan_amount DECIMAL(12, 2) DEFAULT 0.00,
  min_loan_amount DECIMAL(12, 2) DEFAULT 0.00,
  loan_term_months INTEGER DEFAULT 0,
  auto_calculate_interest BOOLEAN DEFAULT TRUE,
  sms_notifications BOOLEAN DEFAULT FALSE,
  email_notifications BOOLEAN DEFAULT FALSE,
  backup_frequency TEXT DEFAULT 'daily',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default row if it doesn't exist
INSERT INTO public.system_settings (id, company_name, company_email, company_phone, default_interest_rate, default_penalty_rate, max_loan_amount, min_loan_amount, loan_term_months)
VALUES (1, 'Lendy Microfinance', 'info@lendy.co.ke', '+254700000000', 0.00, 0.00, 0.00, 0.00, 0)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for system_settings
-- Allow authenticated users to read (view)
CREATE POLICY "Allow authenticated users to view system settings"
  ON public.system_settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow only super admins to update
CREATE POLICY "Allow super admins to update system settings"
  ON public.system_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Update the updated_at timestamp on update
CREATE OR REPLACE FUNCTION update_system_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_timestamp();

