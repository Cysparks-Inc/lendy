-- Comprehensive fix for all schema errors
-- This addresses column name mismatches in loans, members, and groups tables

-- Step 1: Check what columns actually exist in loans table
DO $$
BEGIN
    RAISE NOTICE '=== LOANS TABLE SCHEMA ===';
END $$;

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'loans'
ORDER BY ordinal_position;

-- Step 2: Add missing columns to loans table if they don't exist
DO $$
BEGIN
    -- Add status column if it doesn't exist (might be called something else)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'loans' AND column_name = 'status'
    ) THEN
        -- Check if it's called 'approval_status' instead
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'loans' AND column_name = 'approval_status'
        ) THEN
            RAISE NOTICE 'Loans table has approval_status but not status';
        ELSE
            -- Add status column
            ALTER TABLE loans ADD COLUMN status TEXT DEFAULT 'pending';
            RAISE NOTICE 'Added status column to loans table';
        END IF;
    END IF;
END $$;

-- Step 3: Check members table structure
DO $$
BEGIN
    RAISE NOTICE '=== MEMBERS TABLE SCHEMA ===';
END $$;

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'members'
ORDER BY ordinal_position;

-- Step 4: Ensure members table has correct name columns
DO $$
BEGIN
    -- Add full_name if it doesn't exist but name does
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'members' AND column_name = 'name'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'members' AND column_name = 'full_name'
    ) THEN
        -- Create full_name from name
        ALTER TABLE members ADD COLUMN full_name TEXT;
        UPDATE members SET full_name = name WHERE full_name IS NULL;
        RAISE NOTICE 'Created full_name column from name';
    END IF;
    
    -- Ensure full_name exists for the correct structure
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'members' AND column_name = 'full_name'
    ) THEN
        ALTER TABLE members ADD COLUMN full_name TEXT;
        RAISE NOTICE 'Added full_name column to members';
    END IF;
END $$;

-- Step 5: Check groups table structure
DO $$
BEGIN
    RAISE NOTICE '=== GROUPS TABLE SCHEMA ===';
END $$;

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'groups'
ORDER BY ordinal_position;

-- Step 6: Fix groups table - add missing columns or remove references to non-existent ones
DO $$
BEGIN
    -- Remove contact_person_id if it doesn't exist and is referenced
    -- The groups table might not have this column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'groups' AND column_name = 'contact_person_id'
    ) THEN
        RAISE NOTICE 'Groups table has contact_person_id column';
    ELSE
        RAISE NOTICE 'Groups table does not have contact_person_id column - this is OK';
        -- Add it if needed
        ALTER TABLE groups ADD COLUMN IF NOT EXISTS contact_person_id UUID REFERENCES profiles(id);
    END IF;
END $$;

-- Step 7: Grant all necessary permissions
GRANT ALL ON loans TO authenticated;
GRANT ALL ON members TO authenticated;
GRANT ALL ON groups TO authenticated;
GRANT ALL ON branches TO authenticated;

-- Done!
