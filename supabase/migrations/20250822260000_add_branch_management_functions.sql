-- Migration: Add Branch Management Functions
-- This migration adds functions for branch statistics and management

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_branch_stats();
DROP FUNCTION IF EXISTS get_branch_detailed_stats();

-- Function to get basic branch statistics
CREATE OR REPLACE FUNCTION get_branch_stats()
RETURNS TABLE (
  id integer,
  name text,
  location text,
  created_at timestamptz,
  member_count bigint,
  loan_count bigint,
  total_outstanding numeric,
  total_loans bigint,
  total_portfolio numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.location,
    b.created_at,
    COALESCE(member_stats.count, 0) as member_count,
    COALESCE(loan_stats.count, 0) as loan_count,
    COALESCE(loan_stats.total_outstanding, 0) as total_outstanding,
    COALESCE(loan_stats.total_loans, 0) as total_loans,
    COALESCE(loan_stats.total_portfolio, 0) as total_portfolio
  FROM branches b
  LEFT JOIN (
    SELECT 
      branch_id,
      COUNT(*) as count
    FROM members 
    WHERE members.status = 'active'
    GROUP BY branch_id
  ) member_stats ON b.id = member_stats.branch_id
  LEFT JOIN (
    SELECT 
      l.branch_id,
      COUNT(*) as total_loans,
      COUNT(CASE WHEN l.status::text = 'active' THEN 1 END) as count,
      COALESCE(SUM(CASE WHEN l.status::text = 'active' THEN l.current_balance ELSE 0 END), 0) as total_outstanding,
      COALESCE(SUM(l.principal_amount), 0) as total_portfolio
    FROM loans l
    GROUP BY l.branch_id
  ) loan_stats ON b.id = loan_stats.branch_id
  ORDER BY b.name;
END;
$$;

-- Function to get detailed branch statistics with performance metrics
CREATE OR REPLACE FUNCTION get_branch_detailed_stats()
RETURNS TABLE (
  id integer,
  name text,
  location text,
  created_at timestamptz,
  member_count bigint,
  active_members bigint,
  loan_count bigint,
  active_loans bigint,
  defaulted_loans bigint,
  total_outstanding numeric,
  total_portfolio numeric,
  avg_loan_size numeric,
  recovery_rate numeric,
  last_activity timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.location,
    b.created_at,
    COALESCE(member_stats.total_count, 0) as member_count,
    COALESCE(member_stats.active_count, 0) as active_members,
    COALESCE(loan_stats.total_count, 0) as loan_count,
    COALESCE(loan_stats.active_count, 0) as active_loans,
    COALESCE(loan_stats.defaulted_count, 0) as defaulted_loans,
    COALESCE(loan_stats.total_outstanding, 0) as total_outstanding,
    COALESCE(loan_stats.total_portfolio, 0) as total_portfolio,
    CASE 
      WHEN COALESCE(loan_stats.total_count, 0) > 0 
      THEN COALESCE(loan_stats.total_portfolio, 0) / loan_stats.total_count 
      ELSE 0 
    END as avg_loan_size,
    CASE 
      WHEN COALESCE(loan_stats.total_portfolio, 0) > 0 
      THEN ((loan_stats.total_portfolio - loan_stats.total_outstanding) / loan_stats.total_portfolio) * 100
      ELSE 0 
    END as recovery_rate,
    COALESCE(activity_stats.last_activity, b.created_at) as last_activity
  FROM branches b
  LEFT JOIN (
    SELECT 
      branch_id,
      COUNT(*) as total_count,
      COUNT(CASE WHEN members.status = 'active' THEN 1 END) as active_count
    FROM members 
    GROUP BY branch_id
  ) member_stats ON b.id = member_stats.branch_id
  LEFT JOIN (
    SELECT 
      l.branch_id,
      COUNT(*) as total_count,
      COUNT(CASE WHEN l.status::text = 'active' THEN 1 END) as active_count,
      COUNT(CASE WHEN l.status::text = 'defaulted' THEN 1 END) as defaulted_count,
      COALESCE(SUM(CASE WHEN l.status::text = 'active' THEN l.current_balance ELSE 0 END), 0) as total_outstanding,
      COALESCE(SUM(l.principal_amount), 0) as total_portfolio
    FROM loans l
    GROUP BY l.branch_id
  ) loan_stats ON b.id = loan_stats.branch_id
  LEFT JOIN (
    SELECT 
      branch_id,
      MAX(created_at) as last_activity
    FROM (
      SELECT branch_id, created_at FROM members
      UNION ALL
      SELECT branch_id, created_at FROM loans
    ) combined_activity
    GROUP BY branch_id
  ) activity_stats ON b.id = activity_stats.branch_id
  ORDER BY b.name;
END;
$$;

-- Function to get branch performance comparison
CREATE OR REPLACE FUNCTION get_branch_performance_comparison()
RETURNS TABLE (
  branch_name text,
  member_growth_rate numeric,
  loan_growth_rate numeric,
  portfolio_growth_rate numeric,
  efficiency_score numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH branch_metrics AS (
    SELECT 
      b.name,
      b.id,
      COALESCE(member_stats.count, 0) as member_count,
      COALESCE(loan_stats.count, 0) as loan_count,
      COALESCE(loan_stats.total_outstanding, 0) as total_outstanding,
      COALESCE(loan_stats.total_portfolio, 0) as total_portfolio
    FROM branches b
    LEFT JOIN (
      SELECT members.branch_id, COUNT(*) as count FROM members WHERE members.status = 'active' GROUP BY members.branch_id
    ) member_stats ON b.id = member_stats.branch_id
    LEFT JOIN (
      SELECT 
        l.branch_id, 
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN l.status::text = 'active' THEN l.current_balance ELSE 0 END), 0) as total_outstanding,
        COALESCE(SUM(l.principal_amount), 0) as total_portfolio
      FROM loans l
      GROUP BY l.branch_id
    ) loan_stats ON b.id = loan_stats.branch_id
  )
  SELECT 
    name as branch_name,
    CASE 
      WHEN member_count > 0 THEN (member_count::numeric / NULLIF((SELECT MAX(member_count) FROM branch_metrics), 0)) * 100
      ELSE 0 
    END as member_growth_rate,
    CASE 
      WHEN loan_count > 0 THEN (loan_count::numeric / NULLIF((SELECT MAX(loan_count) FROM branch_metrics), 0)) * 100
      ELSE 0 
    END as loan_growth_rate,
    CASE 
      WHEN total_portfolio > 0 THEN (total_portfolio::numeric / NULLIF((SELECT MAX(total_portfolio) FROM branch_metrics), 0)) * 100
      ELSE 0 
    END as portfolio_growth_rate,
    CASE 
      WHEN total_portfolio > 0 AND member_count > 0 
      THEN ((total_portfolio / member_count) / NULLIF((SELECT MAX(total_portfolio / NULLIF(member_count, 0)) FROM branch_metrics), 0)) * 100
      ELSE 0 
    END as efficiency_score
  FROM branch_metrics
  ORDER BY efficiency_score DESC;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_branch_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_branch_detailed_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_branch_performance_comparison() TO authenticated;

-- Create a view for branch summary statistics
CREATE OR REPLACE VIEW branch_summary_view AS
SELECT 
  b.id,
  b.name,
  b.location,
  b.created_at,
  COALESCE(member_stats.count, 0) as member_count,
  COALESCE(loan_stats.count, 0) as loan_count,
  COALESCE(loan_stats.total_outstanding, 0) as total_outstanding,
  COALESCE(loan_stats.total_portfolio, 0) as total_portfolio,
  COALESCE(loan_stats.avg_loan_size, 0) as avg_loan_size
FROM branches b
LEFT JOIN (
  SELECT 
    branch_id,
    COUNT(*) as count
  FROM members 
  WHERE members.status = 'active'
  GROUP BY branch_id
) member_stats ON b.id = member_stats.branch_id
LEFT JOIN (
    SELECT 
      branch_id,
      COUNT(*) as count,
      0 as total_outstanding,
      COALESCE(SUM(principal_amount), 0) as total_portfolio,
      CASE 
        WHEN COUNT(*) > 0 THEN COALESCE(SUM(principal_amount), 0) / COUNT(*)
        ELSE 0 
      END as avg_loan_size
    FROM loans 
    GROUP BY branch_id
) loan_stats ON b.id = loan_stats.branch_id;

-- Grant select permissions on the view
GRANT SELECT ON branch_summary_view TO authenticated;

-- Add RLS policy for the view
ALTER VIEW branch_summary_view SET (security_invoker = true);
