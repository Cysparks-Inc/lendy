-- Loan Increment System and Approval Workflow
-- This migration implements the loan increment rules and approval system

-- Add loan increment tracking to loans table
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS previous_loan_id UUID REFERENCES public.loans(id);
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS increment_level INTEGER DEFAULT 1;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS payment_weeks INTEGER NOT NULL DEFAULT 8;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

-- Create loan increment levels table
CREATE TABLE IF NOT EXISTS public.loan_increment_levels (
    id SERIAL PRIMARY KEY,
    level INTEGER UNIQUE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_weeks_8 BOOLEAN DEFAULT true,
    payment_weeks_12 BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the loan increment levels
INSERT INTO public.loan_increment_levels (level, amount, payment_weeks_8, payment_weeks_12) VALUES
(1, 5000, true, false),
(2, 7000, true, false),
(3, 9000, true, true),
(4, 11000, true, true),
(5, 13000, true, true),
(6, 15000, true, true),
(7, 17000, true, true),
(8, 20000, true, true),
(9, 25000, true, true),
(10, 30000, true, true),
(11, 35000, true, true),
(12, 40000, true, true),
(13, 45000, true, true),
(14, 50000, true, true)
ON CONFLICT (level) DO NOTHING;

-- Create function to check if member has pending loans
CREATE OR REPLACE FUNCTION public.member_has_pending_loans(_member_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.loans 
        WHERE member_id = _member_id 
        AND status IN ('active', 'repaid')
        AND current_balance > 0
    );
$$;

-- Create function to get next loan increment level
CREATE OR REPLACE FUNCTION public.get_next_loan_increment(_member_id UUID)
RETURNS TABLE(
    next_level INTEGER,
    next_amount DECIMAL(15,2),
    can_borrow_less BOOLEAN,
    payment_weeks_8 BOOLEAN,
    payment_weeks_12 BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    WITH member_loans AS (
        SELECT 
            COALESCE(MAX(increment_level), 0) as current_level,
            COALESCE(MAX(principal_amount), 0) as max_borrowed
        FROM public.loans 
        WHERE member_id = _member_id 
        AND status IN ('repaid', 'active')
    ),
    next_increment AS (
        SELECT 
            lil.level,
            lil.amount,
            lil.payment_weeks_8,
            lil.payment_weeks_12,
            CASE 
                WHEN ml.max_borrowed > 0 THEN true 
                ELSE false 
            END as can_borrow_less
        FROM public.loan_increment_levels lil
        CROSS JOIN member_loans ml
        WHERE lil.level = ml.current_level + 1
        LIMIT 1
    )
    SELECT 
        COALESCE(ni.level, 1) as next_level,
        COALESCE(ni.amount, 5000) as next_amount,
        COALESCE(ni.can_borrow_less, false) as can_borrow_less,
        COALESCE(ni.payment_weeks_8, true) as payment_weeks_8,
        COALESCE(ni.payment_weeks_12, false) as payment_weeks_12
    FROM next_increment ni;
$$;

-- Create function to validate loan amount against increment rules
CREATE OR REPLACE FUNCTION public.validate_loan_increment(
    _member_id UUID,
    _requested_amount DECIMAL(15,2),
    _payment_weeks INTEGER,
    _user_role TEXT
)
RETURNS TABLE(
    is_valid BOOLEAN,
    error_message TEXT,
    suggested_amount DECIMAL(15,2),
    suggested_payment_weeks INTEGER
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    WITH member_loans AS (
        SELECT 
            COALESCE(MAX(increment_level), 0) as current_level,
            COALESCE(MAX(principal_amount), 0) as max_borrowed
        FROM public.loans 
        WHERE member_id = _member_id 
        AND status IN ('repaid', 'active')
    ),
    next_increment AS (
        SELECT 
            lil.level,
            lil.amount,
            lil.payment_weeks_8,
            lil.payment_weeks_12
        FROM public.loan_increment_levels lil
        CROSS JOIN member_loans ml
        WHERE lil.level = ml.current_level + 1
        LIMIT 1
    ),
    validation AS (
        SELECT 
            CASE 
                WHEN ml.max_borrowed = 0 THEN
                    -- First loan, must be exactly 5000
                    CASE 
                        WHEN _requested_amount = 5000 THEN true
                        ELSE false
                    END
                WHEN _user_role IN ('super_admin', 'admin') THEN
                    -- Admin can approve any amount
                    true
                ELSE
                    -- Loan officer must follow increment rules
                    CASE 
                        WHEN _requested_amount = ni.amount THEN true
                        WHEN _requested_amount < ml.max_borrowed THEN true
                        ELSE false
                    END
            END as is_valid,
            CASE 
                WHEN ml.max_borrowed = 0 AND _requested_amount != 5000 THEN
                    'First loan must be exactly KES 5,000'
                WHEN _user_role NOT IN ('super_admin', 'admin') AND _requested_amount > ni.amount THEN
                    'Cannot exceed next increment level. Maximum allowed: KES ' || ni.amount::text
                WHEN _user_role NOT IN ('super_admin', 'admin') AND _requested_amount > ml.max_borrowed AND _requested_amount != ni.amount THEN
                    'Cannot exceed previous loan amount unless following increment rules'
                ELSE NULL
            END as error_message,
            COALESCE(ni.amount, 5000) as suggested_amount,
            CASE 
                WHEN ni.amount <= 7000 THEN 8
                WHEN _payment_weeks IN (8, 12) THEN _payment_weeks
                ELSE 8
            END as suggested_payment_weeks
        FROM member_loans ml
        LEFT JOIN next_increment ni ON true
    )
    SELECT 
        COALESCE(v.is_valid, false) as is_valid,
        v.error_message,
        v.suggested_amount,
        v.suggested_payment_weeks
    FROM validation v;
$$;

-- Create RLS policies for loan increment levels
ALTER TABLE public.loan_increment_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view loan increment levels"
    ON public.loan_increment_levels FOR SELECT
    USING (true);

-- Update existing loans to have default values
UPDATE public.loans 
SET 
    increment_level = 1,
    payment_weeks = 8,
    approval_status = 'approved'
WHERE increment_level IS NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_loans_member_status ON public.loans(member_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_increment_level ON public.loans(increment_level);
CREATE INDEX IF NOT EXISTS idx_loans_approval_status ON public.loans(approval_status);
