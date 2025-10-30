-- Drop existing conflicting tables and types
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.user_branch_roles CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- Create comprehensive microfinance database schema
-- 1. Create enums
CREATE TYPE public.app_role AS ENUM ('super_admin', 'branch_admin', 'loan_officer', 'teller', 'auditor');
CREATE TYPE public.member_status AS ENUM ('active', 'inactive', 'suspended', 'deceased');
CREATE TYPE public.group_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE public.loan_status AS ENUM ('pending', 'approved', 'disbursed', 'active', 'completed', 'defaulted', 'written_off');
CREATE TYPE public.loan_interest_method AS ENUM ('flat', 'reducing_balance', 'simple');
CREATE TYPE public.payment_method AS ENUM ('cash', 'mobile_money', 'bank_transfer', 'cheque');
CREATE TYPE public.collateral_type AS ENUM ('land_title', 'vehicle', 'household_items', 'business_assets', 'guarantor');
CREATE TYPE public.document_type AS ENUM ('id_copy', 'passport_photo', 'business_permit', 'payslip', 'bank_statement', 'collateral_doc');

-- 2. Organizations table
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enhanced branches table
DROP TABLE IF EXISTS public.branches CASCADE;
CREATE TABLE public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) DEFAULT NULL,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    location TEXT,
    phone TEXT,
    email TEXT,
    manager_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enhanced profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_id TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 5. User branch roles table
CREATE TABLE public.user_branch_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    assigned_by UUID REFERENCES public.profiles(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, branch_id, role)
);

-- 6. Groups table
DROP TABLE IF EXISTS public.groups CASCADE;
CREATE TABLE public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    meeting_day INTEGER CHECK (meeting_day BETWEEN 1 AND 7), -- 1=Monday, 7=Sunday
    meeting_time TIME,
    location TEXT,
    status public.group_status DEFAULT 'active',
    max_members INTEGER DEFAULT 30,
    current_members INTEGER DEFAULT 0,
    loan_officer_id UUID REFERENCES public.profiles(id),
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Enhanced members table
DROP TABLE IF EXISTS public.members CASCADE;
CREATE TABLE public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id),
    group_id UUID REFERENCES public.groups(id),
    member_no TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    id_number TEXT UNIQUE NOT NULL,
    phone_number TEXT NOT NULL,
    email TEXT,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    marital_status TEXT CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed')),
    address TEXT,
    occupation TEXT,
    monthly_income DECIMAL(15,2),
    next_of_kin_name TEXT,
    next_of_kin_phone TEXT,
    next_of_kin_relationship TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    photo_url TEXT,
    kyc_data JSONB DEFAULT '{}',
    risk_score INTEGER DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
    status public.member_status DEFAULT 'active',
    registration_fee_paid BOOLEAN DEFAULT false,
    shares_balance DECIMAL(15,2) DEFAULT 0,
    savings_balance DECIMAL(15,2) DEFAULT 0,
    total_loans_disbursed DECIMAL(15,2) DEFAULT 0,
    current_loan_balance DECIMAL(15,2) DEFAULT 0,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Member documents table
CREATE TABLE public.member_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    document_type public.document_type NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_hash TEXT,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES public.profiles(id),
    verified_at TIMESTAMPTZ,
    notes TEXT
);

-- 9. Collateral table
CREATE TABLE public.collateral (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id),
    collateral_type public.collateral_type NOT NULL,
    description TEXT NOT NULL,
    estimated_value DECIMAL(15,2) NOT NULL,
    market_value DECIMAL(15,2),
    ownership_document TEXT,
    location TEXT,
    condition_notes TEXT,
    valuation_date DATE,
    valuated_by TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Penalty policies table
CREATE TABLE public.penalty_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    penalty_type TEXT CHECK (penalty_type IN ('flat', 'percentage')) DEFAULT 'percentage',
    rate_per_day DECIMAL(5,4) NOT NULL,
    grace_days INTEGER DEFAULT 0,
    cap_percentage DECIMAL(5,2), -- Maximum penalty as % of principal
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Loan products table
CREATE TABLE public.loan_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    min_amount DECIMAL(15,2) NOT NULL,
    max_amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,4) NOT NULL,
    interest_method public.loan_interest_method DEFAULT 'reducing_balance',
    min_term_months INTEGER NOT NULL,
    max_term_months INTEGER NOT NULL,
    processing_fee_rate DECIMAL(5,4) DEFAULT 0,
    penalty_policy_id UUID REFERENCES public.penalty_policies(id),
    requires_collateral BOOLEAN DEFAULT false,
    requires_guarantor BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Enhanced loans table
DROP TABLE IF EXISTS public.loans CASCADE;
CREATE TABLE public.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id),
    member_id UUID NOT NULL REFERENCES public.members(id),
    group_id UUID REFERENCES public.groups(id),
    loan_officer_id UUID REFERENCES public.profiles(id),
    loan_product_id UUID REFERENCES public.loan_products(id),
    application_no TEXT UNIQUE NOT NULL,
    principal_amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,4) NOT NULL,
    interest_method public.loan_interest_method DEFAULT 'reducing_balance',
    term_months INTEGER NOT NULL,
    processing_fee DECIMAL(15,2) DEFAULT 0,
    insurance_fee DECIMAL(15,2) DEFAULT 0,
    total_fees DECIMAL(15,2) DEFAULT 0,
    disbursed_amount DECIMAL(15,2),
    purpose TEXT,
    collateral_description TEXT,
    guarantor_info JSONB DEFAULT '[]',
    status public.loan_status DEFAULT 'pending',
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.profiles(id),
    disbursed_at TIMESTAMPTZ,
    disbursed_by UUID REFERENCES public.profiles(id),
    maturity_date DATE,
    total_due DECIMAL(15,2) DEFAULT 0,
    principal_paid DECIMAL(15,2) DEFAULT 0,
    interest_paid DECIMAL(15,2) DEFAULT 0,
    penalty_paid DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    days_in_arrears INTEGER DEFAULT 0,
    penalty_policy_id UUID REFERENCES public.penalty_policies(id),
    restructured_count INTEGER DEFAULT 0,
    written_off_at TIMESTAMPTZ,
    written_off_by UUID REFERENCES public.profiles(id),
    written_off_amount DECIMAL(15,2),
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Loan schedule table
CREATE TABLE public.loan_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    installment_no INTEGER NOT NULL,
    due_date DATE NOT NULL,
    principal_due DECIMAL(15,2) NOT NULL,
    interest_due DECIMAL(15,2) NOT NULL,
    total_due DECIMAL(15,2) NOT NULL,
    principal_paid DECIMAL(15,2) DEFAULT 0,
    interest_paid DECIMAL(15,2) DEFAULT 0,
    penalty_paid DECIMAL(15,2) DEFAULT 0,
    total_paid DECIMAL(15,2) DEFAULT 0,
    balance_after DECIMAL(15,2) NOT NULL,
    days_late INTEGER DEFAULT 0,
    penalty_amount DECIMAL(15,2) DEFAULT 0,
    is_paid BOOLEAN DEFAULT false,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(loan_id, installment_no)
);

-- 14. Enhanced repayments table
DROP TABLE IF EXISTS public.repayments CASCADE;
CREATE TABLE public.repayments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES public.loans(id),
    schedule_id UUID REFERENCES public.loan_schedule(id),
    receipt_no TEXT UNIQUE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    principal_portion DECIMAL(15,2) DEFAULT 0,
    interest_portion DECIMAL(15,2) DEFAULT 0,
    penalty_portion DECIMAL(15,2) DEFAULT 0,
    excess_amount DECIMAL(15,2) DEFAULT 0,
    payment_method public.payment_method NOT NULL,
    reference_no TEXT,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    received_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Guarantors table
CREATE TABLE public.guarantors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES public.loans(id),
    guarantor_id UUID REFERENCES public.members(id), -- If guarantor is also a member
    name TEXT NOT NULL,
    id_number TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    address TEXT,
    relationship_to_borrower TEXT,
    guarantee_amount DECIMAL(15,2) NOT NULL,
    signature_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default organization
INSERT INTO public.organizations (name, code) VALUES ('Pett Vision', 'PETT');

-- Insert default branches
INSERT INTO public.branches (name, code, location) VALUES 
('Nairobi Central', 'NBC', 'Nairobi CBD'),
('Mombasa Branch', 'MBA', 'Mombasa Town'),
('Kisumu Branch', 'KSM', 'Kisumu City'),
('Nakuru Branch', 'NKR', 'Nakuru Town');

-- Insert default penalty policy
INSERT INTO public.penalty_policies (name, description, penalty_type, rate_per_day, grace_days, cap_percentage) VALUES
('Standard Penalty', 'Standard penalty policy for all loans', 'percentage', 0.05, 7, 25.00);

-- Insert default loan products
INSERT INTO public.loan_products (name, description, min_amount, max_amount, interest_rate, min_term_months, max_term_months, processing_fee_rate) VALUES
('Business Loan', 'For business expansion and working capital', 10000, 500000, 0.15, 6, 24, 0.02),
('Emergency Loan', 'Quick loans for emergencies', 5000, 100000, 0.18, 3, 12, 0.03),
('Asset Finance', 'For purchasing business assets', 50000, 1000000, 0.12, 12, 36, 0.025);

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branch_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collateral ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penalty_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guarantors ENABLE ROW LEVEL SECURITY;

-- Create security definer functions
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.app_role
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT role FROM public.user_branch_roles 
    WHERE user_id = auth.uid() AND is_active = true 
    ORDER BY CASE role 
        WHEN 'super_admin' THEN 1
        WHEN 'branch_admin' THEN 2
        WHEN 'loan_officer' THEN 3
        WHEN 'teller' THEN 4
        WHEN 'auditor' THEN 5
    END LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS(
        SELECT 1 FROM public.user_branch_roles 
        WHERE user_id = auth.uid() 
        AND role = 'super_admin' 
        AND is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.get_user_branches()
RETURNS UUID[]
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT ARRAY_AGG(branch_id) FROM public.user_branch_roles 
    WHERE user_id = auth.uid() AND is_active = true;
$$;

-- Create comprehensive RLS policies
-- Organizations policies
CREATE POLICY "Only super admins can manage organizations" ON public.organizations
FOR ALL USING (public.is_super_admin());

-- Branches policies
CREATE POLICY "Super admins can view all branches" ON public.branches
FOR SELECT USING (public.is_super_admin());

CREATE POLICY "Users can view their assigned branches" ON public.branches
FOR SELECT USING (id = ANY(public.get_user_branches()));

CREATE POLICY "Super admins can manage all branches" ON public.branches
FOR ALL USING (public.is_super_admin());

-- User branch roles policies
CREATE POLICY "Super admins can manage all roles" ON public.user_branch_roles
FOR ALL USING (public.is_super_admin());

CREATE POLICY "Users can view their own roles" ON public.user_branch_roles
FOR SELECT USING (user_id = auth.uid());

-- Members policies
CREATE POLICY "Users can view members from their branches" ON public.members
FOR SELECT USING (branch_id = ANY(public.get_user_branches()) OR public.is_super_admin());

CREATE POLICY "Staff can insert members in their branches" ON public.members
FOR INSERT WITH CHECK (
    (branch_id = ANY(public.get_user_branches()) OR public.is_super_admin()) 
    AND created_by = auth.uid()
);

CREATE POLICY "Staff can update members in their branches" ON public.members
FOR UPDATE USING (branch_id = ANY(public.get_user_branches()) OR public.is_super_admin());

-- Similar policies for other tables
CREATE POLICY "Branch access for groups" ON public.groups
FOR ALL USING (branch_id = ANY(public.get_user_branches()) OR public.is_super_admin());

CREATE POLICY "Branch access for loans" ON public.loans
FOR ALL USING (branch_id = ANY(public.get_user_branches()) OR public.is_super_admin());

CREATE POLICY "Branch access for repayments" ON public.repayments
FOR ALL USING (
    loan_id IN (
        SELECT id FROM public.loans 
        WHERE branch_id = ANY(public.get_user_branches()) OR public.is_super_admin()
    )
);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();