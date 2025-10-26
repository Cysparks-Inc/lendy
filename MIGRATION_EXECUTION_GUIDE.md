# Lendy Microfinance - Migration Execution Guide

## Your Supabase Project is Connected ✅

**Project Details:**
- Project ID: `imkdmwsukojuhzjlmyfh`
- URL: `https://imkdmwsukojuhzjlmyfh.supabase.co`
- Configuration files updated successfully

## Next Steps

### Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard/project/imkdmwsukojuhzjlmyfh
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**

### Step 2: Apply Migrations

Apply migrations **in this exact order**. Start with the foundational schema files:

#### Batch 1: Core Database Schema (Start Here)

```bash
# Copy and run in SQL Editor, one by one:

1. supabase/migrations/20250819181135_db4d2ed6-7b78-4c63-bae4-c4035f0f2496.sql
2. supabase/migrations/20250820080235_6230a04c-aeb6-40d3-af6e-6ddab3c362c5.sql  
3. supabase/migrations/20250820103531_3dbae4a0-6d86-4fb0-afde-aaa13f78e5a7.sql
```

These create the core tables: profiles, members, loans, branches, groups, etc.

#### Batch 2: Early Fixes and Enhancements

```bash
4. supabase/migrations/20250820103722_08cf0ea2-a9a7-419d-995f-17fbe3dd5b19.sql
5. supabase/migrations/20250820105907_14b24763-9de9-4670-afb6-c2c41c5a0389.sql
6. supabase/migrations/20250820133016_a180e302-8b97-487b-8977-db74c54c77ab.sql
7. supabase/migrations/20250820133036_605d730e-7e98-4293-ad7f-eb9429c943f5.sql
8. supabase/migrations/20250820134907_7b203c61-5279-465a-8046-836ecfb30607.sql
```

#### Batch 3: Profile and User Management

```bash
9. supabase/migrations/20250820140000_fix_profile_creation_trigger.sql
10. supabase/migrations/20250820141000_fix_table_structure.sql
11. supabase/migrations/20250820142000_fix_profiles_table_for_direct_insert.sql
12. supabase/migrations/20250820143000_create_dashboard_functions.sql
13. supabase/migrations/20250820144000_ensure_user_roles_branch_id.sql
14. supabase/migrations/20250820145000_simplify_to_profiles_only.sql
15. supabase/migrations/20250820146000_fix_dashboard_functions_for_actual_schema.sql
16. supabase/migrations/20250820147000_robust_dashboard_functions.sql
17. supabase/migrations/20250820148000_bulletproof_dashboard_functions.sql
18. supabase/migrations/20250820149000_comprehensive_role_based_dashboard.sql
19. supabase/migrations/20250820150000_targeted_data_fetching_dashboard.sql
20. supabase/migrations/20250820151000_fix_debug_function_safe_queries.sql
```

#### Batch 4: Member and Data Fixes

```bash
21. supabase/migrations/20250820152000_fix_ambiguous_column_and_member_names.sql
22. supabase/migrations/20250820153000_fix_column_ambiguity_and_member_info.sql
23. supabase/migrations/20250821000001_fix_payment_balance_trigger.sql
24. supabase/migrations/20250822160000_comprehensive_schema_fix.sql
25. supabase/migrations/20250822170000_test_dashboard_functions.sql
26. supabase/migrations/20250822180000_simple_dashboard_fix.sql
27. supabase/migrations/20250822190000_fresh_start_dashboard.sql
28. supabase/migrations/20250822200000_debug_member_data.sql
```

#### Batch 5: Views and Dashboard

```bash
29. supabase/migrations/20250822210000_simple_debug.sql
30. supabase/migrations/20250822220000_fix_dashboard_and_pages.sql
31. supabase/migrations/20250822230000_diagnose_database_structure.sql
32. supabase/migrations/20250822240000_create_correct_views.sql
33. supabase/migrations/20250822250000_fix_profile_security.sql
```

#### Batch 6: Branch Management

```bash
34. supabase/migrations/20250822260000_add_branch_management_functions.sql
35. supabase/migrations/20250822260001_simple_branch_fallback.sql
```

#### Batch 7: Groups and Communication

```bash
36. supabase/migrations/20250822270000_add_comprehensive_group_management.sql
37. supabase/migrations/20250822270001_fix_group_management_errors.sql
38. supabase/migrations/20250822280000_fix_user_deletion_constraints.sql
39. supabase/migrations/20250822280001_create_communication_logs_table.sql
40. supabase/migrations/20250822280002_test_communication_logs.sql
41. supabase/migrations/20250822280003_cleanup_collection_logs.sql
```

#### Batch 8: Member Enhancements

```bash
42. supabase/migrations/20250825000001_add_assigned_officer_id_to_members.sql
43. supabase/migrations/20250825000002_fix_deleted_email_tracker_constraint.sql
44. supabase/migrations/20250825000003_fix_deleted_email_tracker_complete.sql
45. supabase/migrations/20250825000004_fix_user_deletion_immediate.sql
46. supabase/migrations/20250825000000_create_transactions_table.sql
```

#### Batch 9: Storage and Features

```bash
47. supabase/migrations/20250826000001_add_member_avatars_storage.sql
48. supabase/migrations/20250827000001_add_loan_program_and_enhanced_loan_fields.sql
49. supabase/migrations/20250827000002_create_loan_payments_table.sql
```

#### Batch 10: Expenses and Financial

```bash
50. supabase/migrations/20250828000001_create_expenses_system.sql
51. supabase/migrations/20250829000001_add_activation_fee_to_members.sql
```

#### Batch 11: Loan Tracking

```bash
52. supabase/migrations/20250830000001_add_installment_tracking.sql
53. supabase/migrations/20250830000002_fix_payment_validation.sql
54. supabase/migrations/20250830000003_comprehensive_loan_fixes_simple.sql
   (OR 20250830000003_comprehensive_loan_fixes.sql - check which one exists)
55. supabase/migrations/20250830000004_fix_member_search.sql
56. supabase/migrations/20250830000005_create_overdue_loans_function.sql
57. supabase/migrations/20250830000006_fix_payment_balance_trigger.sql
```

#### Batch 12: January 2025 Enhancements

```bash
58. supabase/migrations/20250101000001_add_enum_values.sql
59. supabase/migrations/20250101000002_add_admin_functions_and_tables.sql
60. supabase/migrations/20250101000003_safe_admin_setup.sql
61. supabase/migrations/20250101000004_diagnose_members_schema.sql
62. supabase/migrations/20250101000005_add_contact_person_to_groups.sql
63. supabase/migrations/20250101000006_diagnose_all_tables.sql
64. supabase/migrations/20250101000007_fix_missing_columns.sql
65. supabase/migrations/20250101000008_loan_increment_system.sql
66. supabase/migrations/20250101000009_fix_loan_status_enum.sql
67. supabase/migrations/20250101000010_update_loan_functions.sql
68. supabase/migrations/20250101000011_fix_repayments_rls.sql
69. supabase/migrations/20250101000012_fix_payment_completion_and_pending_loans.sql
70. supabase/migrations/20250101000013_create_installment_overdue_function.sql
71. supabase/migrations/20250101000014_add_assigned_officer_to_groups.sql
72. supabase/migrations/20250101000015_fix_processing_fee_status.sql
73. supabase/migrations/20250101000016_add_profession_columns_to_members.sql
74. supabase/migrations/20250101000017_add_approval_status_and_fee_trigger.sql
75. supabase/migrations/20250101000018_enforce_unique_member_id.sql
76. supabase/migrations/20250101000019_fix_set_loan_approval_status_to_transactions.sql
77. supabase/migrations/20250101000020_unified_overdue_calculation.sql
78. supabase/migrations/20250101000021_fix_overdue_function_structure.sql
79. supabase/migrations/20250101000022_fix_overdue_function_corrected.sql
80. supabase/migrations/20250101000023_final_overdue_function.sql
81. supabase/migrations/20250101000024_simple_overdue_function.sql
82. supabase/migrations/20250101000025_drop_and_recreate_overdue_function.sql
83. supabase/migrations/20250101000026_exact_match_overdue_function.sql
84. supabase/migrations/20250101000027_simple_overdue_function.sql
85. supabase/migrations/20250101000028_working_overdue_function.sql
86. supabase/migrations/20250101000029_add_loan_deletion.sql
87. supabase/migrations/20250101000030_update_bad_debt_criteria.sql
88. supabase/migrations/20250101000031_add_group_status_management.sql
89. supabase/migrations/20250101000032_add_branch_status_management.sql
90. supabase/migrations/20250101000033_add_user_status_management.sql
```

#### Batch 13: Latest Migration

```bash
91. supabase/migrations/20250930083320_99af9092-ad98-4213-9bf9-a8470199e8b5.sql
```

## How to Apply Migrations

### Method 1: Manual via SQL Editor (Recommended)

1. Open Supabase SQL Editor
2. For each migration file:
   - Click **New Query**
   - Copy the entire file content
   - Paste into the editor
   - Click **Run**
3. Wait for success message
4. Move to next migration

### Method 2: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Link to your project
supabase link --project-ref imkdmwsukojuhzjlmyfh

# Push all migrations
supabase db push
```

## Step 3: Create Storage Bucket

After migrations complete, run this SQL:

```sql
-- Create storage bucket for member avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('member-avatars', 'member-avatars', true);

-- Allow authenticated uploads
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'member-avatars');

-- Allow authenticated reads
CREATE POLICY "Allow authenticated reads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'member-avatars');
```

## Step 4: Create Initial Data

Run these SQL commands:

```sql
-- Create first branch
INSERT INTO public.branches (name, code, location, is_active)
VALUES ('Main Branch', 'MB-001', 'Nairobi', true);

-- Create organization  
INSERT INTO public.organizations (name, code)
VALUES ('Lendy Microfinance', 'LEN-001');

-- Create penalty policy
INSERT INTO public.penalty_policies (name, penalty_type, rate_per_day, grace_days)
VALUES ('Standard Late Fee', 'percentage', 0.0005, 0);

-- Create loan products
INSERT INTO public.loan_products (name, min_amount, max_amount, interest_rate, min_term_months, max_term_months, interest_method, requires_collateral)
VALUES 
  ('Agricultural Loan', 5000, 100000, 0.02, 6, 24, 'reducing_balance', false),
  ('Business Loan', 10000, 500000, 0.025, 12, 60, 'reducing_balance', true),
  ('Emergency Loan', 1000, 25000, 0.035, 3, 12, 'reducing_balance', false);
```

## Step 5: Deploy Edge Functions

### Using Supabase Dashboard:

1. Go to **Edge Functions** in your Supabase dashboard
2. For each function, click **Create Function**
3. Copy the code from the corresponding file
4. Paste and deploy

**Functions to deploy:**
- `create-user`
- `delete-user`
- `reset-user-password`
- `disable-user-mfa`
- `create-loan-officer`

### Using CLI:

```bash
supabase functions deploy create-user
supabase functions deploy delete-user
supabase functions deploy reset-user-password
supabase functions deploy disable-user-mfa
supabase functions deploy create-loan-officer
```

## Troubleshooting

### Error: "relation already exists"
- This migration has already been applied
- Skip it and move to the next

### Error: "column already exists"
- Partial migration was applied
- Continue with next migration

### Error: "function does not exist"
- Dependent function needs to be created first
- Apply the required migration first

## Estimated Time

- Migrations: 30-60 minutes
- Edge Functions: 10 minutes
- Initial Data: 5 minutes
- Testing: 15-30 minutes

**Total: ~1-2 hours**

## Next Steps After Setup

1. Test the application locally: `npm run dev`
2. Create your first user via Auth
3. Test creating a branch
4. Test creating a member
5. Test creating a loan

