# How to Create Your First User in Lendy Microfinance

Since you can't access the system yet, you need to create your first user directly in Supabase.

## Step-by-Step Guide

### Method 1: Using Supabase Dashboard (Recommended)

1. **Go to your Supabase Dashboard**
   - URL: https://supabase.com/dashboard/project/imkdmwsukojuhzjlmyfh
   - Navigate to **Authentication** > **Users**

2. **Click "Add User"**
   - Email: Enter your email (e.g., admin@lendy.com)
   - Password: Create a strong password
   - Auto Confirm User: **Enable this checkbox** ✅
   - Click "Create User"

3. **After creating the auth user, you need to create the profile**
   - Go to **SQL Editor** in Supabase
   - Run this SQL (replace the UUID with your new user's ID from auth.users):

```sql
-- Step 1: Get your user ID from auth.users
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- Step 2: Create the profile (replace 'YOUR-USER-ID-HERE' with the ID from step 1)
INSERT INTO public.profiles (id, full_name, email, role, is_active)
VALUES (
  'YOUR-USER-ID-HERE',
  'Your Full Name',
  'your.email@lendy.com',
  'super_admin',
  true
);

-- Step 3: Create a branch (if you haven't already)
INSERT INTO public.branches (name, code, location, is_active)
VALUES ('Main Branch', 'MB-001', 'Nairobi', true);

-- Step 4: Optionally, assign yourself to a branch (get branch_id from step 3)
UPDATE public.profiles 
SET branch_id = (SELECT id FROM public.branches WHERE code = 'MB-001')
WHERE id = 'YOUR-USER-ID-HERE';
```

### Method 2: Complete SQL Script (Run All At Once)

```sql
-- 1. Insert a user into auth.users (this happens automatically when you create in dashboard)
-- But we'll create the profile here

-- 2. First, check what users exist
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;

-- 3. Replace YOUR-USER-ID with the user ID from step 2, then run:
-- (Replace YOUR-USER-EMAIL with your email too)

INSERT INTO public.profiles (id, full_name, email, role, is_active)
VALUES (
  'YOUR-USER-ID-FROM-AUTH-USERS',
  'Administrator',
  'YOUR-USER-EMAIL',
  'super_admin',
  true
);

-- 4. Create a branch
INSERT INTO public.branches (name, code, location, is_active)
VALUES ('Main Branch', 'MB-001', 'Nairobi', true)
ON CONFLICT (code) DO NOTHING;

-- 5. Link your profile to the branch
UPDATE public.profiles 
SET branch_id = (SELECT id FROM public.branches WHERE code = 'MB-001')
WHERE email = 'YOUR-USER-EMAIL';

-- 6. Verify it worked
SELECT id, full_name, email, role, branch_id, is_active 
FROM public.profiles 
WHERE email = 'YOUR-USER-EMAIL';
```

## What the System Looks For

The login system checks:
- ✅ `auth.users` - User authentication (email/password)
- ✅ `profiles` table - User profile with role
- ✅ `role` column in profiles - Must be 'super_admin', 'branch_admin', 'loan_officer', 'teller', or 'auditor'
- ✅ `is_active` = true
- ✅ `branch_id` (optional but recommended)

## Your First Login

After running the SQL:
1. Go to your local development URL (http://localhost:8080)
2. Enter the email you created
3. Enter the password you set
4. You should be logged in as a Super Admin!

## Important Notes

- **Email Verification**: You enabled "Auto Confirm User" so no email verification is needed
- **MFA**: Currently disabled in the code (we commented it out)
- **Role**: Make sure you set role as 'super_admin' (not 'admin')
- **Profile Creation**: The trigger should auto-create profiles, but since we're starting fresh, do it manually

## Troubleshooting

**Problem: "User not found"**
- Check that the profile exists in `public.profiles` table
- Verify the user ID matches between `auth.users` and `profiles`

**Problem: "Role not found"**
- Check that role is set correctly (use 'super_admin' not 'admin')
- Verify `is_active` is true

**Problem: "Account deactivated"**
- Check that `is_active` column in profiles is `true`

## Quick Test

After creating your user, test the connection:

```sql
-- This should return your user with all details
SELECT 
  au.email,
  p.full_name,
  p.role,
  p.is_active,
  b.name as branch_name
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
LEFT JOIN public.branches b ON p.branch_id = b.id
WHERE au.email = 'YOUR-EMAIL-HERE';
```

If this returns your user details, you're all set to login! 🎉

