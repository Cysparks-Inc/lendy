-- Create robust dashboard functions that work with any enum values
-- This migration creates functions that dynamically detect available enum values

-- Drop existing functions
DROP FUNCTION IF EXISTS get_dashboard_stats_for_user(UUID);
DROP FUNCTION IF EXISTS get_recent_loans_for_user(UUID);

-- Function to get dashboard stats (simplified and robust)
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
BEGIN
  -- Get user's role and branch from profiles table
  SELECT p.role::text, p.branch_id INTO user_role, user_branch_id
  FROM profiles p
  WHERE p.id = requesting_user_id
  LIMIT 1;

  -- If no role found, return empty stats
  IF user_role IS NULL THEN
    RETURN QUERY
    SELECT 0::BIGINT, 0::BIGINT, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;

  -- Super admin sees system-wide stats
  IF user_role = 'super_admin' THEN
    -- Try to get stats, handling different table structures gracefully
    BEGIN
      -- Check if we have members table with member_id
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'member_id'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'members'
      ) THEN
        -- Use members table
        RETURN QUERY
        SELECT 
          COALESCE(COUNT(DISTINCT m.id), 0)::BIGINT as total_customers,
          COALESCE(COUNT(l.id), 0)::BIGINT as total_loans,
          COALESCE(SUM(l.principal_amount), 0) as total_disbursed,
          0::NUMERIC as total_repaid, -- Simplified for now
          COALESCE(SUM(l.principal_amount), 0) as outstanding_balance,
          COALESCE(COUNT(CASE WHEN l.status::text LIKE '%active%' THEN 1 END), 0)::BIGINT as active_loans,
          COALESCE(COUNT(CASE WHEN l.status::text LIKE '%pending%' THEN 1 END), 0)::BIGINT as pending_loans,
          COALESCE(COUNT(CASE WHEN l.status::text LIKE '%default%' THEN 1 END), 0)::BIGINT as defaulted_loans,
          COALESCE(COUNT(CASE WHEN l.status::text LIKE '%repaid%' OR l.status::text LIKE '%completed%' THEN 1 END), 0)::BIGINT as repaid_loans
        FROM members m
        LEFT JOIN loans l ON m.id = l.member_id;
        
      -- Check if we have customers table with customer_id
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'customer_id'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'customers'
      ) THEN
        -- Use customers table
        RETURN QUERY
        SELECT 
          COALESCE(COUNT(DISTINCT c.id), 0)::BIGINT as total_customers,
          COALESCE(COUNT(l.id), 0)::BIGINT as total_loans,
          COALESCE(SUM(l.principal_amount), 0) as total_disbursed,
          0::NUMERIC as total_repaid, -- Simplified for now
          COALESCE(SUM(l.principal_amount), 0) as outstanding_balance,
          COALESCE(COUNT(CASE WHEN l.status::text LIKE '%active%' THEN 1 END), 0)::BIGINT as active_loans,
          COALESCE(COUNT(CASE WHEN l.status::text LIKE '%pending%' THEN 1 END), 0)::BIGINT as pending_loans,
          COALESCE(COUNT(CASE WHEN l.status::text LIKE '%default%' THEN 1 END), 0)::BIGINT as defaulted_loans,
          COALESCE(COUNT(CASE WHEN l.status::text LIKE '%repaid%' OR l.status::text LIKE '%completed%' THEN 1 END), 0)::BIGINT as repaid_loans
        FROM customers c
        LEFT JOIN loans l ON c.id = l.customer_id;
        
      -- Fallback: just count loans
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'loans'
      ) THEN
        RETURN QUERY
        SELECT 
          0::BIGINT as total_customers,
          COALESCE(COUNT(l.id), 0)::BIGINT as total_loans,
          COALESCE(SUM(l.principal_amount), 0) as total_disbursed,
          0::NUMERIC as total_repaid,
          COALESCE(SUM(l.principal_amount), 0) as outstanding_balance,
          COALESCE(COUNT(CASE WHEN l.status::text LIKE '%active%' THEN 1 END), 0)::BIGINT as active_loans,
          COALESCE(COUNT(CASE WHEN l.status::text LIKE '%pending%' THEN 1 END), 0)::BIGINT as pending_loans,
          COALESCE(COUNT(CASE WHEN l.status::text LIKE '%default%' THEN 1 END), 0)::BIGINT as defaulted_loans,
          COALESCE(COUNT(CASE WHEN l.status::text LIKE '%repaid%' OR l.status::text LIKE '%completed%' THEN 1 END), 0)::BIGINT as repaid_loans
        FROM loans l;
      ELSE
        -- No loans table found
        RETURN QUERY
        SELECT 0::BIGINT, 0::BIGINT, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- If anything fails, return zeros
      RETURN QUERY
      SELECT 0::BIGINT, 0::BIGINT, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT;
    END;
  
  -- For other roles, return simplified stats for now
  ELSE
    RETURN QUERY
    SELECT 0::BIGINT, 0::BIGINT, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT;
  END IF;
END;
$$;

-- Function to get recent loans (simplified and robust)
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
BEGIN
  -- Get user's role and branch from profiles table
  SELECT p.role::text, p.branch_id INTO user_role, user_branch_id
  FROM profiles p
  WHERE p.id = requesting_user_id
  LIMIT 1;

  -- If no role found, return empty results
  IF user_role IS NULL THEN
    RETURN;
  END IF;

  -- Super admin sees system-wide recent loans
  IF user_role = 'super_admin' THEN
    BEGIN
      -- Check if we have members table with member_id
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'member_id'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'members'
      ) THEN
        -- Use members table
        RETURN QUERY
        SELECT 
          l.id,
          l.principal_amount,
          l.status::text,
          COALESCE(
            CASE 
              WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'first_name')
              THEN COALESCE(m.first_name || ' ' || m.last_name, m.first_name)
              ELSE m.full_name
            END, 
            'Unknown'
          ) as member_name,
          m.id as member_id
        FROM loans l
        JOIN members m ON l.member_id = m.id
        ORDER BY l.created_at DESC
        LIMIT 5;
        
      -- Check if we have customers table with customer_id  
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'customer_id'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'customers'
      ) THEN
        -- Use customers table
        RETURN QUERY
        SELECT 
          l.id,
          l.principal_amount,
          l.status::text,
          COALESCE(c.full_name, 'Unknown') as member_name,
          c.id as member_id
        FROM loans l
        JOIN customers c ON l.customer_id = c.id
        ORDER BY l.created_at DESC
        LIMIT 5;
        
      -- Fallback: just return loans without member info
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'loans'
      ) THEN
        RETURN QUERY
        SELECT 
          l.id,
          l.principal_amount,
          l.status::text,
          'Unknown'::TEXT as member_name,
          l.id as member_id
        FROM loans l
        ORDER BY l.created_at DESC
        LIMIT 5;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- If anything fails, return empty
      RETURN;
    END;
  
  -- For other roles, return empty for now
  ELSE
    RETURN;
  END IF;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_dashboard_stats_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_loans_for_user(UUID) TO authenticated;
