-- Final fix for all remaining schema issues

-- Step 1: Check what the actual loans table structure is
SELECT 'LOANS TABLE' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'loans'
ORDER BY ordinal_position;

-- Step 2: Add status column to loans if it doesn't exist
-- Loans might have approval_status instead of status
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Step 3: Check branches table structure
SELECT 'BRANCHES TABLE' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'branches'
ORDER BY ordinal_position;

-- Step 4: Check if branches.id is UUID or bigint
-- If it's bigint but we're using UUID, convert it
DO $$
DECLARE
    branches_id_type TEXT;
BEGIN
    SELECT data_type INTO branches_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'branches'
    AND column_name = 'id';
    
    RAISE NOTICE 'Branches.id is of type: %', branches_id_type;
    
    -- If branches.id is bigint but we need UUID
    IF branches_id_type = 'bigint' THEN
        RAISE NOTICE 'Branches.id is bigint - keep it as is';
    ELSIF branches_id_type = 'uuid' THEN
        RAISE NOTICE 'Branches.id is uuid - this is correct';
    ELSE
        RAISE NOTICE 'Branches.id is of unknown type';
    END IF;
END $$;

-- Step 5: Get branches data to see actual structure
SELECT 'BRANCHES DATA' as info;
SELECT id, name, location, code FROM branches LIMIT 5;

-- Done!
