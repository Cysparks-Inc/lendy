-- Simplified Migration: Fix RLS Policy Violation for loan_installments
-- Run this in your Supabase SQL Editor to fix the immediate issue

-- 1. Fix RLS Policy for loan_installments table
-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_create_loan_installments ON public.loans;
DROP FUNCTION IF EXISTS create_loan_installments();

-- Create a new SECURITY DEFINER function that can bypass RLS
CREATE OR REPLACE FUNCTION create_loan_installments()
RETURNS TRIGGER AS $$
DECLARE
    installment_count INTEGER;
    weekly_principal DECIMAL(15,2);
    weekly_interest DECIMAL(15,2);
    start_date DATE;
    i INTEGER;
BEGIN
    -- Only proceed if this is a new loan
    IF TG_OP = 'INSERT' THEN
        -- Determine installment count based on loan program
        IF NEW.loan_program = 'small_loan' THEN
            installment_count := 8; -- 8 weeks
        ELSIF NEW.loan_program = 'big_loan' THEN
            installment_count := 12; -- 12 weeks
        ELSE
            -- Default to weekly installments
            installment_count := 8;
        END IF;
        
        -- Calculate amounts per installment
        weekly_principal := NEW.principal_amount / installment_count;
        weekly_interest := COALESCE(NEW.interest_disbursed, 0) / installment_count;
        
        -- Set start date
        start_date := NEW.issue_date;
        
        -- Create installments using SECURITY DEFINER context
        FOR i IN 1..installment_count LOOP
            INSERT INTO public.loan_installments (
                loan_id,
                installment_number,
                due_date,
                principal_amount,
                interest_amount,
                total_amount
            ) VALUES (
                NEW.id,
                i,
                start_date + (i * 7), -- Add weeks
                weekly_principal,
                weekly_interest,
                weekly_principal + weekly_interest
            );
            
            -- Move to next week
            start_date := start_date + 7;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER trigger_create_loan_installments
    AFTER INSERT ON public.loans
    FOR EACH ROW
    EXECUTE FUNCTION create_loan_installments();

-- 2. Fix RLS policies for loan_installments to allow the trigger function to work
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view loan installments for accessible loans" ON public.loan_installments;
DROP POLICY IF EXISTS "Users can update loan installments for accessible loans" ON public.loan_installments;

-- Create new, more permissive policies that work with the trigger function
CREATE POLICY "Users can view loan installments for accessible loans" ON public.loan_installments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.loans l
            WHERE l.id = loan_installments.loan_id
            AND (
                l.loan_officer_id = auth.uid() OR
                l.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                    AND p.role IN ('super_admin', 'branch_manager')
                )
            )
        )
    );

CREATE POLICY "Users can update loan installments for accessible loans" ON public.loan_installments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.loans l
            WHERE l.id = loan_installments.loan_id
            AND (
                l.loan_officer_id = auth.uid() OR
                l.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                    AND p.role IN ('super_admin', 'branch_manager')
                )
            )
        )
    );

-- Add INSERT policy for loan_installments (needed for the trigger function)
CREATE POLICY "System can insert loan installments" ON public.loan_installments
    FOR INSERT WITH CHECK (true); -- Allow system functions to insert

-- 3. Ensure processing fee is always calculated and stored correctly
-- Update the loan creation trigger to always calculate and store processing fee
CREATE OR REPLACE FUNCTION ensure_processing_fee()
RETURNS TRIGGER AS $$
BEGIN
    -- Always ensure processing fee is calculated as 6% of principal
    IF NEW.processing_fee IS NULL OR NEW.processing_fee = 0 THEN
        NEW.processing_fee := ROUND(NEW.principal_amount * 0.06, 2);
    END IF;
    
    -- Ensure total_disbursed includes processing fee
    IF NEW.total_disbursed IS NULL OR NEW.total_disbursed = 0 THEN
        NEW.total_disbursed := NEW.principal_amount + COALESCE(NEW.interest_disbursed, 0) + NEW.processing_fee;
    END IF;
    
    -- Ensure current_balance is set correctly
    IF NEW.current_balance IS NULL OR NEW.current_balance = 0 THEN
        NEW.current_balance := NEW.total_disbursed;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure processing fee is always set
DROP TRIGGER IF EXISTS trigger_ensure_processing_fee ON public.loans;
CREATE TRIGGER trigger_ensure_processing_fee
    BEFORE INSERT OR UPDATE ON public.loans
    FOR EACH ROW
    EXECUTE FUNCTION ensure_processing_fee();

-- 4. Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_loan_installments() TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_processing_fee() TO authenticated;
