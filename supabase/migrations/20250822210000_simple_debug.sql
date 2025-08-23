-- Simple Debug - Let's see what's actually in your database
-- This will help us understand why member names aren't being fetched

-- Step 1: Check what tables exist
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Step 2: Check if members table exists and has data
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members') 
        THEN '✅ Members table EXISTS'
        ELSE '❌ Members table DOES NOT EXIST'
    END as members_table_status;

-- Step 3: If members table exists, show its structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'members'
ORDER BY ordinal_position;

-- Step 4: Check if members table has any data
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members') 
        THEN (SELECT COUNT(*) FROM members)
        ELSE 0
    END as members_count;

-- Step 5: Show sample data from members table (if it exists and has data)
SELECT * FROM members LIMIT 3;

-- Step 6: Check loans table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'loans'
ORDER BY ordinal_position;

-- Step 7: Show sample loans data
SELECT * FROM loans LIMIT 3;

-- Step 8: Check profiles table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Step 9: Show sample profiles data
SELECT * FROM profiles LIMIT 3;

-- Step 10: Test loan officer lookup - This should show loan officer names
SELECT 
    l.id as loan_id,
    l.principal_amount,
    l.loan_officer_id,
    p.full_name as loan_officer_name
FROM loans l
LEFT JOIN profiles p ON l.loan_officer_id = p.id
LIMIT 5;

-- Step 11: Check what balance fields exist in loans table
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'loans'
AND column_name LIKE '%balance%'
ORDER BY ordinal_position;

-- Step 12: Check sample loan data with all fields to see what's available
SELECT 
    id,
    principal_amount,
    status,
    due_date,
    member_id,
    loan_officer_id,
    created_by,
    branch_id
FROM loans 
LIMIT 5;

-- Step 13: Test aggregation queries to see if they work
SELECT 
    COUNT(*) as total_loans,
    COUNT(CASE WHEN status IN ('active', 'pending') THEN 1 END) as active_loans,
    SUM(CASE WHEN status = 'active' THEN CAST(principal_amount AS DECIMAL) ELSE 0 END) as total_disbursed
FROM loans;
