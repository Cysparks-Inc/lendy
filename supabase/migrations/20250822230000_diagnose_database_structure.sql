-- Database Structure Diagnosis
-- Let's see what's actually in your database before creating views

-- Step 1: Check what tables exist
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Step 2: Check members table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'members'
ORDER BY ordinal_position;

-- Step 3: Check loans table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'loans'
ORDER BY ordinal_position;

-- Step 4: Check profiles table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Step 5: Check branches table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'branches'
ORDER BY ordinal_position;

-- Step 6: Check groups table structure (if it exists)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'groups'
ORDER BY ordinal_position;

-- Step 7: Show sample data from each table to understand the structure
SELECT 'members' as table_name, COUNT(*) as row_count FROM members
UNION ALL
SELECT 'loans' as table_name, COUNT(*) as row_count FROM loans
UNION ALL
SELECT 'profiles' as table_name, COUNT(*) as row_count FROM profiles
UNION ALL
SELECT 'branches' as table_name, COUNT(*) as row_count FROM branches
UNION ALL
SELECT 'groups' as table_name, COUNT(*) as row_count FROM groups;

-- Step 8: Show sample data from members table
SELECT * FROM members LIMIT 3;

-- Step 9: Show sample data from loans table
SELECT * FROM loans LIMIT 3;

-- Step 10: Show sample data from profiles table
SELECT * FROM profiles LIMIT 3;
