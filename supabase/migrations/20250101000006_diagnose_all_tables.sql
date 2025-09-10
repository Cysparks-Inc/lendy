-- Comprehensive diagnosis of all table schemas
-- This will help us understand what columns actually exist

-- Check what columns exist in groups table
SELECT 
    'groups' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'groups'
ORDER BY ordinal_position;

-- Check what columns exist in members table
SELECT 
    'members' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'members'
ORDER BY ordinal_position;

-- Check what columns exist in loans table
SELECT 
    'loans' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'loans'
ORDER BY ordinal_position;

-- Show sample data from each table
SELECT 'groups' as table_name, COUNT(*) as row_count FROM groups
UNION ALL
SELECT 'members' as table_name, COUNT(*) as row_count FROM members
UNION ALL
SELECT 'loans' as table_name, COUNT(*) as row_count FROM loans;
