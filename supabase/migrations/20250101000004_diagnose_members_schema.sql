-- Diagnose the actual members table schema
-- This will help us understand what columns actually exist

-- Check what columns exist in members table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'members'
ORDER BY ordinal_position;

-- Show sample data to understand the structure
SELECT * FROM members LIMIT 3;
