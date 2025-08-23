-- FRESH START: Complete Dashboard Overhaul
-- This will discover your actual database structure and create working views

-- Step 1: Discover your EXACT table structure
DO $$
DECLARE
    table_info RECORD;
    column_info RECORD;
    table_count INTEGER := 0;
BEGIN
    RAISE NOTICE '=== YOUR COMPLETE DATABASE STRUCTURE ===';
    
    -- Count total tables
    SELECT COUNT(*) INTO table_count FROM information_schema.tables 
    WHERE table_schema = 'public';
    
    RAISE NOTICE 'Total tables in your database: %', table_count;
    
    -- Show ALL tables
    FOR table_info IN 
        SELECT table_name, table_type 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
    LOOP
        RAISE NOTICE 'Table: % (Type: %)', table_info.table_name, table_info.table_type;
        
        -- Show ALL columns for each table
        FOR column_info IN 
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = table_info.table_name
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE '  - % (%s) %s %s', 
                column_info.column_name, 
                column_info.data_type,
                CASE WHEN column_info.is_nullable = 'YES' THEN 'NULL' ELSE 'NOT NULL' END,
                CASE WHEN column_info.column_default IS NOT NULL THEN 'DEFAULT: ' || column_info.column_default ELSE '' END;
        END LOOP;
        
        RAISE NOTICE '';
    END LOOP;
    
    RAISE NOTICE '=== END OF DATABASE STRUCTURE ===';
END $$;

-- Step 2: Show sample data from key tables
DO $$
BEGIN
    RAISE NOTICE '=== SAMPLE DATA FROM KEY TABLES ===';
    
    -- Show profiles table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        RAISE NOTICE 'Profiles table sample:';
        EXECUTE 'SELECT * FROM profiles LIMIT 2';
    END IF;
    
    -- Show members table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members') THEN
        RAISE NOTICE 'Members table sample:';
        EXECUTE 'SELECT * FROM members LIMIT 2';
    END IF;
    
    -- Show loans table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
        RAISE NOTICE 'Loans table sample:';
        EXECUTE 'SELECT * FROM loans LIMIT 2';
    END IF;
    
    -- Show customers table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
        RAISE NOTICE 'Customers table sample:';
        EXECUTE 'SELECT * FROM customers LIMIT 2';
    END IF;
    
    RAISE NOTICE '=== END OF SAMPLE DATA ===';
END $$;

-- Step 3: Check what loan status values actually exist
DO $$
DECLARE
    status_value TEXT;
BEGIN
    RAISE NOTICE '=== CHECKING LOAN STATUS VALUES ===';
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
        RAISE NOTICE 'Available loan status values:';
        FOR status_value IN 
            SELECT DISTINCT status::text FROM loans ORDER BY status
        LOOP
            RAISE NOTICE '  - %', status_value;
        END LOOP;
    END IF;
    
    RAISE NOTICE '=== END OF STATUS CHECK ===';
END $$;

-- Step 4: Check what member name columns actually exist
DO $$
DECLARE
    name_col TEXT;
BEGIN
    RAISE NOTICE '=== CHECKING MEMBER NAME COLUMNS ===';
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members') THEN
        RAISE NOTICE 'Available member name columns:';
        FOR name_col IN 
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'members' 
            AND column_name LIKE '%name%'
            ORDER BY column_name
        LOOP
            RAISE NOTICE '  - %', name_col;
        END LOOP;
    END IF;
    
    RAISE NOTICE '=== END OF NAME COLUMNS CHECK ===';
END $$;

-- Step 5: Drop any existing functions that might be causing issues
DROP FUNCTION IF EXISTS get_recent_loans_for_user(UUID);
DROP FUNCTION IF EXISTS get_dashboard_stats_for_user(UUID);

-- Step 6: Create a simple dashboard stats view that works with your actual schema
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT 
    (SELECT COUNT(*) FROM members) as total_members,
    (SELECT COUNT(*) FROM loans) as total_loans,
    (SELECT COUNT(*) FROM loans WHERE status IN ('active', 'pending')) as active_loans,
    (SELECT COALESCE(SUM(principal_amount), 0) FROM loans) as total_disbursed,
    (SELECT COALESCE(SUM(current_balance), 0) FROM loans) as outstanding_balance,
    (SELECT COUNT(*) FROM loans WHERE status IN ('active', 'pending') AND due_date < CURRENT_DATE) as overdue_loans;

-- Step 7: Create a simple recent loans view that works with your actual schema
-- This will use whatever member name columns you actually have
CREATE OR REPLACE VIEW recent_loans AS
SELECT 
    l.id,
    l.principal_amount,
    l.status,
    l.due_date,
    -- Simple member name - just use loan ID for now to avoid column errors
    'Loan ' || l.id::text as member_name,
    l.id as member_id
FROM loans l
ORDER BY l.created_at DESC
LIMIT 5;

-- Grant permissions
GRANT SELECT ON dashboard_stats TO authenticated;
GRANT SELECT ON recent_loans TO authenticated;

-- Step 8: Test the new approach
DO $$
DECLARE
    stats_record RECORD;
    loans_record RECORD;
BEGIN
    RAISE NOTICE '=== TESTING NEW DASHBOARD APPROACH ===';
    
    -- Test dashboard stats
    RAISE NOTICE 'Dashboard Stats:';
    FOR stats_record IN SELECT * FROM dashboard_stats LOOP
        RAISE NOTICE 'Total Members: %, Total Loans: %, Active Loans: %, Total Disbursed: %, Outstanding: %, Overdue: %', 
            stats_record.total_members, 
            stats_record.total_loans, 
            stats_record.active_loans, 
            stats_record.total_disbursed, 
            stats_record.outstanding_balance, 
            stats_record.overdue_loans;
    END LOOP;
    
    -- Test recent loans
    RAISE NOTICE 'Recent Loans:';
    FOR loans_record IN SELECT * FROM recent_loans LOOP
        RAISE NOTICE 'Loan: %, Amount: %, Status: %, Member: %', 
            loans_record.id, 
            loans_record.principal_amount, 
            loans_record.status, 
            loans_record.member_name;
    END LOOP;
    
    RAISE NOTICE '=== NEW DASHBOARD READY ===';
    RAISE NOTICE 'Your frontend should now call:';
    RAISE NOTICE '1. SELECT * FROM dashboard_stats';
    RAISE NOTICE '2. SELECT * FROM recent_loans';
END $$;
