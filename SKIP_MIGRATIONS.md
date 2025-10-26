# Migrations to Skip During Initial Setup

These migrations have dependencies that don't exist yet when running in chronological order.
They can be run later or skipped if their functionality isn't immediately needed.

## Skip These Migrations:

1. **20250101000013_create_installment_overdue_function.sql** - Requires `loan_installments` table (doesn't exist yet)
2. **20250101000020_unified_overdue_calculation.sql** - Requires `loan_payments` table (created later)
3. **20250101000023_final_overdue_function.sql** - Requires `loan_payments` table (created later)
4. **20250101000024_simple_overdue_function.sql** - Requires `loan_payments` table
5. **20250101000025_drop_and_recreate_overdue_function.sql** - Requires `loan_payments` table
6. **20250101000026_exact_match_overdue_function.sql** - Requires `loan_payments` table
7. **20250101000027_simple_overdue_function.sql** - Requires `loan_payments` table
8. **20250101000028_working_overdue_function.sql** - Requires `loan_payments` table

## When to Run Them:

These migrations should be run **after** you run:
- Migration 83: 20250827000002_create_loan_payments_table.sql

## Migration Order Issue:

The problem is:
- These early "20250101*" migrations reference tables that are created later in "20250827*" migrations
- They're dated Jan 1, 2025 but should run after migrations from Aug 27, 2025

## Solution:

Run the "20250827*" migrations first, then come back to the "20250101*" overdue functions later.

