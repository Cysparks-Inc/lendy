-- Migration: Comprehensive Group Management System
-- This migration adds advanced group management functions and views

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_group_comprehensive_stats();
DROP FUNCTION IF EXISTS get_group_members_detailed();
DROP FUNCTION IF EXISTS get_group_loan_officers();
DROP FUNCTION IF EXISTS get_group_performance_metrics();
DROP FUNCTION IF EXISTS get_group_loan_summary();
DROP FUNCTION IF EXISTS get_group_activity_timeline();

-- Function to get comprehensive group statistics
CREATE OR REPLACE FUNCTION get_group_comprehensive_stats()
RETURNS TABLE (
  id integer,
  name text,
  description text,
  branch_id integer,
  branch_name text,
  created_at timestamptz,
  member_count bigint,
  active_members bigint,
  loan_count bigint,
  active_loans bigint,
  total_outstanding numeric,
  total_portfolio numeric,
  avg_loan_size numeric,
  avg_member_age numeric,
  total_loan_officers bigint,
  last_activity timestamptz,
  group_health_score numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.name,
    g.description,
    g.branch_id,
    b.name as branch_name,
    g.created_at,
    COALESCE(member_stats.total_count, 0) as member_count,
    COALESCE(member_stats.active_count, 0) as active_members,
    COALESCE(loan_stats.total_count, 0) as loan_count,
    COALESCE(loan_stats.active_count, 0) as active_loans,
    COALESCE(loan_stats.total_outstanding, 0) as total_outstanding,
    COALESCE(loan_stats.total_portfolio, 0) as total_portfolio,
    CASE 
      WHEN COALESCE(loan_stats.total_count, 0) > 0 
      THEN COALESCE(loan_stats.total_portfolio, 0) / loan_stats.total_count 
      ELSE 0 
    END as avg_loan_size,
    COALESCE(member_stats.avg_age, 0) as avg_member_age,
    COALESCE(officer_stats.count, 0) as total_loan_officers,
    COALESCE(activity_stats.last_activity, g.created_at) as last_activity,
    CASE 
      WHEN COALESCE(member_stats.active_count, 0) > 0 AND COALESCE(loan_stats.total_outstanding, 0) > 0
      THEN (
        (COALESCE(member_stats.active_count, 0) * 0.3) + 
        (CASE WHEN COALESCE(loan_stats.total_portfolio, 0) > 0 
         THEN ((COALESCE(loan_stats.total_portfolio, 0) - COALESCE(loan_stats.total_outstanding, 0)) / COALESCE(loan_stats.total_portfolio, 0)) * 70 
         ELSE 0 END)
      )
      ELSE 0 
    END as group_health_score
  FROM groups g
  LEFT JOIN branches b ON g.branch_id = b.id
  LEFT JOIN (
    SELECT 
      group_id,
      COUNT(*) as total_count,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
      AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, COALESCE(dob, CURRENT_DATE)))) as avg_age
    FROM members 
    GROUP BY group_id
  ) member_stats ON g.id = member_stats.group_id
  LEFT JOIN (
    SELECT 
      group_id,
      COUNT(*) as total_count,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
      COALESCE(SUM(CASE WHEN status = 'active' THEN current_balance ELSE 0 END), 0) as total_outstanding,
      COALESCE(SUM(principal_amount), 0) as total_portfolio
    FROM loans 
    GROUP BY group_id
  ) loan_stats ON g.id = loan_stats.group_id
  LEFT JOIN (
    SELECT 
      group_id,
      COUNT(DISTINCT assigned_officer_id) as count
    FROM members 
    WHERE assigned_officer_id IS NOT NULL
    GROUP BY group_id
  ) officer_stats ON g.id = officer_stats.group_id
  LEFT JOIN (
    SELECT 
      group_id,
      MAX(created_at) as last_activity
    FROM (
      SELECT group_id, created_at FROM members
      UNION ALL
      SELECT group_id, created_at FROM loans
    ) combined_activity
    GROUP BY group_id
  ) activity_stats ON g.id = activity_stats.group_id
  ORDER BY g.name;
END;
$$;

-- Function to get detailed group members with their information
CREATE OR REPLACE FUNCTION get_group_members_detailed(group_id_param integer)
RETURNS TABLE (
  id uuid,
  full_name text,
  id_number text,
  phone_number text,
  status text,
  assigned_officer_id uuid,
  loan_officer_name text,
  total_loans bigint,
  active_loans bigint,
  total_outstanding numeric,
  last_loan_date timestamptz,
  member_since timestamptz,
  monthly_income numeric,
  profession text,
  address text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.full_name,
    m.id_number,
    m.phone_number,
    m.status,
    m.assigned_officer_id,
    p.full_name as loan_officer_name,
    COALESCE(loan_stats.total_count, 0) as total_loans,
    COALESCE(loan_stats.active_count, 0) as active_loans,
    COALESCE(loan_stats.total_outstanding, 0) as total_outstanding,
    loan_stats.last_loan_date,
    m.created_at as member_since,
    m.monthly_income,
    m.profession,
    m.address
  FROM members m
  LEFT JOIN profiles p ON m.assigned_officer_id = p.id
  LEFT JOIN (
    SELECT 
      member_id,
      COUNT(*) as total_count,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
      COALESCE(SUM(CASE WHEN status = 'active' THEN current_balance ELSE 0 END), 0) as total_outstanding,
      MAX(created_at) as last_loan_date
    FROM loans 
    GROUP BY member_id
  ) loan_stats ON m.id = loan_stats.member_id
  WHERE m.group_id = group_id_param
  ORDER BY m.full_name;
END;
$$;

-- Function to get loan officers assigned to a group
CREATE OR REPLACE FUNCTION get_group_loan_officers(group_id_param integer)
RETURNS TABLE (
  officer_id uuid,
  full_name text,
  email text,
  phone_number text,
  assigned_members bigint,
  active_loans bigint,
  total_portfolio numeric,
  avg_loan_size numeric,
  last_activity timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as officer_id,
    p.full_name,
    p.email,
    p.phone_number,
    COALESCE(member_stats.count, 0) as assigned_members,
    COALESCE(loan_stats.count, 0) as active_loans,
    COALESCE(loan_stats.total_portfolio, 0) as total_portfolio,
    CASE 
      WHEN COALESCE(loan_stats.count, 0) > 0 
      THEN COALESCE(loan_stats.total_portfolio, 0) / loan_stats.count 
      ELSE 0 
    END as avg_loan_size,
    COALESCE(activity_stats.last_activity, p.created_at) as last_activity
  FROM profiles p
  LEFT JOIN (
    SELECT 
      assigned_officer_id,
      COUNT(*) as count
    FROM members 
    WHERE group_id = group_id_param AND assigned_officer_id IS NOT NULL
    GROUP BY assigned_officer_id
  ) member_stats ON p.id = member_stats.assigned_officer_id
  LEFT JOIN (
    SELECT 
      loan_officer_id,
      COUNT(*) as count,
      COALESCE(SUM(principal_amount), 0) as total_portfolio
    FROM loans 
    WHERE group_id = group_id_param AND status = 'active'
    GROUP BY loan_officer_id
  ) loan_stats ON p.id = loan_stats.loan_officer_id
  LEFT JOIN (
    SELECT 
      loan_officer_id,
      MAX(created_at) as last_activity
    FROM loans 
    WHERE group_id = group_id_param
    GROUP BY loan_officer_id
  ) activity_stats ON p.id = activity_stats.loan_officer_id
  WHERE member_stats.count > 0 OR loan_stats.count > 0
  ORDER BY member_stats.count DESC, loan_stats.count DESC;
END;
$$;

-- Function to get group performance metrics
CREATE OR REPLACE FUNCTION get_group_performance_metrics()
RETURNS TABLE (
  group_id integer,
  group_name text,
  branch_name text,
  member_growth_rate numeric,
  loan_growth_rate numeric,
  portfolio_growth_rate numeric,
  repayment_rate numeric,
  efficiency_score numeric,
  risk_score numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH group_metrics AS (
    SELECT 
      g.id,
      g.name,
      b.name as branch_name,
      COALESCE(member_stats.count, 0) as member_count,
      COALESCE(loan_stats.count, 0) as loan_count,
      COALESCE(loan_stats.total_outstanding, 0) as total_outstanding,
      COALESCE(loan_stats.total_portfolio, 0) as total_portfolio,
      COALESCE(repayment_stats.total_repaid, 0) as total_repaid
    FROM groups g
    LEFT JOIN branches b ON g.branch_id = b.id
    LEFT JOIN (
      SELECT 
        group_id,
        COUNT(*) as count
      FROM members 
      WHERE status = 'active'
      GROUP BY group_id
    ) member_stats ON g.id = member_stats.group_id
    LEFT JOIN (
      SELECT 
        group_id,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as count,
        COALESCE(SUM(CASE WHEN status = 'active' THEN current_balance ELSE 0 END), 0) as total_outstanding,
        COALESCE(SUM(principal_amount), 0) as total_portfolio
      FROM loans 
      GROUP BY group_id
    ) loan_stats ON g.id = loan_stats.group_id
    LEFT JOIN (
      SELECT 
        group_id,
        COALESCE(SUM(total_paid), 0) as total_repaid
      FROM loans 
      GROUP BY group_id
    ) repayment_stats ON g.id = repayment_stats.group_id
  )
  SELECT 
    id as group_id,
    name as group_name,
    branch_name,
    CASE 
      WHEN member_count > 0 THEN (member_count::numeric / NULLIF((SELECT MAX(member_count) FROM group_metrics), 0)) * 100
      ELSE 0 
    END as member_growth_rate,
    CASE 
      WHEN loan_count > 0 THEN (loan_count::numeric / NULLIF((SELECT MAX(loan_count) FROM group_metrics), 0)) * 100
      ELSE 0 
    END as loan_growth_rate,
    CASE 
      WHEN total_portfolio > 0 THEN (total_portfolio::numeric / NULLIF((SELECT MAX(total_portfolio) FROM group_metrics), 0)) * 100
      ELSE 0 
    END as portfolio_growth_rate,
    CASE 
      WHEN total_portfolio > 0 THEN (total_repaid / total_portfolio) * 100
      ELSE 0 
    END as repayment_rate,
    CASE 
      WHEN total_portfolio > 0 AND member_count > 0 
      THEN ((total_portfolio / member_count) / NULLIF((SELECT MAX(total_portfolio / NULLIF(member_count, 0)) FROM group_metrics), 0)) * 100
      ELSE 0 
    END as efficiency_score,
    CASE 
      WHEN total_portfolio > 0 THEN (total_outstanding / total_portfolio) * 100
      ELSE 0 
    END as risk_score
  FROM group_metrics
  ORDER BY efficiency_score DESC;
END;
$$;

-- Function to get group loan summary
CREATE OR REPLACE FUNCTION get_group_loan_summary(group_id_param integer)
RETURNS TABLE (
  loan_id uuid,
  account_number text,
  member_name text,
  principal_amount numeric,
  current_balance numeric,
  status text,
  issue_date date,
  due_date date,
  days_overdue integer,
  loan_officer_name text,
  total_paid numeric,
  interest_accrued numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id as loan_id,
    l.account_number,
    m.full_name as member_name,
    l.principal_amount,
    l.current_balance,
    l.status,
    l.issue_date,
    l.due_date,
    CASE 
      WHEN l.status = 'active' AND l.due_date < CURRENT_DATE 
      THEN EXTRACT(DAY FROM (CURRENT_DATE - l.due_date))
      ELSE 0 
    END as days_overdue,
    p.full_name as loan_officer_name,
    COALESCE(l.total_paid, 0) as total_paid,
    COALESCE(l.total_interest_accrued, 0) as interest_accrued
  FROM loans l
  JOIN members m ON l.member_id = m.id
  LEFT JOIN profiles p ON l.loan_officer_id = p.id
  WHERE l.group_id = group_id_param
  ORDER BY l.created_at DESC;
END;
$$;

-- Function to get group activity timeline
CREATE OR REPLACE FUNCTION get_group_activity_timeline(group_id_param integer, days_back integer DEFAULT 30)
RETURNS TABLE (
  activity_type text,
  description text,
  member_name text,
  amount numeric,
  activity_date timestamptz,
  loan_officer_name text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'Member Added' as activity_type,
    'New member joined the group' as description,
    m.full_name as member_name,
    NULL as amount,
    m.created_at as activity_date,
    p.full_name as loan_officer_name
  FROM members m
  LEFT JOIN profiles p ON m.assigned_officer_id = p.id
  WHERE m.group_id = group_id_param 
    AND m.created_at >= CURRENT_DATE - INTERVAL '1 day' * days_back
  
  UNION ALL
  
  SELECT 
    'Loan Created' as activity_type,
    'New loan disbursed' as description,
    m.full_name as member_name,
    l.principal_amount as amount,
    l.created_at as activity_date,
    p.full_name as loan_officer_name
  FROM loans l
  JOIN members m ON l.member_id = m.id
  LEFT JOIN profiles p ON l.loan_officer_id = p.id
  WHERE l.group_id = group_id_param 
    AND l.created_at >= CURRENT_DATE - INTERVAL '1 day' * days_back
  
  ORDER BY activity_date DESC;
END;
$$;

-- Create comprehensive group summary view
CREATE OR REPLACE VIEW group_summary_view AS
SELECT 
  g.id,
  g.name,
  g.description,
  g.branch_id,
  b.name as branch_name,
  g.created_at,
  COALESCE(member_stats.count, 0) as member_count,
  COALESCE(loan_stats.count, 0) as loan_count,
  COALESCE(loan_stats.total_outstanding, 0) as total_outstanding,
  COALESCE(loan_stats.total_portfolio, 0) as total_portfolio,
  COALESCE(officer_stats.count, 0) as loan_officer_count,
  COALESCE(activity_stats.last_activity, g.created_at) as last_activity
FROM groups g
LEFT JOIN branches b ON g.branch_id = b.id
LEFT JOIN (
  SELECT 
    group_id,
    COUNT(*) as count
  FROM members 
  WHERE status = 'active'
  GROUP BY group_id
) member_stats ON g.id = member_stats.group_id
LEFT JOIN (
  SELECT 
    group_id,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as count,
    COALESCE(SUM(CASE WHEN status = 'active' THEN current_balance ELSE 0 END), 0) as total_outstanding,
    COALESCE(SUM(principal_amount), 0) as total_portfolio
  FROM loans 
  GROUP BY group_id
) loan_stats ON g.id = loan_stats.group_id
LEFT JOIN (
  SELECT 
    group_id,
    COUNT(DISTINCT assigned_officer_id) as count
  FROM members 
  WHERE assigned_officer_id IS NOT NULL
  GROUP BY group_id
) officer_stats ON g.id = officer_stats.group_id
LEFT JOIN (
  SELECT 
    group_id,
    MAX(created_at) as last_activity
  FROM (
    SELECT group_id, created_at FROM members
    UNION ALL
    SELECT group_id, created_at FROM loans
  ) combined_activity
  GROUP BY group_id
) activity_stats ON g.id = activity_stats.group_id;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_group_comprehensive_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_group_members_detailed(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_group_loan_officers(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_group_performance_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_group_loan_summary(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_group_activity_timeline(integer, integer) TO authenticated;

-- Grant select permissions on the view
GRANT SELECT ON group_summary_view TO authenticated;

-- Add RLS policy for the view
ALTER VIEW group_summary_view SET (security_invoker = true);
