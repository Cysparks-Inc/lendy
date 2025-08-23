-- Simplify the system to use only the profiles table for user management
-- This eliminates the redundant user_roles table and makes the system more maintainable

-- First, ensure profiles table has all necessary columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role public.app_role,
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id),
ADD COLUMN IF NOT EXISTS profile_picture_url text,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

-- Update the dashboard functions to use profiles table instead of user_roles
DROP FUNCTION IF EXISTS get_dashboard_stats_for_user(UUID);
DROP FUNCTION IF EXISTS get_recent_loans_for_user(UUID);

-- Function to get dashboard stats based on user role (using profiles table)
CREATE FUNCTION get_dashboard_stats_for_user(requesting_user_id UUID)
RETURNS TABLE (
  total_customers BIGINT,
  total_loans BIGINT,
  total_disbursed NUMERIC,
  total_repaid NUMERIC,
  outstanding_balance NUMERIC,
  active_loans BIGINT,
  pending_loans BIGINT,
  defaulted_loans BIGINT,
  repaid_loans BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role TEXT;
  user_branch_id UUID;
BEGIN
  -- Get user's role and branch from profiles table
  SELECT p.role, p.branch_id INTO user_role, user_branch_id
  FROM profiles p
  WHERE p.id = requesting_user_id
  LIMIT 1;

  -- If no role found, return empty stats
  IF user_role IS NULL THEN
    RETURN;
  END IF;

  -- Super admin sees system-wide stats
  IF user_role = 'super_admin' THEN
    RETURN QUERY
    SELECT 
      COUNT(DISTINCT m.id) as total_customers,
      COUNT(l.id) as total_loans,
      COALESCE(SUM(l.principal_amount), 0) as total_disbursed,
      COALESCE(SUM(p.amount), 0) as total_repaid,
      COALESCE(SUM(l.principal_amount) - COALESCE(SUM(p.amount), 0), 0) as outstanding_balance,
      COUNT(CASE WHEN l.status = 'active' THEN 1 END) as active_loans,
      COUNT(CASE WHEN l.status = 'pending' THEN 1 END) as pending_loans,
      COUNT(CASE WHEN l.status = 'defaulted' THEN 1 END) as defaulted_loans,
      COUNT(CASE WHEN l.status = 'repaid' THEN 1 END) as repaid_loans
    FROM members m
    LEFT JOIN loans l ON m.id = l.member_id
    LEFT JOIN payments p ON l.id = p.loan_id;
  
  -- Branch admin sees branch-specific stats
  ELSIF user_role = 'branch_admin' AND user_branch_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      COUNT(DISTINCT m.id) as total_customers,
      COUNT(l.id) as total_loans,
      COALESCE(SUM(l.principal_amount), 0) as total_disbursed,
      COALESCE(SUM(p.amount), 0) as total_repaid,
      COALESCE(SUM(l.principal_amount) - COALESCE(SUM(p.amount), 0), 0) as outstanding_balance,
      COUNT(CASE WHEN l.status = 'active' THEN 1 END) as active_loans,
      COUNT(CASE WHEN l.status = 'pending' THEN 1 END) as pending_loans,
      COUNT(CASE WHEN l.status = 'defaulted' THEN 1 END) as defaulted_loans,
      COUNT(CASE WHEN l.status = 'repaid' THEN 1 END) as repaid_loans
    FROM members m
    LEFT JOIN loans l ON m.id = l.member_id
    LEFT JOIN payments p ON l.id = p.loan_id
    WHERE m.branch_id = user_branch_id;
  
  -- Loan officer sees only their own loans
  ELSIF user_role = 'loan_officer' THEN
    RETURN QUERY
    SELECT 
      COUNT(DISTINCT m.id) as total_customers,
      COUNT(l.id) as total_loans,
      COALESCE(SUM(l.principal_amount), 0) as total_disbursed,
      COALESCE(SUM(p.amount), 0) as total_repaid,
      COALESCE(SUM(l.principal_amount) - COALESCE(SUM(p.amount), 0), 0) as outstanding_balance,
      COUNT(CASE WHEN l.status = 'active' THEN 1 END) as active_loans,
      COUNT(CASE WHEN l.status = 'pending' THEN 1 END) as pending_loans,
      COUNT(CASE WHEN l.status = 'defaulted' THEN 1 END) as defaulted_loans,
      COUNT(CASE WHEN l.status = 'repaid' THEN 1 END) as repaid_loans
    FROM members m
    LEFT JOIN loans l ON m.id = l.member_id AND l.created_by = requesting_user_id
    LEFT JOIN payments p ON l.id = p.loan_id;
  
  -- Teller and auditor see branch-specific stats if they have a branch
  ELSIF user_role IN ('teller', 'auditor') AND user_branch_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      COUNT(DISTINCT m.id) as total_customers,
      COUNT(l.id) as total_loans,
      COALESCE(SUM(l.principal_amount), 0) as total_disbursed,
      COALESCE(SUM(p.amount), 0) as total_repaid,
      COALESCE(SUM(l.principal_amount) - COALESCE(SUM(p.amount), 0), 0) as outstanding_balance,
      COUNT(CASE WHEN l.status = 'active' THEN 1 END) as active_loans,
      COUNT(CASE WHEN l.status = 'pending' THEN 1 END) as pending_loans,
      COUNT(CASE WHEN l.status = 'defaulted' THEN 1 END) as defaulted_loans,
      COUNT(CASE WHEN l.status = 'repaid' THEN 1 END) as repaid_loans
    FROM members m
    LEFT JOIN loans l ON m.id = l.member_id
    LEFT JOIN payments p ON l.id = p.loan_id
    WHERE m.branch_id = user_branch_id;
  
  -- Default case: return empty stats
  ELSE
    RETURN;
  END IF;
END;
$$;

-- Function to get recent loans based on user role (using profiles table)
CREATE FUNCTION get_recent_loans_for_user(requesting_user_id UUID)
RETURNS TABLE (
  id UUID,
  principal_amount NUMERIC,
  status TEXT,
  member_name TEXT,
  member_id UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role TEXT;
  user_branch_id UUID;
BEGIN
  -- Get user's role and branch from profiles table
  SELECT p.role, p.branch_id INTO user_role, user_branch_id
  FROM profiles p
  WHERE p.id = requesting_user_id
  LIMIT 1;

  -- If no role found, return empty results
  IF user_role IS NULL THEN
    RETURN;
  END IF;

  -- Super admin sees system-wide recent loans
  IF user_role = 'super_admin' THEN
    RETURN QUERY
    SELECT 
      l.id,
      l.principal_amount,
      l.status,
      m.full_name as member_name,
      m.id as member_id
    FROM loans l
    JOIN members m ON l.member_id = m.id
    ORDER BY l.created_at DESC
    LIMIT 5;
  
  -- Branch admin sees branch-specific recent loans
  ELSIF user_role = 'branch_admin' AND user_branch_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      l.id,
      l.principal_amount,
      l.status,
      m.full_name as member_name,
      m.id as member_id
    FROM loans l
    JOIN members m ON l.member_id = m.id
    WHERE m.branch_id = user_branch_id
    ORDER BY l.created_at DESC
    LIMIT 5;
  
  -- Loan officer sees only their own recent loans
  ELSIF user_role = 'loan_officer' THEN
    RETURN QUERY
    SELECT 
      l.id,
      l.principal_amount,
      l.status,
      m.full_name as member_name,
      m.id as member_id
    FROM loans l
    JOIN members m ON l.member_id = m.id
    WHERE l.created_by = requesting_user_id
    ORDER BY l.created_at DESC
    LIMIT 5;
  
  -- Teller and auditor see branch-specific recent loans if they have a branch
  ELSIF user_role IN ('teller', 'auditor') AND user_branch_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      l.id,
      l.principal_amount,
      l.status,
      m.full_name as member_name,
      m.id as member_id
    FROM loans l
    JOIN members m ON l.member_id = m.id
    WHERE m.branch_id = user_branch_id
    ORDER BY l.created_at DESC
    LIMIT 5;
  
  -- Default case: return empty results
  ELSE
    RETURN;
  END IF;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_dashboard_stats_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_loans_for_user(UUID) TO authenticated;
