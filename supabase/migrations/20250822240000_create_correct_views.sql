-- Create Correct Views Based on Actual Database Structure
-- This migration creates views and functions that match the actual database schema

-- Step 1: Drop existing views and functions if they exist
DROP VIEW IF EXISTS loans_with_details CASCADE;
DROP VIEW IF EXISTS members_with_details CASCADE;
DROP FUNCTION IF EXISTS get_dashboard_stats_for_user(text, integer, uuid);
DROP FUNCTION IF EXISTS get_members_for_user(uuid);

-- Step 2: Create loans_with_details view
CREATE VIEW loans_with_details AS
SELECT 
    l.id,
    l.principal_amount,
    l.status,
    l.due_date,
    l.member_id,
    l.customer_id,
    l.loan_officer_id,
    l.created_by,
    l.branch_id,
    l.group_id,
    l.created_at,
    l.updated_at,
    l.current_balance,
    l.total_paid,
    l.account_number,
    l.interest_rate,
    l.issue_date,
    m.full_name as member_name,
    m.id_number as member_id_number,
    m.phone_number as member_phone,
    m.status as member_status,
    b.name as branch_name,
    g.name as group_name,
    p.full_name as loan_officer_name
FROM loans l
LEFT JOIN members m ON l.member_id = m.id
LEFT JOIN branches b ON l.branch_id = b.id
LEFT JOIN groups g ON l.group_id = g.id
LEFT JOIN profiles p ON l.loan_officer_id = p.id;

-- Step 3: Create members_with_details view
CREATE VIEW members_with_details AS
SELECT 
    m.id,
    m.full_name,
    m.id_number,
    m.phone_number,
    m.address,
    m.status,
    m.branch_id,
    m.group_id,
    m.created_at,
    m.updated_at,
    m.assigned_officer_id,
    m.sex,
    m.marital_status,
    m.profession,
    m.monthly_income,
    m.kyc_id_type,
    b.name as branch_name,
    g.name as group_name,
    p.full_name as assigned_officer_name,
    COALESCE(loan_stats.total_loans, 0) as total_loans,
    COALESCE(loan_stats.outstanding_balance, 0) as outstanding_balance
FROM members m
LEFT JOIN branches b ON m.branch_id = b.id
LEFT JOIN groups g ON m.group_id = g.id
LEFT JOIN profiles p ON m.assigned_officer_id = p.id
LEFT JOIN (
    SELECT 
        member_id,
        COUNT(*) as total_loans,
        SUM(CASE WHEN status = 'active' THEN current_balance ELSE 0 END) as outstanding_balance
    FROM loans 
    GROUP BY member_id
) loan_stats ON m.id = loan_stats.member_id;

-- Step 4: Create function to get dashboard stats for any user role
CREATE FUNCTION get_dashboard_stats_for_user(user_role text, user_branch_id integer DEFAULT NULL, user_id uuid DEFAULT NULL)
RETURNS TABLE(
    total_members bigint,
    total_loans bigint,
    active_loans bigint,
    total_disbursed decimal,
    outstanding_balance decimal,
    overdue_loans bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Super admin sees all data
    IF user_role = 'super_admin' THEN
        RETURN QUERY
        SELECT 
            COUNT(DISTINCT m.id)::bigint as total_members,
            COUNT(l.id)::bigint as total_loans,
            COUNT(CASE WHEN l.status IN ('active', 'pending') THEN 1 END)::bigint as active_loans,
            COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.principal_amount ELSE 0 END), 0) as total_disbursed,
            COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.current_balance ELSE 0 END), 0) as outstanding_balance,
            COUNT(CASE WHEN l.status IN ('active', 'pending') AND l.due_date < CURRENT_DATE THEN 1 END)::bigint as overdue_loans
        FROM loans l
        LEFT JOIN members m ON l.member_id = m.id;
    
    -- Branch manager sees branch-specific data
    ELSIF user_role = 'branch_manager' AND user_branch_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            COUNT(DISTINCT m.id)::bigint as total_members,
            COUNT(l.id)::bigint as total_loans,
            COUNT(CASE WHEN l.status IN ('active', 'pending') THEN 1 END)::bigint as active_loans,
            COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.principal_amount ELSE 0 END), 0) as total_disbursed,
            COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.current_balance ELSE 0 END), 0) as outstanding_balance,
            COUNT(CASE WHEN l.status IN ('active', 'pending') AND l.due_date < CURRENT_DATE THEN 1 END)::bigint as overdue_loans
        FROM loans l
        LEFT JOIN members m ON l.member_id = m.id
        WHERE l.branch_id = user_branch_id;
    
    -- Loan officer sees own loans and members
    ELSIF user_role = 'loan_officer' AND user_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            COUNT(DISTINCT m.id)::bigint as total_members,
            COUNT(l.id)::bigint as total_loans,
            COUNT(CASE WHEN l.status IN ('active', 'pending') THEN 1 END)::bigint as active_loans,
            COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.principal_amount ELSE 0 END), 0) as total_disbursed,
            COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.current_balance ELSE 0 END), 0) as outstanding_balance,
            COUNT(CASE WHEN l.status IN ('active', 'pending') AND l.due_date < CURRENT_DATE THEN 1 END)::bigint as overdue_loans
        FROM loans l
        LEFT JOIN members m ON l.member_id = m.id
        WHERE l.created_by = user_id OR l.loan_officer_id = user_id;
    
    -- Teller/Auditor sees branch-specific data
    ELSIF user_role IN ('teller', 'auditor') AND user_branch_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            COUNT(DISTINCT m.id)::bigint as total_members,
            COUNT(l.id)::bigint as total_loans,
            COUNT(CASE WHEN l.status IN ('active', 'pending') THEN 1 END)::bigint as active_loans,
            COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.principal_amount ELSE 0 END), 0) as total_disbursed,
            COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.current_balance ELSE 0 END), 0) as outstanding_balance,
            COUNT(CASE WHEN l.status IN ('active', 'pending') AND l.due_date < CURRENT_DATE THEN 1 END)::bigint as overdue_loans
        FROM loans l
        LEFT JOIN members m ON l.member_id = m.id
        WHERE l.branch_id = user_branch_id;
    
    -- Default: return zeros
    ELSE
        RETURN QUERY
        SELECT 0::bigint, 0::bigint, 0::bigint, 0::decimal, 0::decimal, 0::bigint;
    END IF;
END;
$$;

-- Step 5: Create function to get members for any user role (FIXED - no ambiguous columns)
CREATE FUNCTION get_members_for_user(requesting_user_id uuid)
RETURNS TABLE(
    member_id uuid,
    full_name text,
    id_number text,
    phone_number text,
    status text,
    branch_name text,
    total_loans bigint,
    outstanding_balance decimal
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role text;
    user_branch_id integer;
BEGIN
    -- Get user role and branch
    SELECT role, branch_id INTO user_role, user_branch_id
    FROM profiles 
    WHERE id = requesting_user_id;
    
    -- Super admin sees all members
    IF user_role = 'super_admin' THEN
        RETURN QUERY
        SELECT 
            m.id as member_id,
            m.full_name,
            m.id_number,
            m.phone_number,
            m.status,
            b.name as branch_name,
            COALESCE(loan_stats.total_loans, 0)::bigint as total_loans,
            COALESCE(loan_stats.outstanding_balance, 0) as outstanding_balance
        FROM members m
        LEFT JOIN branches b ON m.branch_id = b.id
        LEFT JOIN (
            SELECT 
                l.member_id as member_id,
                COUNT(*) as total_loans,
                SUM(CASE WHEN l.status = 'active' THEN l.current_balance ELSE 0 END) as outstanding_balance
            FROM loans l
            GROUP BY l.member_id
        ) loan_stats ON m.id = loan_stats.member_id;
    
    -- Branch manager sees branch-specific members
    ELSIF user_role = 'branch_manager' AND user_branch_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            m.id as member_id,
            m.full_name,
            m.id_number,
            m.phone_number,
            m.status,
            b.name as branch_name,
            COALESCE(loan_stats.total_loans, 0)::bigint as total_loans,
            COALESCE(loan_stats.outstanding_balance, 0) as outstanding_balance
        FROM members m
        LEFT JOIN branches b ON m.branch_id = b.id
        LEFT JOIN (
            SELECT 
                l.member_id as member_id,
                COUNT(*) as total_loans,
                SUM(CASE WHEN l.status = 'active' THEN l.current_balance ELSE 0 END) as outstanding_balance
            FROM loans l
            GROUP BY l.member_id
        ) loan_stats ON m.id = loan_stats.member_id
        WHERE m.branch_id = user_branch_id;
    
    -- Loan officer sees members from their loans
    ELSIF user_role = 'loan_officer' THEN
        RETURN QUERY
        SELECT DISTINCT
            m.id as member_id,
            m.full_name,
            m.id_number,
            m.phone_number,
            m.status,
            b.name as branch_name,
            COALESCE(loan_stats.total_loans, 0)::bigint as total_loans,
            COALESCE(loan_stats.outstanding_balance, 0) as outstanding_balance
        FROM members m
        LEFT JOIN branches b ON m.branch_id = b.id
        LEFT JOIN (
            SELECT 
                l.member_id as member_id,
                COUNT(*) as total_loans,
                SUM(CASE WHEN l.status = 'active' THEN l.current_balance ELSE 0 END) as outstanding_balance
            FROM loans l
            GROUP BY l.member_id
        ) loan_stats ON m.id = loan_stats.member_id
        WHERE m.id IN (
            SELECT DISTINCT l.member_id 
            FROM loans l
            WHERE l.created_by = requesting_user_id OR l.loan_officer_id = requesting_user_id
        );
    
    -- Teller/Auditor sees branch-specific members
    ELSIF user_role IN ('teller', 'auditor') AND user_branch_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            m.id as member_id,
            m.full_name,
            m.id_number,
            m.phone_number,
            m.status,
            b.name as branch_name,
            COALESCE(loan_stats.total_loans, 0)::bigint as total_loans,
            COALESCE(loan_stats.outstanding_balance, 0) as outstanding_balance
        FROM members m
        LEFT JOIN branches b ON m.branch_id = b.id
        LEFT JOIN (
            SELECT 
                l.member_id as member_id,
                COUNT(*) as total_loans,
                SUM(CASE WHEN l.status = 'active' THEN l.current_balance ELSE 0 END) as outstanding_balance
            FROM loans l
            GROUP BY l.member_id
        ) loan_stats ON m.id = loan_stats.member_id
        WHERE m.branch_id = user_branch_id;
    
    -- Default: return empty result
    ELSE
        RETURN QUERY
        SELECT 
            NULL::uuid as member_id,
            NULL::text as full_name,
            NULL::text as id_number,
            NULL::text as phone_number,
            NULL::text as status,
            NULL::text as branch_name,
            0::bigint as total_loans,
            0::decimal as outstanding_balance
        WHERE FALSE;
    END IF;
END;
$$;

-- Step 6: Grant permissions
GRANT SELECT ON loans_with_details TO authenticated;
GRANT SELECT ON members_with_details TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION get_members_for_user TO authenticated;

-- Step 7: Set security invoker for views
ALTER VIEW loans_with_details SET (security_invoker = true);
ALTER VIEW members_with_details SET (security_invoker = true);
