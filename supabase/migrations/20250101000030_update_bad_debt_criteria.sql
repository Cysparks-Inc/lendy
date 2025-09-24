-- Migration: Update bad debt criteria to loans not repaid for more than a year
-- This creates a function to identify bad debt based on 1-year non-payment criteria

-- Create function to get bad debt loans (not repaid for more than a year)
CREATE OR REPLACE FUNCTION get_bad_debt_loans(requesting_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
    id UUID,
    account_number TEXT,
    member_name TEXT,
    member_id UUID,
    principal_amount DECIMAL(15,2),
    current_balance DECIMAL(15,2),
    loan_officer_name TEXT,
    branch_name TEXT,
    due_date DATE,
    days_overdue INTEGER,
    status TEXT,
    issue_date DATE,
    is_problem BOOLEAN,
    last_payment_date TIMESTAMP WITH TIME ZONE,
    days_since_last_payment INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH bad_debt_loans AS (
        SELECT
            l.id,
            COALESCE(l.account_number, 'N/A') as account_number,
            COALESCE(m.full_name, 'Unknown Member') as member_name,
            COALESCE(l.member_id, l.customer_id) as member_id,
            COALESCE(l.principal_amount, 0::DECIMAL(15,2)) as principal_amount,
            COALESCE(l.current_balance, 0::DECIMAL(15,2)) as current_balance,
            COALESCE(lo.full_name, 'Unassigned') as loan_officer_name,
            COALESCE(b.name, 'Unknown Branch') as branch_name,
            l.due_date,
            
            -- Calculate days overdue
            CASE 
                WHEN l.due_date IS NOT NULL AND l.due_date < CURRENT_DATE::date THEN 
                    (CURRENT_DATE::date - l.due_date::date)::INTEGER
                ELSE 0::INTEGER
            END as days_overdue,
            
            l.status,
            COALESCE(l.issue_date, l.created_at::date) as issue_date,
            
            -- Check if it's a problem loan (not repaid for more than a year)
            CASE 
                WHEN l.current_balance > 0 AND (
                    -- Either no payments at all for more than a year
                    (SELECT COUNT(*) FROM loan_payments lp 
                     WHERE lp.loan_id = l.id AND lp.payment_date IS NOT NULL) = 0
                    AND (CURRENT_DATE::date - COALESCE(l.issue_date, l.created_at::date)) > 365
                ) OR (
                    -- Or last payment was more than a year ago
                    (CURRENT_DATE::date - (
                        SELECT MAX(lp.payment_date::date) 
                        FROM loan_payments lp 
                        WHERE lp.loan_id = l.id 
                        AND lp.payment_date IS NOT NULL
                    )) > 365
                ) THEN true
                ELSE false
            END as is_problem,
            
            -- Get last payment date
            (SELECT MAX(lp.payment_date::timestamp with time zone) 
             FROM loan_payments lp 
             WHERE lp.loan_id = l.id 
             AND lp.payment_date IS NOT NULL) as last_payment_date,
            
            -- Calculate days since last payment
            CASE 
                WHEN (SELECT COUNT(*) FROM loan_payments lp 
                      WHERE lp.loan_id = l.id AND lp.payment_date IS NOT NULL) = 0 THEN
                    (CURRENT_DATE::date - COALESCE(l.issue_date, l.created_at::date))::INTEGER
                ELSE
                    (CURRENT_DATE::date - (
                        SELECT MAX(lp.payment_date::date) 
                        FROM loan_payments lp 
                        WHERE lp.loan_id = l.id 
                        AND lp.payment_date IS NOT NULL
                    ))::INTEGER
            END as days_since_last_payment

        FROM loans l
        LEFT JOIN members m ON (
            (l.member_id IS NOT NULL AND l.member_id = m.id) OR 
            (l.customer_id IS NOT NULL AND l.customer_id = m.id)
        )
        LEFT JOIN branches b ON l.branch_id = b.id
        LEFT JOIN profiles lo ON l.loan_officer_id = lo.id
        WHERE 
            l.current_balance > 0
            AND l.status IN ('active', 'pending', 'defaulted')
            AND l.is_deleted = false
    )
    SELECT
        bdl.*
    FROM bad_debt_loans bdl
    WHERE
        -- Only return loans that are problem loans (not repaid for more than a year)
        bdl.is_problem = true
        AND (
            -- Apply role-based filtering
            CASE
                -- Super admin can see all bad debt loans
                WHEN EXISTS (
                    SELECT 1 FROM profiles u
                    WHERE u.id = requesting_user_id
                    AND u.role = 'super_admin'
                ) THEN TRUE

                -- Branch admin can see bad debt loans from their branch
                WHEN EXISTS (
                    SELECT 1 FROM profiles u
                    WHERE u.id = requesting_user_id
                    AND u.role = 'branch_admin'
                    AND u.branch_id = bdl.branch_id
                ) THEN TRUE

                -- Loan officer can see bad debt loans assigned to them
                WHEN EXISTS (
                    SELECT 1 FROM profiles u
                    WHERE u.id = requesting_user_id
                    AND u.role = 'loan_officer'
                    AND u.id = bdl.loan_officer_id
                ) THEN TRUE

                -- Auditor can see all bad debt loans
                WHEN EXISTS (
                    SELECT 1 FROM profiles u
                    WHERE u.id = requesting_user_id
                    AND u.role = 'auditor'
                ) THEN TRUE

                -- Default: no access
                ELSE FALSE
            END
        )
    ORDER BY bdl.days_since_last_payment DESC, bdl.current_balance DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_bad_debt_loans(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_bad_debt_loans(UUID) IS 'Get loans that are considered bad debt (not repaid for more than a year)';
