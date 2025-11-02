-- Migration: Fix overdue calculation to check loan_installments instead of loan due_date
-- A loan is overdue if any installment's due_date has passed and that installment hasn't been paid

-- Drop the existing function
DROP FUNCTION IF EXISTS get_unified_overdue_loans_report(UUID);

-- Create the function with installment-based overdue calculation
CREATE OR REPLACE FUNCTION get_unified_overdue_loans_report(requesting_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
    id UUID,
    account_number TEXT,
    member_name TEXT,
    member_id UUID,
    phone_number TEXT,
    branch_name TEXT,
    branch_id TEXT,
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
    installment_amount DECIMAL(15,2),
    group_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Return unified overdue loans based on installment due dates
    RETURN QUERY
    WITH loans_with_overdue_installments AS (
        SELECT DISTINCT
            l.id,
            -- Calculate total overdue amount from unpaid installments that are past due
            COALESCE((
                SELECT SUM(li.total_amount)
                FROM loan_installments li
                WHERE li.loan_id = l.id
                AND li.due_date < CURRENT_DATE::date
                AND (li.is_paid = false OR li.is_paid IS NULL)
            ), 0::DECIMAL(15,2)) as installment_overdue_amount,
            
            -- Get the earliest overdue installment date to calculate days overdue
            (SELECT MIN(li.due_date)
             FROM loan_installments li
             WHERE li.loan_id = l.id
             AND li.due_date < CURRENT_DATE::date
             AND (li.is_paid = false OR li.is_paid IS NULL)) as earliest_overdue_date,
             
            -- Count overdue installments
            COALESCE((
                SELECT COUNT(*)::INTEGER
                FROM loan_installments li
                WHERE li.loan_id = l.id
                AND li.due_date < CURRENT_DATE::date
                AND (li.is_paid = false OR li.is_paid IS NULL)
            ), 0::INTEGER) as overdue_installment_count,
            
            -- Get next due date (earliest unpaid installment that is not yet due)
            (SELECT MIN(li.due_date)
             FROM loan_installments li
             WHERE li.loan_id = l.id
             AND (li.is_paid = false OR li.is_paid IS NULL)
             AND li.due_date >= CURRENT_DATE::date) as next_installment_due_date
        FROM loans l
        WHERE l.current_balance > 0
        AND l.status IN ('active', 'pending', 'defaulted')
        AND l.is_deleted = false
        AND EXISTS (
            SELECT 1
            FROM loan_installments li
            WHERE li.loan_id = l.id
            AND li.due_date < CURRENT_DATE::date
            AND (li.is_paid = false OR li.is_paid IS NULL)
        )
    ),
    unified_overdue_loans AS (
        SELECT 
            l.id,
            COALESCE(l.application_no, 'N/A') as account_number,
            COALESCE(
                NULLIF(TRIM(CONCAT(COALESCE(m.first_name, ''), ' ', COALESCE(m.last_name, ''))), ''),
                m.first_name,
                m.last_name,
                'Unknown Member'
            ) as member_name,
            l.member_id as member_id,
            COALESCE(m.phone_number, 'N/A') as phone_number,
            COALESCE(b.name, 'Unknown Branch') as branch_name,
            COALESCE(l.branch_id::TEXT, NULL) as branch_id,
            l.loan_officer_id,
            
            -- Overdue amount: sum of unpaid installments past due
            COALESCE(li_overdue.installment_overdue_amount, 0::DECIMAL(15,2)) as overdue_amount,
            
            -- Days overdue: days since earliest overdue installment
            CASE 
                WHEN li_overdue.earliest_overdue_date IS NOT NULL THEN 
                    (CURRENT_DATE::date - li_overdue.earliest_overdue_date)::INTEGER
                ELSE 0::INTEGER
            END as days_overdue,
            
            -- Last payment date
            (SELECT MAX(lp.payment_date::timestamp with time zone) 
             FROM loan_payments lp 
             WHERE lp.loan_id = l.id 
             AND lp.payment_date IS NOT NULL) as last_payment_date,
            
            COALESCE(l.current_balance, 0::DECIMAL(15,2)) as loan_balance,
            COALESCE(lo.full_name, 'Unassigned') as loan_officer_name,
            
            -- Risk level based on days overdue
            CASE 
                WHEN li_overdue.earliest_overdue_date IS NULL THEN 'unknown'
                WHEN (CURRENT_DATE::date - li_overdue.earliest_overdue_date) <= 7 THEN 'low'
                WHEN (CURRENT_DATE::date - li_overdue.earliest_overdue_date) <= 30 THEN 'medium'
                WHEN (CURRENT_DATE::date - li_overdue.earliest_overdue_date) <= 90 THEN 'high'
                ELSE 'critical'
            END as risk_level,
            
            COALESCE(l.loan_program, 'unknown') as loan_program,
            COALESCE(l.principal_amount, 0::DECIMAL(15,2)) as principal_amount,
            COALESCE(l.issue_date, l.created_at::date, CURRENT_DATE) as applied_at,
            l.maturity_date as due_date,
            
            -- Installment information
            COALESCE((
                SELECT COUNT(*)::INTEGER 
                FROM loan_installments li 
                WHERE li.loan_id = l.id
            ), 0::INTEGER) as total_installments,
            
            COALESCE((
                SELECT COUNT(*)::INTEGER 
                FROM loan_installments li
                WHERE li.loan_id = l.id 
                AND li.is_paid = true
            ), 0::INTEGER) as paid_installments,
            
            -- Overdue installments count: count installments with due_date < CURRENT_DATE and not fully paid
            COALESCE((
                SELECT COUNT(*)::INTEGER
                FROM loan_installments li
                WHERE li.loan_id = l.id
                AND li.due_date < CURRENT_DATE::date
                AND (li.is_paid = false OR li.is_paid IS NULL OR (li.amount_paid IS NULL OR li.amount_paid < li.total_amount))
            ), 0::INTEGER) as overdue_installments,
            
            -- Next due date from installments or calculated
            COALESCE(
                li_overdue.next_installment_due_date,
                (SELECT MIN(li.due_date)
                 FROM loan_installments li
                 WHERE li.loan_id = l.id
                 AND (li.is_paid = false OR li.is_paid IS NULL)),
                l.maturity_date
            ) as next_due_date,
            
            -- Installment amount: get from first unpaid installment or calculate
            COALESCE((
                SELECT li.total_amount
                FROM loan_installments li
                WHERE li.loan_id = l.id
                AND (li.is_paid = false OR li.is_paid IS NULL)
                ORDER BY li.installment_number
                LIMIT 1
            ), 
            CASE 
                WHEN l.loan_program = 'small_loan' THEN CEIL(l.principal_amount / 8)::DECIMAL(15,2)
                WHEN l.loan_program = 'big_loan' THEN CEIL(l.principal_amount / 12)::DECIMAL(15,2)
                ELSE CEIL(l.principal_amount / 8)::DECIMAL(15,2)
            END
            ) as installment_amount,
            
            -- Group name from member's group_id
            COALESCE(g.name, 'No Group') as group_name
            
        FROM loans l
        INNER JOIN loans_with_overdue_installments li_overdue ON l.id = li_overdue.id
        LEFT JOIN members m ON l.member_id = m.id
        LEFT JOIN branches b ON l.branch_id = b.id
        LEFT JOIN profiles lo ON l.loan_officer_id = lo.id
        LEFT JOIN groups g ON m.group_id = g.id
        WHERE 
            l.current_balance > 0
            AND l.status IN ('active', 'pending', 'defaulted')
            AND l.is_deleted = false
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
                AND u.branch_id::TEXT = ol.branch_id
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
COMMENT ON FUNCTION get_unified_overdue_loans_report(UUID) IS 'Overdue loans based on installment due dates - a loan is overdue if any weekly installment payment has not been made';
