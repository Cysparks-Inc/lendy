-- Fix debug function to safely query only existing tables
-- This migration fixes the debug function to avoid querying non-existent tables

-- Drop the problematic debug function
DROP FUNCTION IF EXISTS debug_table_data();

-- Create a safer debug function that only queries existing tables
CREATE OR REPLACE FUNCTION debug_table_data()
RETURNS TABLE (
  table_name TEXT,
  exists_flag BOOLEAN,
  row_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  table_record RECORD;
  current_count BIGINT;
BEGIN
  -- Check each table individually and only query if it exists
  FOR table_record IN 
    SELECT t.table_name::TEXT as tname
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' 
      AND t.table_name IN ('profiles', 'members', 'customers', 'loans', 'payments', 'repayments', 'branches')
    ORDER BY t.table_name
  LOOP
    BEGIN
      -- Try to get count for existing table
      EXECUTE format('SELECT COUNT(*) FROM %I', table_record.tname) INTO current_count;
      
      -- Return the result
      table_name := table_record.tname;
      exists_flag := TRUE;
      row_count := current_count;
      RETURN NEXT;
      
    EXCEPTION WHEN OTHERS THEN
      -- If query fails, mark as existing but with error
      table_name := table_record.tname;
      exists_flag := TRUE;
      row_count := -1; -- -1 indicates error
      RETURN NEXT;
    END;
  END LOOP;
  
  -- Also check for tables that should exist but don't
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    table_name := 'profiles';
    exists_flag := FALSE;
    row_count := 0;
    RETURN NEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
    table_name := 'loans';
    exists_flag := FALSE;
    row_count := 0;
    RETURN NEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members') THEN
    table_name := 'members';
    exists_flag := FALSE;
    row_count := 0;
    RETURN NEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'branches') THEN
    table_name := 'branches';
    exists_flag := FALSE;
    row_count := 0;
    RETURN NEXT;
  END IF;

  RETURN;
END;
$$;

-- Also fix the main dashboard functions to be more defensive
DROP FUNCTION IF EXISTS get_dashboard_stats_for_user(UUID);

-- Recreate the dashboard stats function with better error handling
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
  user_role TEXT := 'super_admin';
  user_branch_id UUID;
BEGIN
  -- Initialize all return values
  total_customers := 0;
  total_loans := 0;
  total_disbursed := 0;
  total_repaid := 0;
  outstanding_balance := 0;
  active_loans := 0;
  pending_loans := 0;
  defaulted_loans := 0;
  repaid_loans := 0;

  -- Safely get user role
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
      SELECT COALESCE(p.role::text, 'super_admin'), p.branch_id 
      INTO user_role, user_branch_id
      FROM profiles p
      WHERE p.id = requesting_user_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    user_role := 'super_admin';
  END;

  -- Get loans data if loans table exists
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
      -- Basic loan stats
      SELECT 
        COUNT(*)::BIGINT,
        COALESCE(SUM(
          CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'principal_amount')
            THEN principal_amount
            ELSE 0
          END
        ), 0)
      INTO total_loans, total_disbursed
      FROM loans;

      -- Loan status counts
      SELECT 
        COUNT(CASE WHEN status::text IN ('active', 'disbursed') OR status::text ILIKE '%active%' THEN 1 END)::BIGINT,
        COUNT(CASE WHEN status::text = 'pending' OR status::text ILIKE '%pending%' THEN 1 END)::BIGINT,
        COUNT(CASE WHEN status::text = 'defaulted' OR status::text ILIKE '%default%' THEN 1 END)::BIGINT,
        COUNT(CASE WHEN status::text IN ('repaid', 'completed') OR status::text ILIKE '%repaid%' OR status::text ILIKE '%completed%' THEN 1 END)::BIGINT
      INTO active_loans, pending_loans, defaulted_loans, repaid_loans
      FROM loans;

      -- Try to get repayment data from loans table itself
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'principal_paid') THEN
        SELECT COALESCE(SUM(principal_paid), 0) INTO total_repaid FROM loans;
      ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'amount_paid') THEN
        SELECT COALESCE(SUM(amount_paid), 0) INTO total_repaid FROM loans;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Keep defaults
    NULL;
  END;

  -- Get customer/member count
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members') THEN
      SELECT COUNT(*)::BIGINT INTO total_customers FROM members;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
      SELECT COUNT(*)::BIGINT INTO total_customers FROM customers;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    total_customers := 0;
  END;

  -- Try to get payment data from dedicated payment tables
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
      SELECT COALESCE(SUM(amount), 0) INTO total_repaid FROM payments;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'repayments') THEN
      SELECT COALESCE(SUM(amount), 0) INTO total_repaid FROM repayments;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Keep existing total_repaid value
    NULL;
  END;

  -- Calculate outstanding
  outstanding_balance := GREATEST(total_disbursed - total_repaid, 0);

  -- Apply role-based filtering for non-super admins
  IF user_role != 'super_admin' THEN
    BEGIN
      IF user_role = 'branch_admin' AND user_branch_id IS NOT NULL THEN
        -- Branch admin filtering
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members') 
           AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans')
           AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'member_id') THEN
          
          SELECT 
            COUNT(DISTINCT m.id)::BIGINT,
            COUNT(l.id)::BIGINT,
            COALESCE(SUM(l.principal_amount), 0),
            COUNT(CASE WHEN l.status::text IN ('active', 'disbursed') OR l.status::text ILIKE '%active%' THEN 1 END)::BIGINT,
            COUNT(CASE WHEN l.status::text = 'pending' OR l.status::text ILIKE '%pending%' THEN 1 END)::BIGINT,
            COUNT(CASE WHEN l.status::text = 'defaulted' OR l.status::text ILIKE '%default%' THEN 1 END)::BIGINT,
            COUNT(CASE WHEN l.status::text IN ('repaid', 'completed') OR l.status::text ILIKE '%repaid%' OR l.status::text ILIKE '%completed%' THEN 1 END)::BIGINT
          INTO total_customers, total_loans, total_disbursed, active_loans, pending_loans, defaulted_loans, repaid_loans
          FROM members m
          LEFT JOIN loans l ON m.id = l.member_id
          WHERE m.branch_id = user_branch_id;
          
          outstanding_balance := GREATEST(total_disbursed - total_repaid, 0);
        END IF;
        
      ELSIF user_role = 'loan_officer' THEN
        -- Loan officer filtering
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
          SELECT 
            COUNT(*)::BIGINT,
            COALESCE(SUM(principal_amount), 0),
            COUNT(CASE WHEN status::text IN ('active', 'disbursed') OR status::text ILIKE '%active%' THEN 1 END)::BIGINT,
            COUNT(CASE WHEN status::text = 'pending' OR status::text ILIKE '%pending%' THEN 1 END)::BIGINT,
            COUNT(CASE WHEN status::text = 'defaulted' OR status::text ILIKE '%default%' THEN 1 END)::BIGINT,
            COUNT(CASE WHEN status::text IN ('repaid', 'completed') OR status::text ILIKE '%repaid%' OR status::text ILIKE '%completed%' THEN 1 END)::BIGINT
          INTO total_loans, total_disbursed, active_loans, pending_loans, defaulted_loans, repaid_loans
          FROM loans l
          WHERE l.created_by = requesting_user_id 
             OR (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'loan_officer_id') 
                 AND l.loan_officer_id = requesting_user_id);
          
          -- Get unique members for this loan officer
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members')
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'member_id') THEN
            SELECT COUNT(DISTINCT m.id)::BIGINT INTO total_customers
            FROM members m
            JOIN loans l ON m.id = l.member_id
            WHERE l.created_by = requesting_user_id 
               OR (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'loan_officer_id') 
                   AND l.loan_officer_id = requesting_user_id);
          END IF;
          
          outstanding_balance := GREATEST(total_disbursed - total_repaid, 0);
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Keep system-wide stats if filtering fails
      NULL;
    END;
  END IF;

  RETURN NEXT;
  RETURN;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION debug_table_data() TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats_for_user(UUID) TO authenticated;
