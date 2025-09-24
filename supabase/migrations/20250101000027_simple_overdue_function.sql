-- Migration: Simple overdue function to test basic structure
-- This is a minimal version to identify the exact mismatch

-- First, drop the existing function
DROP FUNCTION get_unified_overdue_loans_report(UUID);

-- Create a simple function that just returns basic overdue data
CREATE OR REPLACE FUNCTION get_unified_overdue_loans_report(requesting_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
    id UUID,
    account_number TEXT,
    member_name TEXT,
    member_id UUID,
    phone_number TEXT,
    branch_name TEXT,
    branch_id INTEGER,
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
    -- Simple query to test structure
    RETURN QUERY
    SELECT 
        l.id,
        COALESCE(l.account_number, 'N/A') as account_number,
        COALESCE(m.full_name, 'Unknown Member') as member_name,
        COALESCE(l.member_id, l.customer_id) as member_id,
        COALESCE(m.phone_number, 'N/A') as phone_number,
        COALESCE(b.name, 'Unknown Branch') as branch_name,
        l.branch_id::INTEGER as branch_id,
        l.loan_officer_id,
        l.current_balance as overdue_amount,
        0::INTEGER as days_overdue,
        NULL::TIMESTAMP WITH TIME ZONE as last_payment_date,
        l.current_balance as loan_balance,
        COALESCE(lo.full_name, 'Unassigned') as loan_officer_name,
        'low' as risk_level,
        COALESCE(l.loan_program, 'unknown') as loan_program,
        l.principal_amount,
        l.issue_date as applied_at,
        l.due_date,
        0::INTEGER as total_installments,
        0::INTEGER as paid_installments,
        0::INTEGER as overdue_installments,
        l.due_date as next_due_date,
        0::DECIMAL(15,2) as installment_amount
    FROM loans l
    LEFT JOIN members m ON (
        (l.member_id IS NOT NULL AND l.member_id = m.id) OR 
        (l.customer_id IS NOT NULL AND l.customer_id = m.id)
    )
    LEFT JOIN branches b ON l.branch_id = b.id
    LEFT JOIN profiles lo ON l.loan_officer_id = lo.id
    WHERE 
        l.current_balance > 0
        AND l.due_date IS NOT NULL
        AND l.due_date < CURRENT_DATE::date
        AND l.status IN ('active', 'pending', 'defaulted')
    LIMIT 10;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_unified_overdue_loans_report(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_unified_overdue_loans_report(UUID) IS 'Simple overdue function for testing structure match';
