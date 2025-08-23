-- Simple Branch Fallback Migration
-- This provides basic branch functionality without complex analytics

-- Create a simple view for basic branch statistics
CREATE OR REPLACE VIEW branch_basic_view AS
SELECT 
  b.id,
  b.name,
  b.location,
  b.created_at,
  COALESCE(member_stats.count, 0) as member_count,
  COALESCE(loan_stats.count, 0) as loan_count,
  COALESCE(loan_stats.total_outstanding, 0) as total_outstanding,
  COALESCE(loan_stats.total_portfolio, 0) as total_portfolio
FROM branches b
LEFT JOIN (
  SELECT 
    branch_id,
    COUNT(*) as count
  FROM members 
  WHERE status = 'active'
  GROUP BY branch_id
) member_stats ON b.id = member_stats.branch_id
LEFT JOIN (
  SELECT 
    branch_id,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as count,
    COALESCE(SUM(CASE WHEN status = 'active' THEN current_balance ELSE 0 END), 0) as total_outstanding,
    COALESCE(SUM(principal_amount), 0) as total_portfolio
  FROM loans 
  GROUP BY branch_id
) loan_stats ON b.id = loan_stats.branch_id;

-- Grant permissions
GRANT SELECT ON branch_basic_view TO authenticated;
ALTER VIEW branch_basic_view SET (security_invoker = true);
