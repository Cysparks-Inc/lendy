# Dashboard and Role Assignment Fixes

## Issues Fixed

### 1. Email Verification
- **Problem**: Users were automatically confirmed without verification (`email_confirm: true`)
- **Fix**: Changed to `email_confirm: false` in the create-user edge function
- **Result**: Users now receive verification emails and must enter verification codes

### 2. Role Assignment Issues
- **Problem**: Roles were not being properly assigned to new users
- **Root Cause**: Database functions were missing and RLS policies were interfering
- **Fix**: 
  - Updated create-user edge function to directly insert into `user_roles` table
  - Added comprehensive logging to track role creation process
  - Ensured service role bypasses RLS for direct inserts

### 3. Dashboard Visibility for Different User Levels
- **Problem**: Dashboard only showed data for super admins, other users saw empty pages
- **Root Cause**: Missing database functions `get_dashboard_stats_for_user` and `get_recent_loans_for_user`
- **Fix**: Created comprehensive database functions that filter data based on user role

## Database Functions Created

### `get_dashboard_stats_for_user(requesting_user_id UUID)`
Returns dashboard statistics filtered by user role:
- **Super Admin**: System-wide stats
- **Branch Admin**: Branch-specific stats
- **Loan Officer**: Only their own loans
- **Teller/Auditor**: Branch-specific stats (if they have a branch)

### `get_recent_loans_for_user(requesting_user_id UUID)`
Returns recent loans filtered by user role:
- **Super Admin**: System-wide recent loans
- **Branch Admin**: Branch-specific recent loans
- **Loan Officer**: Only their own recent loans
- **Teller/Auditor**: Branch-specific recent loans (if they have a branch)

## Frontend Updates

### Dashboard Component
- Added support for all user roles: `super_admin`, `branch_admin`, `loan_officer`, `teller`, `auditor`
- Created role-specific view components:
  - `AdminDashboard`: For super_admin and branch_admin
  - `LoanOfficerView`: For loan_officer
  - `TellerView`: For teller
  - `AuditorView`: For auditor
  - `NoRoleView`: For users without assigned roles

### AuthContext Updates
- Added `profile` property to access user profile data
- Updated to use `user_roles` table instead of deprecated `user_branch_roles`
- Fetches both role and profile data simultaneously

## Migration Files

### `20250820143000_create_dashboard_functions.sql`
- Creates the missing dashboard functions
- Grants execute permissions to authenticated users
- Implements role-based data filtering

## Role-Based Data Access

| Role | Data Access | Scope |
|------|-------------|-------|
| **Super Admin** | All data | System-wide |
| **Branch Admin** | Branch data | Branch-specific |
| **Loan Officer** | Own loans | Personal |
| **Teller** | Branch data | Branch-specific |
| **Auditor** | Branch data | Branch-specific |

## Deployment Steps

1. **Deploy the new migration**:
   ```bash
   supabase db push
   ```

2. **Deploy the updated create-user function**:
   ```bash
   supabase functions deploy create-user
   ```

3. **Test user creation**:
   - Create a user with role `super_admin`
   - Check that verification email is sent
   - Verify role is properly assigned in `user_roles` table
   - Confirm profile is created in `profiles` table

4. **Test dashboard visibility**:
   - Login as different user types
   - Verify dashboard shows appropriate data for each role
   - Check that data is properly filtered

## Verification Commands

### Check if functions exist:
```sql
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name IN ('get_dashboard_stats_for_user', 'get_recent_loans_for_user');
```

### Check user roles:
```sql
SELECT u.email, ur.role, ur.branch_id, p.full_name
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC;
```

### Test function calls:
```sql
-- Test as super admin (replace with actual user ID)
SELECT * FROM get_dashboard_stats_for_user('your-user-id-here');
SELECT * FROM get_recent_loans_for_user('your-user-id-here');
```

## Troubleshooting

### If roles still not assigned:
1. Check edge function logs for detailed error messages
2. Verify `user_roles` table structure matches expected schema
3. Ensure RLS policies allow service role inserts

### If dashboard still empty:
1. Verify database functions were created successfully
2. Check user has proper role assigned
3. Verify RLS policies allow function execution
4. Check browser console for JavaScript errors

### If verification emails not sent:
1. Verify `email_confirm: false` in create-user function
2. Check Supabase email settings
3. Verify user email is valid

## Security Notes

- All functions use `SECURITY DEFINER` to run with elevated privileges
- Data filtering is implemented at the database level
- RLS policies ensure users can only access appropriate data
- Service role is used only for admin operations (user creation)

## Next Steps

1. Test the complete user creation flow
2. Verify dashboard visibility for all user types
3. Monitor edge function logs for any remaining issues
4. Consider adding more granular permissions if needed
