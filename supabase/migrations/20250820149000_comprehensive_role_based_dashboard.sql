-- Comprehensive role-based dashboard functions
-- This migration creates modern, robust dashboard functions for all user roles

-- Drop existing functions
DROP FUNCTION IF EXISTS get_dashboard_stats_for_user(UUID);
DROP FUNCTION IF EXISTS get_recent_loans_for_user(UUID);

-- Function to get dashboard stats for all user roles
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
  has_members_table BOOLEAN := FALSE;
  has_customers_table BOOLEAN := FALSE;
  loans_member_column TEXT;
BEGIN
  -- Initialize all return values to zero
  total_customers := 0;
  total_loans := 0;
  total_disbursed := 0;
  total_repaid := 0;
  outstanding_balance := 0;
  active_loans := 0;
  pending_loans := 0;
  defaulted_loans := 0;
  repaid_loans := 0;

  -- Get user's role and branch from profiles table
  BEGIN
    SELECT p.role::text, p.branch_id INTO user_role, user_branch_id
    FROM profiles p
    WHERE p.id = requesting_user_id
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEXT;
    RETURN;
  END;

  -- If no role found, return zeros
  IF user_role IS NULL THEN
    RETURN NEXT;
    RETURN;
  END IF;

  -- Check table structure
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

  -- Role-based data filtering
  IF user_role = 'super_admin' THEN
    -- Super admin sees system-wide stats
    BEGIN
      IF has_members_table AND loans_member_column = 'member_id' THEN
        -- Members + loans with member_id
        SELECT 
          COUNT(DISTINCT m.id)::BIGINT,
          COUNT(l.id)::BIGINT,
          COALESCE(SUM(l.principal_amount), 0),
          COALESCE(SUM(CASE WHEN l.principal_paid IS NOT NULL THEN l.principal_paid ELSE 0 END), 0),
          COALESCE(SUM(l.principal_amount) - SUM(CASE WHEN l.principal_paid IS NOT NULL THEN l.principal_paid ELSE 0 END), 0),
          COUNT(CASE WHEN l.status::text ILIKE '%active%' THEN l.id END)::BIGINT,
          COUNT(CASE WHEN l.status::text ILIKE '%pending%' THEN l.id END)::BIGINT,
          COUNT(CASE WHEN l.status::text ILIKE '%default%' THEN l.id END)::BIGINT,
          COUNT(CASE WHEN l.status::text ILIKE '%repaid%' OR l.status::text ILIKE '%completed%' THEN l.id END)::BIGINT
        INTO total_customers, total_loans, total_disbursed, total_repaid, outstanding_balance, 
             active_loans, pending_loans, defaulted_loans, repaid_loans
        FROM members m
        LEFT JOIN loans l ON m.id = l.member_id;
        
      ELSIF has_customers_table AND loans_member_column = 'customer_id' THEN
        -- Customers + loans with customer_id
        SELECT 
          COUNT(DISTINCT c.id)::BIGINT,
          COUNT(l.id)::BIGINT,
          COALESCE(SUM(l.principal_amount), 0),
          0::NUMERIC,
          COALESCE(SUM(l.principal_amount), 0),
          COUNT(CASE WHEN l.status::text ILIKE '%active%' THEN l.id END)::BIGINT,
          COUNT(CASE WHEN l.status::text ILIKE '%pending%' THEN l.id END)::BIGINT,
          COUNT(CASE WHEN l.status::text ILIKE '%default%' THEN l.id END)::BIGINT,
          COUNT(CASE WHEN l.status::text ILIKE '%repaid%' OR l.status::text ILIKE '%completed%' THEN l.id END)::BIGINT
        INTO total_customers, total_loans, total_disbursed, total_repaid, outstanding_balance, 
             active_loans, pending_loans, defaulted_loans, repaid_loans
        FROM customers c
        LEFT JOIN loans l ON c.id = l.customer_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

  ELSIF user_role = 'branch_admin' AND user_branch_id IS NOT NULL THEN
    -- Branch admin sees branch-specific stats
    BEGIN
      IF has_members_table AND loans_member_column = 'member_id' THEN
        SELECT 
          COUNT(DISTINCT m.id)::BIGINT,
          COUNT(l.id)::BIGINT,
          COALESCE(SUM(l.principal_amount), 0),
          COALESCE(SUM(CASE WHEN l.principal_paid IS NOT NULL THEN l.principal_paid ELSE 0 END), 0),
          COALESCE(SUM(l.principal_amount) - SUM(CASE WHEN l.principal_paid IS NOT NULL THEN l.principal_paid ELSE 0 END), 0),
          COUNT(CASE WHEN l.status::text ILIKE '%active%' THEN l.id END)::BIGINT,
          COUNT(CASE WHEN l.status::text ILIKE '%pending%' THEN l.id END)::BIGINT,
          COUNT(CASE WHEN l.status::text ILIKE '%default%' THEN l.id END)::BIGINT,
          COUNT(CASE WHEN l.status::text ILIKE '%repaid%' OR l.status::text ILIKE '%completed%' THEN l.id END)::BIGINT
        INTO total_customers, total_loans, total_disbursed, total_repaid, outstanding_balance, 
             active_loans, pending_loans, defaulted_loans, repaid_loans
        FROM members m
        LEFT JOIN loans l ON m.id = l.member_id
        WHERE m.branch_id = user_branch_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

  ELSIF user_role = 'loan_officer' THEN
    -- Loan officer sees only their own loans
    BEGIN
      IF has_members_table AND loans_member_column = 'member_id' THEN
        SELECT 
          COUNT(DISTINCT m.id)::BIGINT,
          COUNT(l.id)::BIGINT,
          COALESCE(SUM(l.principal_amount), 0),
          COALESCE(SUM(CASE WHEN l.principal_paid IS NOT NULL THEN l.principal_paid ELSE 0 END), 0),
          COALESCE(SUM(l.principal_amount) - SUM(CASE WHEN l.principal_paid IS NOT NULL THEN l.principal_paid ELSE 0 END), 0),
          COUNT(CASE WHEN l.status::text ILIKE '%active%' THEN l.id END)::BIGINT,
          COUNT(CASE WHEN l.status::text ILIKE '%pending%' THEN l.id END)::BIGINT,
          COUNT(CASE WHEN l.status::text ILIKE '%default%' THEN l.id END)::BIGINT,
          COUNT(CASE WHEN l.status::text ILIKE '%repaid%' OR l.status::text ILIKE '%completed%' THEN l.id END)::BIGINT
        INTO total_customers, total_loans, total_disbursed, total_repaid, outstanding_balance, 
             active_loans, pending_loans, defaulted_loans, repaid_loans
        FROM members m
        LEFT JOIN loans l ON m.id = l.member_id AND (l.created_by = requesting_user_id OR l.loan_officer_id = requesting_user_id);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

  ELSIF user_role IN ('teller', 'auditor') AND user_branch_id IS NOT NULL THEN
    -- Teller and auditor see branch-specific stats
    BEGIN
      IF has_members_table AND loans_member_column = 'member_id' THEN
        SELECT 
          COUNT(DISTINCT m.id)::BIGINT,
          COUNT(l.id)::BIGINT,
          COALESCE(SUM(l.principal_amount), 0),
          COALESCE(SUM(CASE WHEN l.principal_paid IS NOT NULL THEN l.principal_paid ELSE 0 END), 0),
          COALESCE(SUM(l.principal_amount) - SUM(CASE WHEN l.principal_paid IS NOT NULL THEN l.principal_paid ELSE 0 END), 0),
          COUNT(CASE WHEN l.status::text ILIKE '%active%' THEN l.id END)::BIGINT,
          COUNT(CASE WHEN l.status::text ILIKE '%pending%' THEN l.id END)::BIGINT,
          COUNT(CASE WHEN l.status::text ILIKE '%default%' THEN l.id END)::BIGINT,
          COUNT(CASE WHEN l.status::text ILIKE '%repaid%' OR l.status::text ILIKE '%completed%' THEN l.id END)::BIGINT
        INTO total_customers, total_loans, total_disbursed, total_repaid, outstanding_balance, 
             active_loans, pending_loans, defaulted_loans, repaid_loans
        FROM members m
        LEFT JOIN loans l ON m.id = l.member_id
        WHERE m.branch_id = user_branch_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEXT;
  RETURN;
END;
$$;

-- Function to get recent loans for all user roles
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
  has_members_table BOOLEAN := FALSE;
  has_customers_table BOOLEAN := FALSE;
  loans_member_column TEXT;
BEGIN
  -- Get user's role and branch from profiles table
  BEGIN
    SELECT p.role::text, p.branch_id INTO user_role, user_branch_id
    FROM profiles p
    WHERE p.id = requesting_user_id
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;

  -- If no role found, return empty
  IF user_role IS NULL THEN
    RETURN;
  END IF;

  -- Check table structure
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

  -- Role-based loan filtering
  BEGIN
    IF user_role = 'super_admin' THEN
      -- Super admin sees all recent loans
      IF has_members_table AND loans_member_column = 'member_id' THEN
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
          m.id as member_id
        FROM loans l
        LEFT JOIN members m ON l.member_id = m.id
        ORDER BY l.created_at DESC
        LIMIT 5;
        
      ELSIF has_customers_table AND loans_member_column = 'customer_id' THEN
        RETURN QUERY
        SELECT 
          l.id,
          l.principal_amount,
          l.status::text,
          COALESCE(c.full_name, 'Unknown Customer') as member_name,
          c.id as member_id
        FROM loans l
        LEFT JOIN customers c ON l.customer_id = c.id
        ORDER BY l.created_at DESC
        LIMIT 5;
      END IF;

    ELSIF user_role = 'branch_admin' AND user_branch_id IS NOT NULL THEN
      -- Branch admin sees branch recent loans
      IF has_members_table AND loans_member_column = 'member_id' THEN
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
          m.id as member_id
        FROM loans l
        LEFT JOIN members m ON l.member_id = m.id
        WHERE m.branch_id = user_branch_id
        ORDER BY l.created_at DESC
        LIMIT 5;
      END IF;

    ELSIF user_role = 'loan_officer' THEN
      -- Loan officer sees only their own loans
      IF has_members_table AND loans_member_column = 'member_id' THEN
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
          m.id as member_id
        FROM loans l
        LEFT JOIN members m ON l.member_id = m.id
        WHERE l.created_by = requesting_user_id OR l.loan_officer_id = requesting_user_id
        ORDER BY l.created_at DESC
        LIMIT 5;
      END IF;

    ELSIF user_role IN ('teller', 'auditor') AND user_branch_id IS NOT NULL THEN
      -- Teller and auditor see branch recent loans
      IF has_members_table AND loans_member_column = 'member_id' THEN
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
          m.id as member_id
        FROM loans l
        LEFT JOIN members m ON l.member_id = m.id
        WHERE m.branch_id = user_branch_id
        ORDER BY l.created_at DESC
        LIMIT 5;
      END IF;
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;

  RETURN;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_dashboard_stats_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_loans_for_user(UUID) TO authenticated;
