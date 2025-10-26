# Lendy Microfinance - Supabase Setup Guide

This guide will help you set up the Lendy Microfinance system with a new Supabase project.

## Prerequisites

1. A new Supabase project created at [supabase.com](https://supabase.com)
2. Supabase CLI installed (optional but recommended)
3. Access to your new Supabase project dashboard

## Step 1: Create Environment Variables

1. Go to your new Supabase project settings
2. Copy the following credentials:
   - **Project URL**: Found in Settings > API
   - **Anon Key**: Found in Settings > API  
   - **Service Role Key**: Found in Settings > API (keep this secret!)

3. Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## Step 2: Update Supabase Configuration

Update the file `src/integrations/supabase/client.ts` with your new project details:

```typescript
const SUPABASE_URL = "your_new_project_url";
const SUPABASE_PUBLISHABLE_KEY = "your_new_anon_key";
```

**OR** you can use environment variables (recommended):

```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

Update `supabase/config.toml`:
```toml
project_id = "your_new_project_id"
```

## Step 3: Apply Database Migrations

You have **92 migration files** to apply. Here's the recommended approach:

### Option A: Using Supabase Dashboard (Recommended for beginners)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and run migrations **one by one** in chronological order

**Start with these critical migrations:**

1. `20250819181135_db4d2ed6-7b78-4c63-bae4-c4035f0f2496.sql` - Initial schema
2. `20250820103531_3dbae4a0-6d86-4fb0-afde-aaa13f78e5a7.sql` - Comprehensive schema
3. All remaining migrations in chronological order

### Option B: Using Supabase CLI (Advanced)

If you have Supabase CLI installed and linked to your project:

```bash
# Link your project
supabase link --project-ref your_project_ref

# Apply all migrations
supabase db push
```

## Step 4: Enable Required Features

### Enable Storage for Profile Pictures

1. Go to **Storage** in your Supabase dashboard
2. Create a bucket called `member-avatars` with public access
3. Set up policies:
   - Allow authenticated users to upload
   - Allow authenticated users to read

### Enable Authentication

1. Go to **Authentication** > **Settings**
2. Ensure email authentication is enabled
3. Configure email templates if needed

## Step 5: Deploy Edge Functions

You need to deploy 5 edge functions:

1. **create-user**
2. **delete-user**  
3. **reset-user-password**
4. **disable-user-mfa**
5. **create-loan-officer**

### Deploy via Dashboard:

1. Go to **Edge Functions** in Supabase dashboard
2. Create a new function for each:
   - Copy the code from `supabase/functions/[function-name]/index.ts`
   - Paste into the function editor
   - Deploy

### Deploy via CLI:

```bash
# Deploy all functions
supabase functions deploy create-user
supabase functions deploy delete-user
supabase functions deploy reset-user-password
supabase functions deploy disable-user-mfa
supabase functions deploy create-loan-officer
```

## Step 6: Set Up Row Level Security (RLS)

Most migrations include RLS policies, but verify these are enabled:

1. Go to **Authentication** > **Policies**
2. Ensure policies are enabled for:
   - `profiles`
   - `members`
   - `loans`
   - `branches`
   - `groups`
   - `transactions`
   - `expenses`
   - `loan_payments`

## Step 7: Create Storage Bucket

```sql
-- Run in SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('member-avatars', 'member-avatars', true);

-- Set up storage policies
CREATE POLICY "Allow authenticated users to upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'member-avatars');

CREATE POLICY "Allow authenticated users to read avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'member-avatars');
```

## Step 8: Create Your First User

After setup, create your first super admin user:

1. Go to **Authentication** > **Users**
2. Click **Add User** manually
3. Or use the application's user creation feature (once logged in)

**Important:** Make sure to set:
- Email verified: `true`
- Role: `super_admin`
- Branch: Create a branch first and assign it

## Step 9: Create Initial Data

Run these SQL commands to create initial data:

```sql
-- Create a sample branch
INSERT INTO public.branches (name, code, location, is_active)
VALUES ('Main Branch', 'MB-001', 'Nairobi', true);

-- Create a sample organization (if needed)
INSERT INTO public.organizations (name, code)
VALUES ('Lendy Microfinance', 'LEN-001');

-- Create initial penalty policy
INSERT INTO public.penalty_policies (name, penalty_type, rate_per_day)
VALUES ('Standard Late Fee', 'percentage', 0.0005);

-- Create sample loan products
INSERT INTO public.loan_products (name, min_amount, max_amount, interest_rate, min_term_months, max_term_months, requires_collateral)
VALUES 
  ('Agricultural Loan', 5000, 100000, 0.02, 6, 24, false),
  ('Business Loan', 10000, 500000, 0.025, 12, 60, true),
  ('Emergency Loan', 1000, 25000, 0.035, 3, 12, false);
```

## Step 10: Verify Setup

1. Start the application:
   ```bash
   npm run dev
   ```

2. Try logging in with your created user
3. Check the dashboard loads correctly
4. Test creating a member
5. Test creating a loan

## Troubleshooting

### Common Issues:

1. **"Relation does not exist" error**
   - Make sure all migrations ran successfully
   - Check the migration log for errors

2. **Authentication errors**
   - Verify your environment variables
   - Check that auth is enabled in Supabase

3. **RLS policy errors**
   - Ensure policies are created in migrations
   - Check that your user has proper permissions

4. **Storage errors**
   - Verify storage bucket exists
   - Check storage policies

## Migration Order

Apply migrations in this specific order for best results:

```
1. 20250819181135_* (Initial schema)
2. 20250820080235_*
3. 20250820103531_* (Main comprehensive schema)
4. 20250820103722_*
5. All 20250820* migrations in order
6. All 20250821* migrations in order
7. All 20250822* migrations in order
8. All 20250825* migrations in order
9. All 20250826* migrations in order
10. All 20250827* migrations in order
11. All 20250828* migrations in order
12. All 20250829* migrations in order
13. All 20250830* migrations in order
14. All 202501010000* migrations in order
15. 20250930083320_* (Latest)
```

## Next Steps

1. Update the company logo in `public/lovable-uploads/`
2. Test all major features
3. Configure email templates
4. Set up backup schedules

---

**Need Help?** Contact the development team or check the Supabase documentation.

