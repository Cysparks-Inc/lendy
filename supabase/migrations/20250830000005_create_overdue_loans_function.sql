-- Migration: Create Overdue Loans Function
-- This function provides comprehensive overdue loan information for both big and small loans

-- Drop function if it exists
DROP FUNCTION IF EXISTS get_overdue_loans_report(UUID);

-- Create the function to get overdue loans report
CREATE OR REPLACE FUNCTION get_overdue_loans_report(requesting_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
    id UUID,
    account_number TEXT,
    member_name TEXT,
    member_id UUID,
    phone_number TEXT,
    branch_name TEXT,
    branch_id BIGINT,
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
    paid_installments INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Return overdue loans based on user role and permissions
    RETURN QUERY
    WITH overdue_loans AS (
        SELECT 
            l.id,
            l.account_number,
            m.full_name as member_name,
            l.member_id,
            m.phone_number,
            b.name as branch_name,
            l.branch_id,
            l.loan_officer_id,
                        CASE 
                WHEN l.due_date < CURRENT_DATE::date THEN l.current_balance
                ELSE 0
            END as overdue_amount,
            CASE 
                WHEN l.due_date IS NOT NULL THEN 
                    (CURRENT_DATE::date - l.due_date::date)::INTEGER
                ELSE 0
            END as days_overdue,
            (SELECT MAX(lp.payment_date::timestamp with time zone) 
             FROM loan_payments lp 
             WHERE lp.loan_id = l.id 
             AND lp.payment_date IS NOT NULL) as last_payment_date,
            COALESCE(l.current_balance, 0) as loan_balance,
            COALESCE(lo.full_name, 'Unassigned') as loan_officer_name,
            CASE 
                WHEN l.due_date IS NULL THEN 'unknown'
                WHEN (CURRENT_DATE::date - l.due_date::date) <= 7 THEN 'low'
                WHEN (CURRENT_DATE::date - l.due_date::date) <= 30 THEN 'medium'
                WHEN (CURRENT_DATE::date - l.due_date::date) <= 90 THEN 'high'
                ELSE 'critical'
            END as risk_level,
            COALESCE(l.loan_program, 'unknown') as loan_program,
            COALESCE(l.principal_amount, 0) as principal_amount,
            COALESCE(l.issue_date, CURRENT_DATE) as applied_at,
            l.due_date,
            COALESCE((SELECT COUNT(*)::INTEGER 
             FROM loan_installments li 
             WHERE li.loan_id = l.id), 0) as total_installments,
            COALESCE((SELECT COUNT(*)::INTEGER 
             FROM loan_installments li 
             WHERE li.loan_id = l.id 
             AND li.is_paid = true), 0) as paid_installments
        FROM loans l
        JOIN members m ON l.member_id = m.id
        LEFT JOIN branches b ON l.branch_id = b.id
        LEFT JOIN profiles lo ON l.loan_officer_id = lo.id
        WHERE l.status = 'pending'
        AND l.due_date IS NOT NULL
        AND l.due_date < CURRENT_DATE::date
        AND l.current_balance > 0
        AND (CURRENT_DATE::date - l.due_date::date) > 0
        AND l.member_id IS NOT NULL
    )
    SELECT 
        ol.*
    FROM overdue_loans ol
    WHERE 
                 -- Apply role-based filtering
         CASE 
             -- Super admin can see all overdue loans
             WHEN EXISTS (
                 SELECT 1 FROM profiles u 
                 WHERE u.id = requesting_user_id 
                 AND u.role = 'super_admin'
             ) THEN TRUE
             
             -- Branch admin can see overdue loans from their branch
             WHEN EXISTS (
                 SELECT 1 FROM profiles u 
                 WHERE u.id = requesting_user_id 
                 AND u.role = 'branch_admin'
                 AND u.branch_id = ol.branch_id
             ) THEN TRUE
             
             -- Loan officer can see overdue loans assigned to them
             WHEN EXISTS (
                 SELECT 1 FROM profiles u 
                 WHERE u.id = requesting_user_id 
                 AND u.role = 'loan_officer'
                 AND u.id = ol.loan_officer_id
             ) THEN TRUE
             
             -- Auditor can see all overdue loans
             WHEN EXISTS (
                 SELECT 1 FROM profiles u 
                 WHERE u.id = requesting_user_id 
                 AND u.role = 'auditor'
             ) THEN TRUE
             
             -- Default: no access
             ELSE FALSE
         END
    ORDER BY ol.days_overdue DESC, ol.overdue_amount DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_overdue_loans_report(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_overdue_loans_report(UUID) IS 'Get comprehensive overdue loans report with member details, balance, and risk assessment';
