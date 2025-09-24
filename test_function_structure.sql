-- Test script to check function structure vs expected interface

-- Test 1: Check if function exists and what it returns
SELECT 
    routine_name, 
    routine_type,
    data_type,
    specific_name
FROM information_schema.routines 
WHERE routine_name = 'get_unified_overdue_loans_report';

-- Test 2: Check the function's return type structure
SELECT 
    parameter_name,
    data_type,
    parameter_mode
FROM information_schema.parameters 
WHERE specific_name = (
    SELECT specific_name 
    FROM information_schema.routines 
    WHERE routine_name = 'get_unified_overdue_loans_report'
)
ORDER BY ordinal_position;

-- Test 3: Test the function with a sample user ID
-- Replace 'your-user-id-here' with an actual user ID from your profiles table
SELECT * FROM get_unified_overdue_loans_report('your-user-id-here') LIMIT 1;

-- Test 4: Check what columns the function actually returns
-- This will show us the actual structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'loans' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test 5: Check members table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'members' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test 6: Check profiles table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;
