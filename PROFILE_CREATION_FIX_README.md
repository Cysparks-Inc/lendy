# Profile Creation Fix & Multiple Super Admin Support

## Issues Fixed

### 1. Profile Creation Problem
- **Problem**: When super admins created users, the user accounts were created successfully but profiles were not automatically created in the `profiles` table.
- **Root Cause**: The database trigger `on_auth_user_created` was unreliable and often failed due to RLS (Row Level Security) policies and database constraints.
- **Solution**: **IMPLEMENTED DIRECT APPROACH** - The edge function now directly creates profiles and roles instead of relying on unreliable database triggers.

### 2. Multiple Super Admin Support
- **Problem**: The system was designed to support multiple super admins but had some restrictions in the policies.
- **Solution**: Updated the RLS policies to ensure multiple super admins can work together without conflicts.

### 3. Table Structure Mismatch
- **Problem**: The system was trying to use `user_branch_roles` table with `assigned_by` column, but the correct table is `user_roles`.
- **Root Cause**: Conflicting table structures from different migrations.
- **Solution**: Created a comprehensive migration to ensure correct table structure.

### 4. Super Admin Branch Assignment
- **Problem**: Super admins were required to select a branch, but they should have access to all branches.
- **Solution**: Made branch field conditional - only shown for non-super-admin roles.

## Changes Made

### Database Migrations

#### 1. Updated `20250820134907_7b203c61-5279-465a-8046-836ecfb30607.sql`
- Fixed the `handle_new_user()` function to properly create profiles and roles
- Updated RLS policies to allow trigger-based profile creation
- Ensured multiple super admins can manage all profiles and roles

#### 2. Created `20250820140000_fix_profile_creation_trigger.sql`
- Comprehensive fix for the profile creation trigger
- Updated all RLS policies for profiles and user_roles tables
- Fixed the `is_super_admin()` and `has_role()` functions

#### 3. Created `20250820141000_fix_table_structure.sql` ⭐ **NEW**
- Fixes table structure mismatches
- Ensures correct `user_roles` table structure
- Drops conflicting `user_branch_roles` table
- Creates proper indexes for performance
- **This migration addresses the "assigned_by column not found" error**

#### 4. Created `20250820142000_fix_profiles_table_for_direct_insert.sql` ⭐ **CRITICAL NEW**
- **Fixes the profiles table to allow direct insertion by the service role**
- **Simplifies RLS policies to work reliably**
- **Ensures all necessary columns exist**
- **This is the key migration that fixes the profile creation issue**

### Frontend Updates

#### 1. Updated `src/types/index.ts`
- Changed `UserRole` type to match the current database enum:
  - `'super_admin' | 'branch_admin' | 'loan_officer' | 'teller' | 'auditor'`

#### 2. Updated `src/pages/UserFormPage.tsx`
- Added `useAuth` hook to get current user information
- Pass the current user's ID as `created_by` when creating new users
- Updated role options to match the database enum
- **Made branch field conditional - super admins don't need to select a branch**
- Enhanced validation schema to handle conditional branch requirements

#### 3. Updated `src/config/sidebarConfig.ts`
- Changed `branch_manager` to `branch_admin` to match the database enum

### Supabase Edge Function Updates

#### 1. Updated `supabase/functions/create-user/index.ts` ⭐ **MAJOR CHANGE**
- **COMPLETELY REWROTE** the function to use direct approach instead of triggers
- **Directly creates profiles** in the `profiles` table using service role
- **Directly creates roles** in the `user_roles` table using service role
- **No more waiting for unreliable database triggers**
- **Better error handling and fallback mechanisms**
- **Immediate profile and role creation**

## How It Works Now ⭐ **NEW APPROACH**

### 1. User Creation Flow (Direct Approach)
1. Super admin fills out user creation form
2. **Branch field is only shown for non-super-admin roles**
3. Form calls the `create-user` edge function
4. **Edge function creates auth user**
5. **Edge function DIRECTLY creates profile in `profiles` table**
6. **Edge function DIRECTLY creates role entry in `user_roles` table**
7. **User can immediately log in with full access**
8. **No more waiting for database triggers**

### 2. Multiple Super Admin Support
- Multiple users can have the `super_admin` role
- All super admins have full access to manage users, profiles, and roles
- No conflicts between super admins
- Each super admin can create other super admins
- **Super admins don't need branch assignment - they have access to all branches**

### 3. Security Features
- **Service role bypasses RLS** during profile/role creation (secure)
- RLS policies ensure users can only access what they're authorized to see
- Super admins can manage all profiles and roles
- Branch admins can only manage users in their assigned branches
- Regular users can only view and edit their own profiles

## How to Apply the Fixes

### 1. Apply Database Migrations ⭐ **IMPORTANT ORDER**
Run the SQL migrations in your Supabase dashboard in this exact order:
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the migration files in order:
   - `20250820134907_7b203c61-5279-465a-8046-836ecfb30607.sql`
   - `20250820140000_fix_profile_creation_trigger.sql`
   - `20250820141000_fix_table_structure.sql`
   - **`20250820142000_fix_profiles_table_for_direct_insert.sql`** ⭐ **Run this last**

### 2. Deploy Edge Function Updates ⭐ **CRITICAL**
1. Navigate to Edge Functions in your Supabase dashboard
2. **Update the `create-user` function with the completely rewritten code**
3. Deploy the function
4. **This is the most important step - the new function directly creates profiles**

### 3. Update Frontend Code
1. Update the TypeScript files as shown above
2. Rebuild and deploy your frontend application

### 4. Test the Fix
1. Create a new user as a super admin
2. **Verify that branch field is hidden for super admin role**
3. **Verify that the profile is immediately created in the `profiles` table**
4. **Verify that the role is immediately assigned in the `user_roles` table**
5. Test that the new user can log in successfully
6. **Check the users page - the new user should appear immediately**

## Verification Commands

Run these SQL commands in your Supabase SQL editor to verify the fix:

```sql
-- Check if the profiles table has the correct structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

-- Check if the user_roles table has the correct structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
ORDER BY ordinal_position;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'profiles';
SELECT * FROM pg_policies WHERE tablename = 'user_roles';

-- Check if there are any conflicting tables
SELECT * FROM information_schema.tables WHERE table_name LIKE '%branch%';

-- Test the helper functions
SELECT is_super_admin('your-user-id-here');
SELECT has_role('your-user-id-here', 'super_admin'::app_role);
```

## Troubleshooting

### If Profiles Still Aren't Created ⭐ **MAIN ISSUE**
**This should now be fixed with the new direct approach. If it still fails:**

1. **Check the edge function logs** for any errors
2. **Verify the service role key** is correct in your edge function
3. **Run all four migrations in order**
4. **Ensure the edge function is deployed with the new code**
5. **Check that the profiles table has all required columns**

### If You Get "assigned_by column not found" Error
This error occurs when the system tries to use the wrong table structure. **Solution**:
1. Run the `20250820141000_fix_table_structure.sql` migration
2. This migration drops the conflicting `user_branch_roles` table
3. Ensures the correct `user_roles` table structure

### If Role Assignment Fails
1. Check the `user_roles` table structure (not `user_branch_roles`)
2. Verify the `app_role` enum values
3. Check RLS policies on the `user_roles` table
4. **Ensure you're using the correct table name in all code**

### If Multiple Super Admins Can't Work
1. Verify the `is_super_admin()` function exists and works
2. Check RLS policies on both `profiles` and `user_roles` tables
3. Ensure the `has_role()` function is working correctly

### If Branch Field Shows for Super Admin
1. Check that the frontend validation is working
2. Verify the role selection logic in `UserFormPage.tsx`
3. Ensure the `watchedRole` state is properly updating

## Security Notes

- **The new approach uses the service role to directly create profiles and roles**
- **This is secure because the service role bypasses RLS and only runs in the edge function**
- **All other operations still respect RLS policies**
- **Super admins have full access but are still subject to audit logging**
- **Branch assignment is now properly controlled based on user role**

## Why the New Approach is Better

### ❌ **Old Trigger Approach (Unreliable)**
- Database triggers often fail due to RLS policies
- Triggers can be blocked by database constraints
- Difficult to debug when triggers fail
- Users created but profiles missing

### ✅ **New Direct Approach (Reliable)**
- **Edge function directly creates profiles and roles**
- **Service role bypasses all RLS restrictions**
- **Immediate creation - no waiting**
- **Better error handling and logging**
- **Easier to debug and maintain**

## Common Error Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `assigned_by column not found` | Wrong table structure | Run `20250820141000_fix_table_structure.sql` |
| `user_branch_roles table not found` | Table name mismatch | Use `user_roles` table instead |
| `Branch field required for super admin` | Frontend validation issue | Update `UserFormPage.tsx` |
| `Profile creation failed` | **NEW: Direct approach should fix this** | Deploy updated edge function |
| `Service role permission denied` | RLS policy blocking | Run `20250820142000_fix_profiles_table_for_direct_insert.sql` |

## Testing the New Fix

1. **Deploy the updated edge function** (most important step)
2. **Run all four migrations in order**
3. **Create a test user** and verify:
   - Profile appears immediately in `profiles` table
   - Role appears immediately in `user_roles` table
   - User appears on the users page
   - User can log in successfully
4. **Check edge function logs** for any errors

The new direct approach should completely resolve the profile creation issue!
