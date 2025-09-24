-- Migration: Create Unified Overdue Loans Function
-- This function provides consistent overdue loan calculation across all pages

-- Drop existing functions
DROP FUNCTION IF EXISTS get_unified_overdue_loans_report(UUID);

-- Create the unified function
CREATE OR REPLACE FUNCTION get_unified_overdue_loans_report(requesting_user_id UUID DEFAULT auth.uid())
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
    -- Return unified overdue loans based on consistent criteria
    RETURN QUERY
    WITH unified_overdue_loans AS (
        SELECT 
            l.id,
            l.account_number,
            m.full_name as member_name,
            l.member_id,
            m.phone_number,
            b.name as branch_name,
            l.branch_id,
            l.loan_officer_id,
            
            -- UNIFIED OVERDUE CALCULATION:
            -- A loan is overdue if:
            -- 1. It's past the final due date AND has outstanding balance, OR
            -- 2. It has missed installments (for installment-based loans)
            CASE 
                -- For loans past final due date with outstanding balance
                WHEN l.due_date < CURRENT_DATE::date AND l.current_balance > 0 THEN l.current_balance
                
                -- For installment-based loans with missed installments
                WHEN l.installment_type IS NOT NULL AND l.current_balance > 0 THEN
                    -- Calculate how many installments should have been paid by now
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
                
                -- Default: no overdue amount
                ELSE 0
            END as overdue_amount,
            
            -- Calculate days overdue consistently
            CASE 
                WHEN l.due_date IS NOT NULL AND l.due_date < CURRENT_DATE::date THEN 
                    (CURRENT_DATE::date - l.due_date::date)::INTEGER
                WHEN l.installment_type IS NOT NULL THEN
                    -- For installment loans, calculate days since last expected payment
                    (CURRENT_DATE - COALESCE(l.issue_date, l.created_at::date))::INTEGER
                ELSE 0
            END as days_overdue,
            
            -- Get last payment date
            (SELECT MAX(lp.payment_date::timestamp with time zone) 
             FROM loan_payments lp 
             WHERE lp.loan_id = l.id 
             AND lp.payment_date IS NOT NULL) as last_payment_date,
            
            COALESCE(l.current_balance, 0) as loan_balance,
            COALESCE(lo.full_name, 'Unassigned') as loan_officer_name,
            
            -- Risk level calculation
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
            
            -- Installment information
            COALESCE((SELECT COUNT(*)::INTEGER 
             FROM loan_installments li 
             WHERE li.loan_id = l.id), 0) as total_installments,
            
            COALESCE((SELECT COUNT(*)::INTEGER 
             FROM loan_payments lp 
             WHERE lp.loan_id = l.id 
             AND lp.payment_date IS NOT NULL), 0) as paid_installments,
            
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
                    )::INTEGER - COALESCE((
                        SELECT COUNT(*)::INTEGER 
                        FROM loan_payments lp 
                        WHERE lp.loan_id = l.id 
                        AND lp.payment_date IS NOT NULL
                    ), 0)
                ELSE 0
            END as overdue_installments,
            
            -- Next due date
            CASE 
                WHEN l.installment_type = 'weekly' THEN 
                    COALESCE(l.issue_date, l.created_at::date) + 
                    (COALESCE((SELECT COUNT(*)::INTEGER 
                     FROM loan_payments lp 
                     WHERE lp.loan_id = l.id 
                     AND lp.payment_date IS NOT NULL), 0) + 1) * INTERVAL '7 days'
                WHEN l.installment_type = 'monthly' THEN 
                    COALESCE(l.issue_date, l.created_at::date) + 
                    (COALESCE((SELECT COUNT(*)::INTEGER 
                     FROM loan_payments lp 
                     WHERE lp.loan_id = l.id 
                     AND lp.payment_date IS NOT NULL), 0) + 1) * INTERVAL '30 days'
                ELSE l.due_date
            END as next_due_date,
            
            -- Installment amount
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
            END as installment_amount
            
        FROM loans l
        LEFT JOIN members m ON l.member_id = m.id OR l.customer_id = m.id
        LEFT JOIN branches b ON l.branch_id = b.id
        LEFT JOIN profiles lo ON l.loan_officer_id = lo.id
        WHERE 
            -- Only include active loans with outstanding balance
            l.status IN ('active', 'pending', 'defaulted')
            AND l.current_balance > 0
            AND (
                -- Past due date
                (l.due_date IS NOT NULL AND l.due_date < CURRENT_DATE::date)
                OR
                -- Installment-based overdue (missed installments)
                (l.installment_type IS NOT NULL AND l.issue_date IS NOT NULL AND 
                 (CURRENT_DATE - l.issue_date) > 
                 CASE 
                     WHEN l.installment_type = 'weekly' THEN 7
                     WHEN l.installment_type = 'monthly' THEN 30
                     WHEN l.installment_type = 'daily' THEN 1
                     ELSE 7
                 END)
            )
    )
    SELECT 
        ol.*
    FROM unified_overdue_loans ol
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
GRANT EXECUTE ON FUNCTION get_unified_overdue_loans_report(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_unified_overdue_loans_report(UUID) IS 'Unified overdue loans calculation that provides consistent results across all pages';
