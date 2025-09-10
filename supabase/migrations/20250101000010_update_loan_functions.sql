-- Update loan increment system functions to use the correct status values
-- This migration runs after the enum values have been committed

-- Update the loan increment system functions to use the correct status values
CREATE OR REPLACE FUNCTION public.member_has_pending_loans(_member_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.loans 
        WHERE (member_id = _member_id OR customer_id = _member_id)
        AND status IN ('pending', 'active', 'disbursed')
        AND current_balance > 0
    );
$$;

-- Update the get_next_loan_increment function
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
        AND status IN ('completed', 'active', 'disbursed')
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

-- Update the validate_loan_increment function
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
        AND status IN ('completed', 'active', 'disbursed')
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
