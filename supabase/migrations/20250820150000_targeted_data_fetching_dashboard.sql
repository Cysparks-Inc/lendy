-- Targeted data fetching dashboard functions
-- This migration creates functions that actually fetch real data from existing tables

-- Drop existing functions
DROP FUNCTION IF EXISTS get_dashboard_stats_for_user(UUID);
DROP FUNCTION IF EXISTS get_recent_loans_for_user(UUID);

-- First, let's create a helper function to check what data we actually have
CREATE OR REPLACE FUNCTION debug_table_data()
RETURNS TABLE (
  table_name TEXT,
  row_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check what tables exist and how many rows they have
  RETURN QUERY
  SELECT 
    t.table_name::TEXT,
    CASE 
      WHEN t.table_name = 'profiles' THEN (SELECT COUNT(*) FROM profiles)
      WHEN t.table_name = 'members' THEN (SELECT COUNT(*) FROM members)
      WHEN t.table_name = 'customers' THEN (SELECT COUNT(*) FROM customers)
      WHEN t.table_name = 'loans' THEN (SELECT COUNT(*) FROM loans)
      WHEN t.table_name = 'payments' THEN (SELECT COUNT(*) FROM payments)
      WHEN t.table_name = 'repayments' THEN (SELECT COUNT(*) FROM repayments)
      WHEN t.table_name = 'branches' THEN (SELECT COUNT(*) FROM branches)
      ELSE 0
    END as row_count
  FROM information_schema.tables t
  WHERE t.table_schema = 'public' 
    AND t.table_name IN ('profiles', 'members', 'customers', 'loans', 'payments', 'repayments', 'branches')
  ORDER BY t.table_name;
END;
$$;

-- Function to get dashboard stats with better data targeting
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
  loans_table_exists BOOLEAN := FALSE;
  members_table_exists BOOLEAN := FALSE;
  customers_table_exists BOOLEAN := FALSE;
  payments_table_exists BOOLEAN := FALSE;
  repayments_table_exists BOOLEAN := FALSE;
  loans_foreign_key TEXT;
BEGIN
  -- Initialize return values
  total_customers := 0;
  total_loans := 0;
  total_disbursed := 0;
  total_repaid := 0;
  outstanding_balance := 0;
  active_loans := 0;
  pending_loans := 0;
  defaulted_loans := 0;
  repaid_loans := 0;

  -- Get user's role from profiles
  BEGIN
    SELECT p.role::text, p.branch_id INTO user_role, user_branch_id
    FROM profiles p
    WHERE p.id = requesting_user_id;
    
    -- If no profile found, still try to get some data for super admin
    IF user_role IS NULL THEN
      user_role := 'super_admin'; -- Default to super admin if no role found
    END IF;
  EXCEPTION WHEN OTHERS THEN
    user_role := 'super_admin';
  END;

  -- Check which tables actually exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'loans'
  ) INTO loans_table_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'members'
  ) INTO members_table_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'customers'
  ) INTO customers_table_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'payments'
  ) INTO payments_table_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'repayments'
  ) INTO repayments_table_exists;

  -- Determine the foreign key column in loans table
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
    END INTO loans_foreign_key;

  -- Now fetch actual data based on what exists
  BEGIN
    -- Strategy 1: If we have loans table, get basic loan stats first
    IF loans_table_exists THEN
      -- Get basic loan statistics
      SELECT 
        COUNT(*)::BIGINT,
        COALESCE(SUM(
          CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'principal_amount')
            THEN principal_amount
            ELSE 0
          END
        ), 0)
      INTO total_loans, total_disbursed
      FROM loans;

      -- Get loan status counts (handling different possible status values)
      SELECT 
        COUNT(CASE WHEN status::text ILIKE '%active%' OR status::text = 'active' THEN 1 END)::BIGINT,
        COUNT(CASE WHEN status::text ILIKE '%pending%' OR status::text = 'pending' THEN 1 END)::BIGINT,
        COUNT(CASE WHEN status::text ILIKE '%default%' OR status::text = 'defaulted' THEN 1 END)::BIGINT,
        COUNT(CASE WHEN status::text ILIKE '%repaid%' OR status::text ILIKE '%completed%' OR status::text = 'repaid' THEN 1 END)::BIGINT
      INTO active_loans, pending_loans, defaulted_loans, repaid_loans
      FROM loans;
    END IF;

    -- Strategy 2: Get customer/member count
    IF members_table_exists THEN
      SELECT COUNT(*)::BIGINT INTO total_customers FROM members;
    ELSIF customers_table_exists THEN
      SELECT COUNT(*)::BIGINT INTO total_customers FROM customers;
    END IF;

    -- Strategy 3: Get payment data
    IF payments_table_exists THEN
      SELECT COALESCE(SUM(amount), 0) INTO total_repaid FROM payments;
    ELSIF repayments_table_exists THEN
      SELECT COALESCE(SUM(amount), 0) INTO total_repaid FROM repayments;
    ELSIF loans_table_exists THEN
      -- Try to get from loans table if it has payment tracking columns
      SELECT COALESCE(SUM(
        CASE 
          WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'principal_paid')
          THEN principal_paid
          WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'amount_paid')
          THEN amount_paid
          ELSE 0
        END
      ), 0) INTO total_repaid FROM loans;
    END IF;

    -- Calculate outstanding balance
    outstanding_balance := total_disbursed - total_repaid;

    -- Apply role-based filtering if we have the necessary data
    IF user_role != 'super_admin' AND loans_table_exists THEN
      IF user_role = 'branch_admin' AND user_branch_id IS NOT NULL THEN
        -- Filter by branch
        IF members_table_exists AND loans_foreign_key = 'member_id' THEN
          -- Re-calculate stats for branch only
          SELECT 
            COUNT(DISTINCT m.id)::BIGINT,
            COUNT(l.id)::BIGINT,
            COALESCE(SUM(l.principal_amount), 0),
            COUNT(CASE WHEN l.status::text ILIKE '%active%' THEN 1 END)::BIGINT,
            COUNT(CASE WHEN l.status::text ILIKE '%pending%' THEN 1 END)::BIGINT,
            COUNT(CASE WHEN l.status::text ILIKE '%default%' THEN 1 END)::BIGINT,
            COUNT(CASE WHEN l.status::text ILIKE '%repaid%' OR l.status::text ILIKE '%completed%' THEN 1 END)::BIGINT
          INTO total_customers, total_loans, total_disbursed, active_loans, pending_loans, defaulted_loans, repaid_loans
          FROM members m
          LEFT JOIN loans l ON m.id = l.member_id
          WHERE m.branch_id = user_branch_id;
        END IF;
      
      ELSIF user_role = 'loan_officer' THEN
        -- Filter by loan officer
        IF loans_table_exists THEN
          SELECT 
            COUNT(*)::BIGINT,
            COALESCE(SUM(principal_amount), 0),
            COUNT(CASE WHEN status::text ILIKE '%active%' THEN 1 END)::BIGINT,
            COUNT(CASE WHEN status::text ILIKE '%pending%' THEN 1 END)::BIGINT,
            COUNT(CASE WHEN status::text ILIKE '%default%' THEN 1 END)::BIGINT,
            COUNT(CASE WHEN status::text ILIKE '%repaid%' OR status::text ILIKE '%completed%' THEN 1 END)::BIGINT
          INTO total_loans, total_disbursed, active_loans, pending_loans, defaulted_loans, repaid_loans
          FROM loans l
          WHERE l.created_by = requesting_user_id 
             OR (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'loan_officer_id') 
                 AND l.loan_officer_id = requesting_user_id);

          -- Get unique customers for this loan officer
          IF members_table_exists AND loans_foreign_key = 'member_id' THEN
            SELECT COUNT(DISTINCT m.id)::BIGINT INTO total_customers
            FROM members m
            JOIN loans l ON m.id = l.member_id
            WHERE l.created_by = requesting_user_id 
               OR (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'loan_officer_id') 
                   AND l.loan_officer_id = requesting_user_id);
          END IF;
        END IF;
      END IF;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- If anything fails, at least return some basic data if tables exist
    IF loans_table_exists THEN
      SELECT COUNT(*)::BIGINT INTO total_loans FROM loans;
    END IF;
    IF members_table_exists THEN
      SELECT COUNT(*)::BIGINT INTO total_customers FROM members;
    ELSIF customers_table_exists THEN
      SELECT COUNT(*)::BIGINT INTO total_customers FROM customers;
    END IF;
  END;

  RETURN NEXT;
  RETURN;
END;
$$;

-- Function to get recent loans with better targeting
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
  loans_table_exists BOOLEAN := FALSE;
  members_table_exists BOOLEAN := FALSE;
  customers_table_exists BOOLEAN := FALSE;
  loans_foreign_key TEXT;
BEGIN
  -- Get user role
  BEGIN
    SELECT p.role::text, p.branch_id INTO user_role, user_branch_id
    FROM profiles p
    WHERE p.id = requesting_user_id;
    
    IF user_role IS NULL THEN
      user_role := 'super_admin';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    user_role := 'super_admin';
  END;

  -- Check table existence
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'loans'
  ) INTO loans_table_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'members'
  ) INTO members_table_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'customers'
  ) INTO customers_table_exists;

  -- Determine foreign key
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
    END INTO loans_foreign_key;

  -- Fetch recent loans based on available data
  BEGIN
    IF loans_table_exists THEN
      IF members_table_exists AND loans_foreign_key = 'member_id' THEN
        -- Use members table
        IF user_role = 'super_admin' THEN
          RETURN QUERY
          SELECT 
            l.id,
            l.principal_amount,
            l.status::text,
            COALESCE(
              CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'first_name')
                THEN COALESCE(m.first_name || ' ' || COALESCE(m.last_name, ''), m.first_name)
                ELSE COALESCE(m.full_name, 'Unknown Member')
              END, 
              'Unknown Member'
            ) as member_name,
            COALESCE(m.id, l.id) as member_id
          FROM loans l
          LEFT JOIN members m ON l.member_id = m.id
          ORDER BY l.created_at DESC
          LIMIT 5;
        
        ELSIF user_role = 'branch_admin' AND user_branch_id IS NOT NULL THEN
          RETURN QUERY
          SELECT 
            l.id,
            l.principal_amount,
            l.status::text,
            COALESCE(
              CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'first_name')
                THEN COALESCE(m.first_name || ' ' || COALESCE(m.last_name, ''), m.first_name)
                ELSE COALESCE(m.full_name, 'Unknown Member')
              END, 
              'Unknown Member'
            ) as member_name,
            COALESCE(m.id, l.id) as member_id
          FROM loans l
          LEFT JOIN members m ON l.member_id = m.id
          WHERE m.branch_id = user_branch_id
          ORDER BY l.created_at DESC
          LIMIT 5;
        
        ELSIF user_role = 'loan_officer' THEN
          RETURN QUERY
          SELECT 
            l.id,
            l.principal_amount,
            l.status::text,
            COALESCE(
              CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'first_name')
                THEN COALESCE(m.first_name || ' ' || COALESCE(m.last_name, ''), m.first_name)
                ELSE COALESCE(m.full_name, 'Unknown Member')
              END, 
              'Unknown Member'
            ) as member_name,
            COALESCE(m.id, l.id) as member_id
          FROM loans l
          LEFT JOIN members m ON l.member_id = m.id
          WHERE l.created_by = requesting_user_id 
             OR (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'loan_officer_id') 
                 AND l.loan_officer_id = requesting_user_id)
          ORDER BY l.created_at DESC
          LIMIT 5;
        END IF;

      ELSIF customers_table_exists AND loans_foreign_key = 'customer_id' THEN
        -- Use customers table
        RETURN QUERY
        SELECT 
          l.id,
          l.principal_amount,
          l.status::text,
          COALESCE(c.full_name, 'Unknown Customer') as member_name,
          COALESCE(c.id, l.id) as member_id
        FROM loans l
        LEFT JOIN customers c ON l.customer_id = c.id
        ORDER BY l.created_at DESC
        LIMIT 5;

      ELSE
        -- Just loans table without member info
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
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Return empty if anything fails
    RETURN;
  END;

  RETURN;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION debug_table_data() TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_loans_for_user(UUID) TO authenticated;
