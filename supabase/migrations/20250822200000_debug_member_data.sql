-- Debug Member Data - Let's see what's actually in your members table
-- This will help us understand why member names aren't being fetched

-- Step 1: Check what columns exist in members table
DO $$
DECLARE
    col_info RECORD;
BEGIN
    RAISE NOTICE '=== MEMBERS TABLE COLUMNS ===';
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members') THEN
        RAISE NOTICE 'Members table columns:';
        FOR col_info IN 
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'members' 
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE '  - % (%s) %s', 
                col_info.column_name, 
                col_info.data_type,
                CASE WHEN col_info.is_nullable = 'YES' THEN 'NULL' ELSE 'NOT NULL' END;
        END LOOP;
    ELSE
        RAISE NOTICE '❌ Members table does not exist!';
    END IF;
    
    RAISE NOTICE '=== END OF COLUMNS ===';
END $$;

-- Step 2: Show actual member data
DO $$
BEGIN
    RAISE NOTICE '=== ACTUAL MEMBER DATA ===';
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members') THEN
        RAISE NOTICE 'Sample member records:';
        EXECUTE 'SELECT * FROM members LIMIT 3';
    END IF;
    
    RAISE NOTICE '=== END OF MEMBER DATA ===';
END $$;

-- Step 3: Check specific member by ID (replace with actual ID from your URL)
DO $$
BEGIN
    RAISE NOTICE '=== CHECKING SPECIFIC MEMBER ===';
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members') THEN
        -- Try to find the member from your URL: 5346bbfb-f600-41d9-8769-a6c948562e94
        RAISE NOTICE 'Looking for member with ID: 5346bbfb-f600-41d9-8769-a6c948562e94';
        
        -- Check if this member exists
        IF EXISTS (SELECT 1 FROM members WHERE id = '5346bbfb-f600-41d9-8769-a6c948562e94') THEN
            RAISE NOTICE '✅ Member found! Here is the data:';
            EXECUTE 'SELECT * FROM members WHERE id = ''5346bbfb-f600-41d9-8769-a6c948562e94''';
        ELSE
            RAISE NOTICE '❌ Member not found with that ID';
            
            -- Show what members we do have
            RAISE NOTICE 'Available member IDs:';
            EXECUTE 'SELECT id, first_name, last_name, full_name FROM members LIMIT 5';
        END IF;
    END IF;
    
    RAISE NOTICE '=== END OF SPECIFIC MEMBER CHECK ===';
END $$;

-- Step 4: Check loans table for this member
DO $$
BEGIN
    RAISE NOTICE '=== CHECKING LOANS FOR MEMBER ===';
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
        RAISE NOTICE 'Checking loans for member: 5346bbfb-f600-41d9-8769-a6c948562e94';
        
        -- Check what foreign key columns exist in loans
        RAISE NOTICE 'Loans table foreign key columns:';
        EXECUTE 'SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = ''public'' AND table_name = ''loans'' AND column_name LIKE ''%member%'' OR column_name LIKE ''%customer%''';
        
        -- Try to find loans for this member
        RAISE NOTICE 'Loans for this member:';
        EXECUTE 'SELECT * FROM loans WHERE member_id = ''5346bbfb-f600-41d9-8769-a6c948562e94'' OR customer_id = ''5346bbfb-f600-41d9-8769-a6c948562e94''';
    END IF;
    
    RAISE NOTICE '=== END OF LOANS CHECK ===';
END $$;
