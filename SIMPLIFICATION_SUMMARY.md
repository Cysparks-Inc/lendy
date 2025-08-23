# System Simplification: Use Only Profiles Table

## What We've Done

### 1. **Eliminated Redundant user_roles Table**
- The `profiles` table now contains all user information including `role` and `branch_id`
- No more confusing dual-table structure

### 2. **Updated Database Functions**
- `get_dashboard_stats_for_user()` now reads from `profiles` table
- `get_recent_loans_for_user()` now reads from `profiles` table
- Functions are simpler and more maintainable

### 3. **Updated Frontend Code**
- `AuthContext` now fetches role directly from `profiles` table
- No more complex joins or multiple queries

### 4. **Updated Edge Function**
- `create-user` function now only inserts into `profiles` table
- Role is stored directly in the profile record
- Much simpler and more reliable

## Current Profiles Table Structure

```sql
profiles:
- id (UUID, PK, references auth.users)
- full_name (TEXT)
- email (TEXT)  
- phone_number (TEXT)
- role (app_role ENUM)
- branch_id (UUID, references branches)
- profile_picture_url (TEXT)
- created_by (UUID, references profiles)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

## Next Steps

1. **Run the migration**: Execute `20250820145000_simplify_to_profiles_only.sql` in Supabase SQL Editor

2. **Update the edge function**: Deploy the updated `create-user` function to Supabase

3. **Test the system**:
   - Create new users → should store role in profiles table
   - Login as different roles → dashboard should show appropriate data
   - No more "user_roles" table complexity

## Benefits

✅ **Simpler Architecture**: One table for all user data
✅ **Better Maintainability**: No duplicate/conflicting data
✅ **Cleaner Code**: Fewer joins, simpler queries
✅ **Less Confusion**: Clear single source of truth
✅ **Better Performance**: Fewer table lookups

## Migration Steps

1. Copy and run this SQL:
```sql
-- [Contents of 20250820145000_simplify_to_profiles_only.sql]
```

2. Update your edge function with the new code

3. Test user creation and dashboard functionality

The system is now much cleaner and more maintainable!
