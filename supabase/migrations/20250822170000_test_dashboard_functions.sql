-- Test Dashboard Functions Migration
-- This will show us exactly what's happening with your data

-- Test 1: Check if our functions exist and work
DO $$
DECLARE
    result_count BIGINT;
    result_text TEXT;
BEGIN
    RAISE NOTICE '=== TESTING DASHBOARD FUNCTIONS ===';
    
    -- Test if functions exist
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_dashboard_stats_for_user') THEN
        RAISE NOTICE '✅ get_dashboard_stats_for_user function EXISTS';
    ELSE
        RAISE NOTICE '❌ get_dashboard_stats_for_user function MISSING';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_recent_loans_for_user') THEN
        RAISE NOTICE '✅ get_recent_loans_for_user function EXISTS';
    ELSE
        RAISE NOTICE '❌ get_recent_loans_for_user function MISSING';
    END IF;
    
    -- Test function calls with a sample user ID
    RAISE NOTICE '=== TESTING FUNCTION CALLS ===';
    
    -- Get a sample user ID from profiles
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        SELECT id::text INTO result_text FROM profiles LIMIT 1;
        IF result_text IS NOT NULL THEN
            RAISE NOTICE 'Testing with user ID: %', result_text;
            
            -- Test dashboard stats
            BEGIN
                SELECT total_members INTO result_count FROM get_dashboard_stats_for_user(result_text::uuid);
                RAISE NOTICE '✅ Dashboard stats function works. Total members: %', result_count;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE '❌ Dashboard stats function failed: %', SQLERRM;
            END;
            
            -- Test recent loans
            BEGIN
                SELECT COUNT(*) INTO result_count FROM get_recent_loans_for_user(result_text::uuid);
                RAISE NOTICE '✅ Recent loans function works. Found % loans', result_count;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE '❌ Recent loans function failed: %', SQLERRM;
            END;
        ELSE
            RAISE NOTICE '❌ No users found in profiles table';
        END IF;
    ELSE
        RAISE NOTICE '❌ Profiles table does not exist';
    END IF;
END $$;

-- Test 2: Show actual data counts and table structure
DO $$
DECLARE
    member_count BIGINT;
    loan_count BIGINT;
    total_disbursed NUMERIC;
    total_outstanding NUMERIC;
    column_list TEXT;
BEGIN
    RAISE NOTICE '=== ACTUAL DATA COUNTS ===';
    
    -- Count members and show table structure
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members') THEN
        SELECT COUNT(*) INTO member_count FROM members;
        RAISE NOTICE 'Members table: % records', member_count;
        
        -- Show ALL columns that actually exist in members table
        SELECT string_agg(column_name || ' (' || data_type || ')', ', ') INTO column_list
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'members';
        
        RAISE NOTICE 'Members table columns: %', column_list;
        
        -- Show sample member data safely
        RAISE NOTICE 'Sample member data:';
        EXECUTE 'SELECT * FROM members LIMIT 1';
    ELSE
        RAISE NOTICE '❌ Members table does not exist';
    END IF;
    
    -- Count loans and show table structure
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
        SELECT COUNT(*) INTO loan_count FROM loans;
        RAISE NOTICE 'Loans table: % records', loan_count;
        
        -- Show ALL columns that actually exist in loans table
        SELECT string_agg(column_name || ' (' || data_type || ')', ', ') INTO column_list
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'loans';
        
        RAISE NOTICE 'Loans table columns: %', column_list;
        
        -- Show loan totals
        SELECT 
            COALESCE(SUM(principal_amount), 0),
            COALESCE(SUM(current_balance), 0)
        INTO total_disbursed, total_outstanding
        FROM loans;
        
        RAISE NOTICE 'Total disbursed: Ksh %', total_disbursed;
        RAISE NOTICE 'Total outstanding: Ksh %', total_outstanding;
        
        -- Show sample loan data safely
        RAISE NOTICE 'Sample loans:';
        EXECUTE 'SELECT * FROM loans LIMIT 1';
    ELSE
        RAISE NOTICE '❌ Loans table does not exist';
    END IF;
END $$;

-- Test 3: Check what the frontend should be calling
DO $$
BEGIN
    RAISE NOTICE '=== FRONTEND INTEGRATION CHECK ===';
    RAISE NOTICE 'Your frontend should call:';
    RAISE NOTICE '1. SELECT * FROM get_dashboard_stats_for_user(${user_id})';
    RAISE NOTICE '2. SELECT * FROM get_recent_loans_for_user(${user_id})';
    RAISE NOTICE '';
    RAISE NOTICE 'If these return data, the issue is in the frontend code.';
    RAISE NOTICE 'If these return nothing, the issue is in the database functions.';
END $$;
