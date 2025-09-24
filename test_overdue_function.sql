-- Test script to verify the get_unified_overdue_loans_report function works correctly
-- Run this in your Supabase SQL Editor to test the function

-- Test 1: Check if the function exists and what it returns
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

-- Test 3: Test the function with a sample user ID (replace with actual user ID)
-- Replace 'your-user-id-here' with an actual user ID from your profiles table
SELECT * FROM get_unified_overdue_loans_report('your-user-id-here') LIMIT 5;

-- Test 4: Check if there are any overdue loans in the system
SELECT 
    COUNT(*) as total_overdue_loans,
    COUNT(CASE WHEN l.status = 'active' THEN 1 END) as active_overdue,
    COUNT(CASE WHEN l.status = 'pending' THEN 1 END) as pending_overdue,
    COUNT(CASE WHEN l.status = 'defaulted' THEN 1 END) as defaulted_overdue
FROM loans l
WHERE l.current_balance > 0
AND (
    (l.due_date IS NOT NULL AND l.due_date < CURRENT_DATE::date)
    OR
    (l.installment_type IS NOT NULL AND l.issue_date IS NOT NULL)
);

-- Test 5: Check if the function returns the expected columns
-- This should return columns matching the function definition
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'loans' 
AND column_name IN (
    'id', 'account_number', 'member_id', 'customer_id', 'branch_id', 'loan_officer_id',
    'current_balance', 'due_date', 'status', 'principal_amount', 'issue_date'
)
ORDER BY column_name;

-- Test 6: Check members table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'members' 
AND column_name IN (
    'id', 'full_name', 'phone_number', 'member_no'
)
ORDER BY column_name;
