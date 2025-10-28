-- Fix: Remove customer_id reference from get_unified_overdue_loans_report function
-- This function should only use member_id (customer_id doesn't exist in the schema)

BEGIN;

-- Drop the existing function
DROP FUNCTION IF EXISTS get_unified_overdue_loans_report(UUID);

-- Create the function with correct data types (removed customer_id reference)
CREATE OR REPLACE FUNCTION get_unified_overdue_loans_report(requesting_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
    id UUID,
    account_number TEXT,
    member_name TEXT,
    member_id UUID,
    phone_number TEXT,
    branch_name TEXT,
    branch_id UUID,
    loan_officer_id UUID,
    overdue_amount DECIMAL(15,2),
    days_overdue INTEGER,
    last_payment_date TIMESTAMP WITH TIME ZONE,
    loan_balance DECIMAL(15,2),
    loan_officer_name TEXT,
    risk_level TEXT,
    loan_program TEXT,
    principal_amount DECIMAL(15,2),
    applied_at DATE,
    due_date DATE,
    total_installments INTEGER,
    paid_installments INTEGER,
    overdue_installments INTEGER,
    next_due_date DATE,
    installment_amount DECIMAL(15,2)
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Return unified overdue loans with correct data types
    RETURN QUERY
    WITH unified_overdue_loans AS (
        SELECT 
            l.id,
            COALESCE(l.application_no, 'N/A') as account_number,
            CONCAT(COALESCE(m.first_name, ''), ' ', COALESCE(m.last_name, '')) as member_name,
            l.member_id,  -- Only use member_id, removed customer_id reference
            COALESCE(m.phone_number, 'N/A') as phone_number,
            COALESCE(b.name, 'Unknown Branch') as branch_name,
            l.branch_id,
            l.loan_officer_id,
            
            -- Overdue amount calculation
            CASE 
                WHEN l.maturity_date IS NOT NULL AND l.maturity_date < CURRENT_DATE::date AND l.current_balance > 0 
                THEN l.current_balance
                ELSE 0::DECIMAL(15,2)
            END as overdue_amount,
            
            -- Days overdue calculation
            CASE 
                WHEN l.maturity_date IS NOT NULL AND l.maturity_date < CURRENT_DATE::date THEN 
                    (CURRENT_DATE::date - l.maturity_date::date)::INTEGER
                ELSE 0::INTEGER
            END as days_overdue,
            
            -- Last payment date
            (SELECT MAX(lp.payment_date::timestamp with time zone) 
             FROM loan_payments lp 
             WHERE lp.loan_id = l.id 
             AND lp.payment_date IS NOT NULL) as last_payment_date,
            
            COALESCE(l.current_balance, 0::DECIMAL(15,2)) as loan_balance,
            COALESCE(lo.full_name, 'Unassigned') as loan_officer_name,
            
            -- Risk level calculation
            CASE 
                WHEN l.maturity_date IS NULL THEN 'unknown'
                WHEN (CURRENT_DATE::date - l.maturity_date::date) <= 7 THEN 'low'
                WHEN (CURRENT_DATE::date - l.maturity_date::date) <= 30 THEN 'medium'
                WHEN (CURRENT_DATE::date - l.maturity_date::date) <= 90 THEN 'high'
                ELSE 'critical'
            END as risk_level,
            
            COALESCE(l.loan_program, 'unknown') as loan_program,
            COALESCE(l.principal_amount, 0::DECIMAL(15,2)) as principal_amount,
            COALESCE(l.issue_date, l.created_at::date, CURRENT_DATE) as applied_at,
            l.maturity_date as due_date,
            
            -- Installment information with correct types
            COALESCE((SELECT COUNT(*)::INTEGER 
             FROM loan_installments li 
             WHERE li.loan_id = l.id), 0::INTEGER) as total_installments,
            
            COALESCE((SELECT COUNT(*)::INTEGER 
             FROM loan_payments lp 
             WHERE lp.loan_id = l.id 
             AND lp.payment_date IS NOT NULL), 0::INTEGER) as paid_installments,
            
            -- Overdue installments calculation
            CASE 
                WHEN l.repayment_schedule IS NOT NULL THEN
                    GREATEST(0, 
                        (CURRENT_DATE - COALESCE(l.issue_date, l.created_at::date)) / 
                        CASE 
                            WHEN l.repayment_schedule = 'weekly' THEN 7
                            WHEN l.repayment_schedule = 'monthly' THEN 30
                            WHEN l.repayment_schedule = 'daily' THEN 1
                            ELSE 7
                        END
                    )::INTEGER - COALESCE((
                        SELECT COUNT(*)::INTEGER 
                        FROM loan_payments lp 
                        WHERE lp.loan_id = l.id 
                        AND lp.payment_date IS NOT NULL
                    ), 0::INTEGER)
                ELSE 0::INTEGER
            END as overdue_installments,
            
            -- Next due date
            CASE 
                WHEN l.repayment_schedule = 'weekly' THEN 
                    (COALESCE(l.issue_date, l.created_at::date) + 
                    (COALESCE((SELECT COUNT(*)::INTEGER 
                     FROM loan_payments lp 
                     WHERE lp.loan_id = l.id 
                     AND lp.payment_date IS NOT NULL), 0::INTEGER) + 1) * INTERVAL '7 days')::DATE
                WHEN l.repayment_schedule = 'monthly' THEN 
                    (COALESCE(l.issue_date, l.created_at::date) + 
                    (COALESCE((SELECT COUNT(*)::INTEGER 
                     FROM loan_payments lp 
                     WHERE lp.loan_id = l.id 
                     AND lp.payment_date IS NOT NULL), 0::INTEGER) + 1) * INTERVAL '30 days')::DATE
                ELSE l.maturity_date
            END as next_due_date,
            
            -- Installment amount with correct type
            COALESCE(l.principal_amount, 0::DECIMAL(15,2)) / 
                NULLIF(COALESCE(l.term_months, 12), 0) / 4 as installment_amount
            
        FROM loans l
        LEFT JOIN members m ON l.member_id = m.id
        LEFT JOIN branches b ON l.branch_id = b.id
        LEFT JOIN profiles lo ON l.loan_officer_id = lo.id
        
        WHERE 
            l.status = 'active'
            AND l.approval_status = 'approved'
            AND l.current_balance > 0
            AND (
                -- Loans with overdue date
                (l.maturity_date IS NOT NULL AND l.maturity_date < CURRENT_DATE::date)
                OR
                -- Loans with last payment older than repayment schedule
                (l.repayment_schedule = 'weekly' AND l.maturity_date IS NOT NULL AND 
                 (SELECT MAX(lp.payment_date) FROM loan_payments lp WHERE lp.loan_id = l.id) < CURRENT_DATE - INTERVAL '7 days')
                OR
                (l.repayment_schedule = 'monthly' AND l.maturity_date IS NOT NULL AND 
                 (SELECT MAX(lp.payment_date) FROM loan_payments lp WHERE lp.loan_id = l.id) < CURRENT_DATE - INTERVAL '30 days')
            )
    )
    SELECT * FROM unified_overdue_loans ol
    WHERE ol.overdue_amount > 0
    ORDER BY ol.days_overdue DESC, ol.overdue_amount DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_unified_overdue_loans_report(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_unified_overdue_loans_report(UUID) IS 'Fixed unified overdue loans calculation - removed customer_id reference, using member_id only';

COMMIT;

