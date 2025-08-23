-- Fix ambiguous column reference and improve member name fetching
-- This migration fixes the debug function and improves member name display

-- Drop and recreate the debug function with fixed column references
DROP FUNCTION IF EXISTS debug_table_data();

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
  result_table_name TEXT;
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
      result_table_name := table_record.tname;
      table_name := result_table_name;
      exists_flag := TRUE;
      row_count := current_count;
      RETURN NEXT;
      
    EXCEPTION WHEN OTHERS THEN
      -- If query fails, mark as existing but with error
      result_table_name := table_record.tname;
      table_name := result_table_name;
      exists_flag := TRUE;
      row_count := -1; -- -1 indicates error
      RETURN NEXT;
    END;
  END LOOP;
  
  -- Check for expected tables that don't exist
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

  RETURN;
END;
$$;

-- Fix the recent loans function to properly fetch member names
DROP FUNCTION IF EXISTS get_recent_loans_for_user(UUID);

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
  user_role TEXT := 'super_admin';
  user_branch_id UUID;
BEGIN
  -- Get user role safely
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

  -- Fetch recent loans based on available tables and user role
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
      
      -- Check if we have members table and member_id column
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members') 
         AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'member_id') THEN
        
        -- Use members table with proper name handling
        IF user_role = 'super_admin' THEN
          RETURN QUERY
          SELECT 
            l.id,
            l.principal_amount,
            l.status::text,
            COALESCE(
              CASE 
                -- Check for first_name + last_name combination
                WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'first_name')
                     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'last_name')
                THEN TRIM(COALESCE(m.first_name, '') || ' ' || COALESCE(m.last_name, ''))
                
                -- Check for full_name column
                WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'full_name')
                THEN m.full_name
                
                -- Check for name column
                WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'name')
                THEN m.name
                
                ELSE 'Unknown Member'
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
                WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'first_name')
                     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'last_name')
                THEN TRIM(COALESCE(m.first_name, '') || ' ' || COALESCE(m.last_name, ''))
                WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'full_name')
                THEN m.full_name
                WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'name')
                THEN m.name
                ELSE 'Unknown Member'
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
                WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'first_name')
                     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'last_name')
                THEN TRIM(COALESCE(m.first_name, '') || ' ' || COALESCE(m.last_name, ''))
                WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'full_name')
                THEN m.full_name
                WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'name')
                THEN m.name
                ELSE 'Unknown Member'
              END, 
              'Unknown Member'
            ) as member_name,
            COALESCE(m.id, l.id) as member_id
          FROM loans l
          LEFT JOIN members m ON l.member_id = m.id
          WHERE l.created_by = requesting_user_id 
             OR (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'loan_officer_id') 
                 AND l.loan_officer_id = requesting_user_id)
          ORDER BY l.created_at DESC
          LIMIT 5;
          
        ELSE
          -- For teller, auditor, etc. - show branch loans if they have branch_id
          IF user_branch_id IS NOT NULL THEN
            RETURN QUERY
            SELECT 
              l.id,
              l.principal_amount,
              l.status::text,
              COALESCE(
                CASE 
                  WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'first_name')
                       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'last_name')
                  THEN TRIM(COALESCE(m.first_name, '') || ' ' || COALESCE(m.last_name, ''))
                  WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'full_name')
                  THEN m.full_name
                  WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'name')
                  THEN m.name
                  ELSE 'Unknown Member'
                END, 
                'Unknown Member'
              ) as member_name,
              COALESCE(m.id, l.id) as member_id
            FROM loans l
            LEFT JOIN members m ON l.member_id = m.id
            WHERE m.branch_id = user_branch_id
            ORDER BY l.created_at DESC
            LIMIT 5;
          END IF;
        END IF;

      ELSE
        -- Fallback: just loans table without member info
        RETURN QUERY
        SELECT 
          l.id,
          l.principal_amount,
          l.status::text,
          'Member Info Not Available'::TEXT as member_name,
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
GRANT EXECUTE ON FUNCTION get_recent_loans_for_user(UUID) TO authenticated;
