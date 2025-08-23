# Debug Dashboard Data Issues

## The Problem
Dashboard showing zeros for all metrics across all user roles, indicating data fetching issues.

## New Migration Features

### 1. **Debug Function Added**
```sql
SELECT * FROM debug_table_data();
```
This will show you:
- Which tables exist in your database
- How many rows each table has
- Whether you have actual data to display

### 2. **Improved Data Targeting**
The new functions:
- Check what tables actually exist
- Detect the correct foreign key relationships
- Handle both `members`/`customers` and `member_id`/`customer_id` scenarios
- Fetch real data from whatever tables you have

### 3. **Better Error Handling**
- Functions now provide fallback data even if some queries fail
- More robust column detection
- Graceful degradation when tables are missing

## Debugging Steps

### Step 1: Run the Migration
Copy and paste the contents of `supabase/migrations/20250820150000_targeted_data_fetching_dashboard.sql` into your Supabase SQL Editor.

### Step 2: Check Your Data
Run this query to see what data you actually have:
```sql
SELECT * FROM debug_table_data();
```

### Step 3: Test the Functions Directly
Test the dashboard functions directly:
```sql
-- Replace 'your-user-id' with an actual user ID from your profiles table
SELECT * FROM get_dashboard_stats_for_user('your-user-id');
SELECT * FROM get_recent_loans_for_user('your-user-id');
```

### Step 4: Check Table Structure
```sql
-- Check what columns exist in your loans table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'loans'
ORDER BY ordinal_position;

-- Check what columns exist in your members/customers table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name IN ('members', 'customers')
ORDER BY table_name, ordinal_position;
```

## Likely Issues & Solutions

### Issue 1: No Data in Tables
**Problem**: Tables exist but are empty
**Solution**: Create some sample data or import existing data

### Issue 2: Wrong Table Names
**Problem**: Your tables might be named differently
**Solution**: The new functions auto-detect table names and structures

### Issue 3: Different Column Names
**Problem**: Your columns might be named differently than expected
**Solution**: The new functions check for common column name variations

### Issue 4: Missing Relationships
**Problem**: Foreign key relationships might not be set up correctly
**Solution**: The new functions handle missing relationships gracefully

## Expected Results

After running the migration, you should see:

### For Super Admin:
- Total system-wide statistics
- All loans across all branches
- All members/customers

### For Branch Admin:
- Branch-specific statistics
- Only loans from their branch
- Only members from their branch

### For Loan Officer:
- Only their own loans
- Only members they've worked with
- Personal performance metrics

## If Still Showing Zeros

1. **Check the debug function results** - this will tell you if you have any data at all
2. **Verify user roles** - make sure users have roles assigned in the profiles table
3. **Check sample data** - you might need to create some sample loans and members
4. **Review table structure** - the functions will adapt to your actual schema

## Sample Data Creation (if needed)

If you have no data, you can create some sample data:
```sql
-- Insert sample branch (if branches table exists)
INSERT INTO branches (name, code, location) 
VALUES ('Main Branch', 'MAIN', 'Downtown') 
ON CONFLICT DO NOTHING;

-- Insert sample member (adjust columns based on your table structure)
-- This is just an example - adjust to match your actual table structure
```

The new migration is much more robust and should fetch actual data from whatever tables you have!
