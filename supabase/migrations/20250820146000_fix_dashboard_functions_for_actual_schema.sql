-- Fix dashboard functions to work with actual database schema
-- This migration detects the actual table structure and creates compatible functions

-- Drop existing functions
DROP FUNCTION IF EXISTS get_dashboard_stats_for_user(UUID);
DROP FUNCTION IF EXISTS get_recent_loans_for_user(UUID);

-- Create dashboard functions that work with the actual schema
-- We'll use dynamic SQL to handle different table structures

-- Function to get dashboard stats based on user role (robust version)
CREATE OR REPLACE FUNCTION get_dashboard_stats_for_user(requesting_user_id UUID)
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
  has_members_table BOOLEAN;
  has_customers_table BOOLEAN;
  loans_member_column TEXT;
  payments_table_name TEXT;
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

  -- Check which tables exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'members'
  ) INTO has_members_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'customers'
  ) INTO has_customers_table;

  -- Determine the correct column name for loans table
  SELECT 
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'member_id'
      ) THEN 'member_id'
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'customer_id'
      ) THEN 'customer_id'
      ELSE NULL
    END INTO loans_member_column;

  -- Determine payments table name
  SELECT 
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'payments'
      ) THEN 'payments'
      WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'repayments'
      ) THEN 'repayments'
      ELSE NULL
    END INTO payments_table_name;

  -- Super admin sees system-wide stats
  IF user_role = 'super_admin' THEN
    IF has_members_table AND loans_member_column = 'member_id' THEN
      -- Use members table with member_id
      IF payments_table_name = 'payments' THEN
        RETURN QUERY EXECUTE format('
          SELECT 
            COUNT(DISTINCT m.id)::BIGINT as total_customers,
            COUNT(l.id)::BIGINT as total_loans,
            COALESCE(SUM(l.principal_amount), 0) as total_disbursed,
            COALESCE(SUM(p.amount), 0) as total_repaid,
            COALESCE(SUM(l.principal_amount) - COALESCE(SUM(p.amount), 0), 0) as outstanding_balance,
            COUNT(CASE WHEN l.status = ''active'' THEN 1 END)::BIGINT as active_loans,
            COUNT(CASE WHEN l.status = ''pending'' THEN 1 END)::BIGINT as pending_loans,
            COUNT(CASE WHEN l.status = ''defaulted'' THEN 1 END)::BIGINT as defaulted_loans,
            COUNT(CASE WHEN l.status IN (''repaid'', ''completed'') THEN 1 END)::BIGINT as repaid_loans
          FROM members m
          LEFT JOIN loans l ON m.id = l.%I
          LEFT JOIN payments p ON l.id = p.loan_id
        ', loans_member_column);
      ELSE
        -- Use repayments table
        RETURN QUERY EXECUTE format('
          SELECT 
            COUNT(DISTINCT m.id)::BIGINT as total_customers,
            COUNT(l.id)::BIGINT as total_loans,
            COALESCE(SUM(l.principal_amount), 0) as total_disbursed,
            COALESCE(SUM(r.amount), 0) as total_repaid,
            COALESCE(SUM(l.principal_amount) - COALESCE(SUM(r.amount), 0), 0) as outstanding_balance,
            COUNT(CASE WHEN l.status = ''active'' THEN 1 END)::BIGINT as active_loans,
            COUNT(CASE WHEN l.status = ''pending'' THEN 1 END)::BIGINT as pending_loans,
            COUNT(CASE WHEN l.status = ''defaulted'' THEN 1 END)::BIGINT as defaulted_loans,
            COUNT(CASE WHEN l.status IN (''repaid'', ''completed'') THEN 1 END)::BIGINT as repaid_loans
          FROM members m
          LEFT JOIN loans l ON m.id = l.%I
          LEFT JOIN repayments r ON l.id = r.loan_id
        ', loans_member_column);
      END IF;
    ELSIF has_customers_table AND loans_member_column = 'customer_id' THEN
      -- Use customers table with customer_id
      IF payments_table_name = 'payments' THEN
        RETURN QUERY EXECUTE '
          SELECT 
            COUNT(DISTINCT c.id)::BIGINT as total_customers,
            COUNT(l.id)::BIGINT as total_loans,
            COALESCE(SUM(l.principal_amount), 0) as total_disbursed,
            COALESCE(SUM(p.amount), 0) as total_repaid,
            COALESCE(SUM(l.principal_amount) - COALESCE(SUM(p.amount), 0), 0) as outstanding_balance,
            COUNT(CASE WHEN l.status = ''active'' THEN 1 END)::BIGINT as active_loans,
            COUNT(CASE WHEN l.status = ''pending'' THEN 1 END)::BIGINT as pending_loans,
            COUNT(CASE WHEN l.status = ''defaulted'' THEN 1 END)::BIGINT as defaulted_loans,
            COUNT(CASE WHEN l.status IN (''repaid'', ''completed'') THEN 1 END)::BIGINT as repaid_loans
          FROM customers c
          LEFT JOIN loans l ON c.id = l.customer_id
          LEFT JOIN payments p ON l.id = p.loan_id
        ';
      ELSE
        -- Use repayments table
        RETURN QUERY EXECUTE '
          SELECT 
            COUNT(DISTINCT c.id)::BIGINT as total_customers,
            COUNT(l.id)::BIGINT as total_loans,
            COALESCE(SUM(l.principal_amount), 0) as total_disbursed,
            COALESCE(SUM(r.amount), 0) as total_repaid,
            COALESCE(SUM(l.principal_amount) - COALESCE(SUM(r.amount), 0), 0) as outstanding_balance,
            COUNT(CASE WHEN l.status = ''active'' THEN 1 END)::BIGINT as active_loans,
            COUNT(CASE WHEN l.status = ''pending'' THEN 1 END)::BIGINT as pending_loans,
            COUNT(CASE WHEN l.status = ''defaulted'' THEN 1 END)::BIGINT as defaulted_loans,
            COUNT(CASE WHEN l.status IN (''repaid'', ''completed'') THEN 1 END)::BIGINT as repaid_loans
          FROM customers c
          LEFT JOIN loans l ON c.id = l.customer_id
          LEFT JOIN repayments r ON l.id = r.loan_id
        ';
      END IF;
    ELSE
      -- Fallback: just count loans
      RETURN QUERY EXECUTE '
        SELECT 
          0::BIGINT as total_customers,
          COUNT(l.id)::BIGINT as total_loans,
          COALESCE(SUM(l.principal_amount), 0) as total_disbursed,
          0::NUMERIC as total_repaid,
          COALESCE(SUM(l.principal_amount), 0) as outstanding_balance,
          COUNT(CASE WHEN l.status = ''active'' THEN 1 END)::BIGINT as active_loans,
          COUNT(CASE WHEN l.status = ''pending'' THEN 1 END)::BIGINT as pending_loans,
          COUNT(CASE WHEN l.status = ''defaulted'' THEN 1 END)::BIGINT as defaulted_loans,
          COUNT(CASE WHEN l.status = ''repaid'' OR l.status = ''completed'' THEN 1 END)::BIGINT as repaid_loans
        FROM loans l
      ';
    END IF;
  
  -- For other roles, return simplified stats for now
  ELSE
    RETURN QUERY
    SELECT 
      0::BIGINT as total_customers,
      0::BIGINT as total_loans,
      0::NUMERIC as total_disbursed,
      0::NUMERIC as total_repaid,
      0::NUMERIC as outstanding_balance,
      0::BIGINT as active_loans,
      0::BIGINT as pending_loans,
      0::BIGINT as defaulted_loans,
      0::BIGINT as repaid_loans;
  END IF;
END;
$$;

-- Function to get recent loans based on user role (robust version)
CREATE OR REPLACE FUNCTION get_recent_loans_for_user(requesting_user_id UUID)
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
  has_members_table BOOLEAN;
  has_customers_table BOOLEAN;
  loans_member_column TEXT;
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

  -- Check which tables exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'members'
  ) INTO has_members_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'customers'
  ) INTO has_customers_table;

  -- Determine the correct column name for loans table
  SELECT 
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'member_id'
      ) THEN 'member_id'
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'customer_id'
      ) THEN 'customer_id'
      ELSE NULL
    END INTO loans_member_column;

  -- Super admin sees system-wide recent loans
  IF user_role = 'super_admin' THEN
    IF has_members_table AND loans_member_column = 'member_id' THEN
      -- Use members table with member_id
      RETURN QUERY EXECUTE format('
        SELECT 
          l.id,
          l.principal_amount,
          l.status,
          COALESCE(m.first_name || '' '' || m.last_name, m.first_name, ''Unknown'') as member_name,
          m.id as member_id
        FROM loans l
        JOIN members m ON l.%I = m.id
        ORDER BY l.created_at DESC
        LIMIT 5
      ', loans_member_column);
    ELSIF has_customers_table AND loans_member_column = 'customer_id' THEN
      -- Use customers table with customer_id
      RETURN QUERY EXECUTE '
        SELECT 
          l.id,
          l.principal_amount,
          l.status,
          c.full_name as member_name,
          c.id as member_id
        FROM loans l
        JOIN customers c ON l.customer_id = c.id
        ORDER BY l.created_at DESC
        LIMIT 5
      ';
    ELSE
      -- Fallback: just return loans without member info
      RETURN QUERY EXECUTE '
        SELECT 
          l.id,
          l.principal_amount,
          l.status,
          ''Unknown''::TEXT as member_name,
          l.id as member_id
        FROM loans l
        ORDER BY l.created_at DESC
        LIMIT 5
      ';
    END IF;
  
  -- For other roles, return empty for now
  ELSE
    RETURN;
  END IF;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_dashboard_stats_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_loans_for_user(UUID) TO authenticated;
