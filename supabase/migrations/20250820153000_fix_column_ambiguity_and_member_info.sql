-- Fix ambiguous column reference and member info issues
-- This migration addresses the "table_name" ambiguity and member name fetching problems

-- Drop and recreate the debug function with properly qualified column references
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
  
  -- Check for expected tables that don't exist using qualified column names
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables ist WHERE ist.table_schema = 'public' AND ist.table_name = 'profiles') THEN
    table_name := 'profiles';
    exists_flag := FALSE;
    row_count := 0;
    RETURN NEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables ist WHERE ist.table_schema = 'public' AND ist.table_name = 'loans') THEN
    table_name := 'loans';
    exists_flag := FALSE;
    row_count := 0;
    RETURN NEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables ist WHERE ist.table_schema = 'public' AND ist.table_name = 'members') THEN
    table_name := 'members';
    exists_flag := FALSE;
    row_count := 0;
    RETURN NEXT;
  END IF;

  RETURN;
END;
$$;

-- Fix the recent loans function to properly handle member names with dynamic column detection
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
  has_members_table BOOLEAN := FALSE;
  has_member_id_column BOOLEAN := FALSE;
  has_first_name_column BOOLEAN := FALSE;
  has_last_name_column BOOLEAN := FALSE;
  has_full_name_column BOOLEAN := FALSE;
  has_name_column BOOLEAN := FALSE;
  member_name_sql TEXT;
BEGIN
  -- Get user role safely
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables ist WHERE ist.table_schema = 'public' AND ist.table_name = 'profiles') THEN
      SELECT COALESCE(p.role::text, 'super_admin'), p.branch_id 
      INTO user_role, user_branch_id
      FROM profiles p
      WHERE p.id = requesting_user_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    user_role := 'super_admin';
  END;

  -- Check what tables and columns we have available
  SELECT EXISTS (SELECT 1 FROM information_schema.tables ist WHERE ist.table_schema = 'public' AND ist.table_name = 'members') 
  INTO has_members_table;
  
  SELECT EXISTS (SELECT 1 FROM information_schema.columns isc WHERE isc.table_schema = 'public' AND isc.table_name = 'loans' AND isc.column_name = 'member_id') 
  INTO has_member_id_column;
  
  IF has_members_table THEN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns isc WHERE isc.table_schema = 'public' AND isc.table_name = 'members' AND isc.column_name = 'first_name') 
    INTO has_first_name_column;
    
    SELECT EXISTS (SELECT 1 FROM information_schema.columns isc WHERE isc.table_schema = 'public' AND isc.table_name = 'members' AND isc.column_name = 'last_name') 
    INTO has_last_name_column;
    
    SELECT EXISTS (SELECT 1 FROM information_schema.columns isc WHERE isc.table_schema = 'public' AND isc.table_name = 'members' AND isc.column_name = 'full_name') 
    INTO has_full_name_column;
    
    SELECT EXISTS (SELECT 1 FROM information_schema.columns isc WHERE isc.table_schema = 'public' AND isc.table_name = 'members' AND isc.column_name = 'name') 
    INTO has_name_column;
  END IF;

  -- Build member name SQL based on available columns
  IF has_first_name_column AND has_last_name_column THEN
    member_name_sql := 'TRIM(COALESCE(m.first_name, '''') || '' '' || COALESCE(m.last_name, ''''))';
  ELSIF has_full_name_column THEN
    member_name_sql := 'm.full_name';
  ELSIF has_name_column THEN
    member_name_sql := 'm.name';
  ELSE
    member_name_sql := '''Unknown Member''';
  END IF;

  -- Fetch recent loans based on available tables and user role
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables ist WHERE ist.table_schema = 'public' AND ist.table_name = 'loans') THEN
      
      -- Check if we can join with members table
      IF has_members_table AND has_member_id_column THEN
        
        -- Use members table with proper name handling
        IF user_role = 'super_admin' THEN
          RETURN QUERY EXECUTE format('
            SELECT 
              l.id,
              l.principal_amount,
              l.status::text,
              COALESCE(%s, ''Unknown Member'') as member_name,
              COALESCE(m.id, l.id) as member_id
            FROM loans l
            LEFT JOIN members m ON l.member_id = m.id
            ORDER BY l.created_at DESC
            LIMIT 5', member_name_sql);
        
        ELSIF user_role = 'branch_admin' AND user_branch_id IS NOT NULL THEN
          RETURN QUERY EXECUTE format('
            SELECT 
              l.id,
              l.principal_amount,
              l.status::text,
              COALESCE(%s, ''Unknown Member'') as member_name,
              COALESCE(m.id, l.id) as member_id
            FROM loans l
            LEFT JOIN members m ON l.member_id = m.id
            WHERE m.branch_id = $1
            ORDER BY l.created_at DESC
            LIMIT 5', member_name_sql) USING user_branch_id;
        
        ELSIF user_role = 'loan_officer' THEN
          RETURN QUERY EXECUTE format('
            SELECT 
              l.id,
              l.principal_amount,
              l.status::text,
              COALESCE(%s, ''Unknown Member'') as member_name,
              COALESCE(m.id, l.id) as member_id
            FROM loans l
            LEFT JOIN members m ON l.member_id = m.id
            WHERE l.created_by = $1 
               OR (EXISTS (SELECT 1 FROM information_schema.columns isc WHERE isc.table_schema = ''public'' AND isc.table_name = ''loans'' AND isc.column_name = ''loan_officer_id'') 
                   AND l.loan_officer_id = $1)
            ORDER BY l.created_at DESC
            LIMIT 5', member_name_sql) USING requesting_user_id;
          
        ELSE
          -- For teller, auditor, etc. - show branch loans if they have branch_id
          IF user_branch_id IS NOT NULL THEN
            RETURN QUERY EXECUTE format('
              SELECT 
                l.id,
                l.principal_amount,
                l.status::text,
                COALESCE(%s, ''Unknown Member'') as member_name,
                COALESCE(m.id, l.id) as member_id
              FROM loans l
              LEFT JOIN members m ON l.member_id = m.id
              WHERE m.branch_id = $1
              ORDER BY l.created_at DESC
              LIMIT 5', member_name_sql) USING user_branch_id;
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
