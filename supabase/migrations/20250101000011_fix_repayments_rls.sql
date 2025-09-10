-- Fix RLS policies for loan_payments table (the actual table being used)
-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Branch access for repayments" ON public.repayments;
DROP POLICY IF EXISTS "Authenticated users can insert repayments" ON public.repayments;
DROP POLICY IF EXISTS "Authenticated users can view repayments" ON public.repayments;

-- Create simplified RLS policies for loan_payments table
CREATE POLICY "Authenticated users can view all loan payments" ON public.loan_payments
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert loan payments" ON public.loan_payments
FOR INSERT TO authenticated
WITH CHECK (
    created_by = auth.uid()
    AND loan_id IS NOT NULL
);

CREATE POLICY "Authenticated users can update loan payments" ON public.loan_payments
FOR UPDATE TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Authenticated users can delete loan payments" ON public.loan_payments
FOR DELETE TO authenticated
USING (created_by = auth.uid());
