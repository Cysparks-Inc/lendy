-- Migration: Create Installment-Based Overdue Loans Function
-- This function provides overdue loan information based on individual installment payments

-- Drop function if it exists
DROP FUNCTION IF EXISTS get_installment_overdue_loans_report(UUID);

-- Create the function to get installment-based overdue loans report
CREATE OR REPLACE FUNCTION get_installment_overdue_loans_report(requesting_user_id UUID DEFAULT auth.uid())
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
    paid_installments INTEGER,
    overdue_installments INTEGER,
    next_due_date DATE,
    installment_amount DECIMAL(15,2)
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Return overdue loans based on installment payments
    RETURN QUERY
    WITH installment_overdue_loans AS (
        SELECT 
            l.id,
            l.account_number,
            m.full_name as member_name,
            l.member_id,
            m.phone_number,
            b.name as branch_name,
            l.branch_id,
            l.loan_officer_id,
            -- Calculate overdue amount based on missed installments
            CASE 
                WHEN l.installment_type IS NOT NULL THEN
                    -- For installment-based loans, calculate overdue amount
                    GREATEST(0, 
                        (CURRENT_DATE - COALESCE(l.issue_date, l.created_at::date)) / 
                        CASE 
                            WHEN l.installment_type = 'weekly' THEN 7
                            WHEN l.installment_type = 'monthly' THEN 30
                            WHEN l.installment_type = 'daily' THEN 1
                            ELSE 7 -- Default to weekly
                        END * 
                        CASE 
                            WHEN l.loan_program = 'small_loan' AND l.installment_type = 'weekly' THEN 
                                CEIL(l.principal_amount / 8)
                            WHEN l.loan_program = 'small_loan' AND l.installment_type = 'monthly' THEN 
                                CEIL(l.principal_amount / 2)
                            WHEN l.loan_program = 'big_loan' AND l.installment_type = 'weekly' THEN 
                                CEIL(l.principal_amount / 12)
                            WHEN l.loan_program = 'big_loan' AND l.installment_type = 'monthly' THEN 
                                CEIL(l.principal_amount / 3)
                            ELSE CEIL(l.principal_amount / 8)
                        END
                    ) - COALESCE((
                        SELECT SUM(lp.amount) 
                        FROM loan_payments lp 
                        WHERE lp.loan_id = l.id 
                        AND lp.payment_date IS NOT NULL
                    ), 0)
                ELSE
                    -- For non-installment loans, use the old logic
                    CASE 
                        WHEN l.due_date < CURRENT_DATE::date THEN l.current_balance
                        ELSE 0
                    END
            END as overdue_amount,
            -- Calculate days overdue based on installment schedule
            CASE 
                WHEN l.installment_type IS NOT NULL THEN
                    -- For installment-based loans, calculate days since last expected payment
                    (CURRENT_DATE - COALESCE(
                        (SELECT MAX(lp.payment_date::date) 
                         FROM loan_payments lp 
                         WHERE lp.loan_id = l.id 
                         AND lp.payment_date IS NOT NULL),
                        COALESCE(l.issue_date, l.created_at::date)
                    ))::INTEGER
                ELSE
                    -- For non-installment loans, use due_date
                    CASE 
                        WHEN l.due_date IS NOT NULL THEN 
                            (CURRENT_DATE::date - l.due_date::date)::INTEGER
                        ELSE 0
                    END
            END as days_overdue,
            (SELECT MAX(lp.payment_date::timestamp with time zone) 
             FROM loan_payments lp 
             WHERE lp.loan_id = l.id 
             AND lp.payment_date IS NOT NULL) as last_payment_date,
            COALESCE(l.current_balance, 0) as loan_balance,
            COALESCE(lo.full_name, 'Unassigned') as loan_officer_name,
            -- Risk level based on days overdue
            CASE 
                WHEN l.installment_type IS NOT NULL THEN
                    CASE 
                        WHEN (CURRENT_DATE - COALESCE(
                            (SELECT MAX(lp.payment_date::date) 
                             FROM loan_payments lp 
                             WHERE lp.loan_id = l.id 
                             AND lp.payment_date IS NOT NULL),
                            COALESCE(l.issue_date, l.created_at::date)
                        )) <= 7 THEN 'low'
                        WHEN (CURRENT_DATE - COALESCE(
                            (SELECT MAX(lp.payment_date::date) 
                             FROM loan_payments lp 
                             WHERE lp.loan_id = l.id 
                             AND lp.payment_date IS NOT NULL),
                            COALESCE(l.issue_date, l.created_at::date)
                        )) <= 30 THEN 'medium'
                        WHEN (CURRENT_DATE - COALESCE(
                            (SELECT MAX(lp.payment_date::date) 
                             FROM loan_payments lp 
                             WHERE lp.loan_id = l.id 
                             AND lp.payment_date IS NOT NULL),
                            COALESCE(l.issue_date, l.created_at::date)
                        )) <= 90 THEN 'high'
                        ELSE 'critical'
                    END
                ELSE
                    CASE 
                        WHEN l.due_date IS NULL THEN 'unknown'
                        WHEN (CURRENT_DATE::date - l.due_date::date) <= 7 THEN 'low'
                        WHEN (CURRENT_DATE::date - l.due_date::date) <= 30 THEN 'medium'
                        WHEN (CURRENT_DATE::date - l.due_date::date) <= 90 THEN 'high'
                        ELSE 'critical'
                    END
            END as risk_level,
            COALESCE(l.loan_program, 'unknown') as loan_program,
            COALESCE(l.principal_amount, 0) as principal_amount,
            COALESCE(l.issue_date, l.created_at::date)::date as applied_at,
            l.due_date::date,
            -- Calculate total installments based on loan program and type
            CASE 
                WHEN l.loan_program = 'small_loan' AND l.installment_type = 'weekly' THEN 8
                WHEN l.loan_program = 'small_loan' AND l.installment_type = 'monthly' THEN 2
                WHEN l.loan_program = 'big_loan' AND l.installment_type = 'weekly' THEN 12
                WHEN l.loan_program = 'big_loan' AND l.installment_type = 'monthly' THEN 3
                ELSE 8 -- Default
            END as total_installments,
            -- Count paid installments based on payment amounts
            COALESCE((
                SELECT COUNT(*)::INTEGER 
                FROM loan_payments lp 
                WHERE lp.loan_id = l.id 
                AND lp.payment_date IS NOT NULL
                AND lp.amount >= 
                    CASE 
                        WHEN l.loan_program = 'small_loan' AND l.installment_type = 'weekly' THEN 
                            CEIL(l.principal_amount / 8)
                        WHEN l.loan_program = 'small_loan' AND l.installment_type = 'monthly' THEN 
                            CEIL(l.principal_amount / 2)
                        WHEN l.loan_program = 'big_loan' AND l.installment_type = 'weekly' THEN 
                            CEIL(l.principal_amount / 12)
                        WHEN l.loan_program = 'big_loan' AND l.installment_type = 'monthly' THEN 
                            CEIL(l.principal_amount / 3)
                        ELSE CEIL(l.principal_amount / 8)
                    END
            ), 0) as paid_installments,
            -- Calculate overdue installments
            CASE 
                WHEN l.installment_type IS NOT NULL THEN
                    GREATEST(0, 
                        (CURRENT_DATE - COALESCE(l.issue_date, l.created_at::date)) / 
                        CASE 
                            WHEN l.installment_type = 'weekly' THEN 7
                            WHEN l.installment_type = 'monthly' THEN 30
                            WHEN l.installment_type = 'daily' THEN 1
                            ELSE 7
                        END
                    ) - COALESCE((
                        SELECT COUNT(*)::INTEGER 
                        FROM loan_payments lp 
                        WHERE lp.loan_id = l.id 
                        AND lp.payment_date IS NOT NULL
                        AND lp.amount >= 
                            CASE 
                                WHEN l.loan_program = 'small_loan' AND l.installment_type = 'weekly' THEN 
                                    CEIL(l.principal_amount / 8)
                                WHEN l.loan_program = 'small_loan' AND l.installment_type = 'monthly' THEN 
                                    CEIL(l.principal_amount / 2)
                                WHEN l.loan_program = 'big_loan' AND l.installment_type = 'weekly' THEN 
                                    CEIL(l.principal_amount / 12)
                                WHEN l.loan_program = 'big_loan' AND l.installment_type = 'monthly' THEN 
                                    CEIL(l.principal_amount / 3)
                                ELSE CEIL(l.principal_amount / 8)
                            END
                    ), 0)
                ELSE 0
            END as overdue_installments,
            -- Calculate next due date
            CASE 
                WHEN l.installment_type IS NOT NULL THEN
                    COALESCE(l.issue_date, l.created_at::date) + 
                    (COALESCE((
                        SELECT COUNT(*)::INTEGER 
                        FROM loan_payments lp 
                        WHERE lp.loan_id = l.id 
                        AND lp.payment_date IS NOT NULL
                        AND lp.amount >= 
                            CASE 
                                WHEN l.loan_program = 'small_loan' AND l.installment_type = 'weekly' THEN 
                                    CEIL(l.principal_amount / 8)
                                WHEN l.loan_program = 'small_loan' AND l.installment_type = 'monthly' THEN 
                                    CEIL(l.principal_amount / 2)
                                WHEN l.loan_program = 'big_loan' AND l.installment_type = 'weekly' THEN 
                                    CEIL(l.principal_amount / 12)
                                WHEN l.loan_program = 'big_loan' AND l.installment_type = 'monthly' THEN 
                                    CEIL(l.principal_amount / 3)
                                ELSE CEIL(l.principal_amount / 8)
                            END
                    ), 0) + 1) * 
                    CASE 
                        WHEN l.installment_type = 'weekly' THEN INTERVAL '7 days'
                        WHEN l.installment_type = 'monthly' THEN INTERVAL '30 days'
                        WHEN l.installment_type = 'daily' THEN INTERVAL '1 day'
                        ELSE INTERVAL '7 days'
                    END
                ELSE l.due_date
            END::date as next_due_date,
            -- Calculate installment amount based on loan program and type
            CASE 
                WHEN l.loan_program = 'small_loan' AND l.installment_type = 'weekly' THEN 
                    CEIL(l.principal_amount / 8) -- 8 weeks for small loans
                WHEN l.loan_program = 'small_loan' AND l.installment_type = 'monthly' THEN 
                    CEIL(l.principal_amount / 2) -- 2 months for small loans
                WHEN l.loan_program = 'big_loan' AND l.installment_type = 'weekly' THEN 
                    CEIL(l.principal_amount / 12) -- 12 weeks for big loans
                WHEN l.loan_program = 'big_loan' AND l.installment_type = 'monthly' THEN 
                    CEIL(l.principal_amount / 3) -- 3 months for big loans
                ELSE CEIL(l.principal_amount / 8) -- Default to 8 weeks
            END as installment_amount
        FROM loans l
        JOIN members m ON (l.member_id = m.id OR l.customer_id = m.id)
        LEFT JOIN branches b ON l.branch_id = b.id
        LEFT JOIN profiles lo ON l.loan_officer_id = lo.id
        WHERE l.status IN ('active', 'pending', 'disbursed')
        AND l.current_balance > 0
        AND (
            -- For installment-based loans, check if any installments are overdue
            (l.installment_type IS NOT NULL AND
             (CURRENT_DATE - COALESCE(
                (SELECT MAX(lp.payment_date::date) 
                 FROM loan_payments lp 
                 WHERE lp.loan_id = l.id 
                 AND lp.payment_date IS NOT NULL),
                COALESCE(l.issue_date, l.created_at::date)
             )) > 
             CASE 
                 WHEN l.installment_type = 'weekly' THEN 7
                 WHEN l.installment_type = 'monthly' THEN 30
                 WHEN l.installment_type = 'daily' THEN 1
                 ELSE 7
             END)
            OR
            -- For non-installment loans, use the old logic
            (l.installment_type IS NULL) AND
            l.due_date IS NOT NULL AND
            l.due_date < CURRENT_DATE::date
        )
        AND l.member_id IS NOT NULL
    )
    SELECT 
        ol.*
    FROM installment_overdue_loans ol
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
GRANT EXECUTE ON FUNCTION get_installment_overdue_loans_report(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_installment_overdue_loans_report(UUID) IS 'Get installment-based overdue loans report with member details, balance, and risk assessment';
