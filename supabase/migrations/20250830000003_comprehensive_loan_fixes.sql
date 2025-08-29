-- Migration: Comprehensive Loan System Fixes
-- This migration fixes RLS policy violations, improves member search, and ensures processing fees are tracked

-- 1. Fix RLS Policy for loan_installments table
-- The issue is that the trigger function create_loan_installments() runs in database context, not user context
-- We need to make the function SECURITY DEFINER and adjust the RLS policies

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
        weekly_interest := NEW.interest_disbursed / installment_count;
        
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
-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view loan installments for accessible loans" ON public.loan_installments;
DROP POLICY IF EXISTS "Users can update loan installments for accessible loans" ON public.loan_installments;
DROP POLICY IF EXISTS "System can insert loan installments" ON public.loan_installments;
DROP POLICY IF EXISTS "Users can insert loan installments for accessible loans" ON public.loan_installments;
DROP POLICY IF EXISTS "Users can delete loan installments for accessible loans" ON public.loan_installments;

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
-- Drop existing policy first to avoid conflicts
DROP POLICY IF EXISTS "System can insert loan installments" ON public.loan_installments;
CREATE POLICY "System can insert loan installments" ON public.loan_installments
    FOR INSERT WITH CHECK (true); -- Allow system functions to insert

-- Add DELETE policy for loan_installments
CREATE POLICY "Users can delete loan installments for accessible loans" ON public.loan_installments
    FOR DELETE USING (
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

-- 3. Improve member search reliability by creating a more robust search function
-- Drop existing function first to avoid conflicts
DROP FUNCTION IF EXISTS search_members_robust(TEXT, UUID);
CREATE OR REPLACE FUNCTION search_members_robust(search_term TEXT, current_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
    id UUID,
    full_name TEXT,
    id_number TEXT,
    phone_number TEXT,
    branch_id BIGINT,
    group_id BIGINT,
    branch_name TEXT,
    group_name TEXT,
    status TEXT,
    activation_fee_paid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.full_name,
        m.id_number,
        m.phone_number,
        m.branch_id,
        m.group_id,
        b.name as branch_name,
        g.name as group_name,
        m.status,
        m.activation_fee_paid
    FROM public.members m
    LEFT JOIN public.branches b ON m.branch_id = b.id
    LEFT JOIN public.groups g ON m.group_id = g.id
    WHERE (
        m.full_name ILIKE '%' || search_term || '%' OR
        m.id_number ILIKE '%' || search_term || '%' OR
        m.phone_number ILIKE '%' || search_term || '%'
    )
    AND m.status = 'active'
    AND m.activation_fee_paid = true
    AND (
        -- User can access this member based on their role
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = current_user_id
            AND p.role = 'super_admin'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = current_user_id
            AND p.role = 'branch_manager'
            AND p.branch_id = m.branch_id
        )
        OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = current_user_id
            AND p.role = 'loan_officer'
            AND p.id = m.assigned_officer_id
        )
        OR
        m.branch_id = ANY(
            SELECT ubr.branch_id FROM public.user_branch_roles ubr
            WHERE ubr.user_id = current_user_id AND ubr.is_active = true
        )
    )
    ORDER BY m.full_name
    LIMIT 20;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_members_robust(TEXT, UUID) TO authenticated;

-- 4. Ensure processing fee is always calculated and stored correctly
-- Update the loan creation trigger to always calculate and store processing fee
-- Drop existing trigger first, then function to avoid dependency conflicts
DROP TRIGGER IF EXISTS trigger_ensure_processing_fee ON public.loans;
DROP FUNCTION IF EXISTS ensure_processing_fee() CASCADE;

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
CREATE TRIGGER trigger_ensure_processing_fee
    BEFORE INSERT OR UPDATE ON public.loans
    FOR EACH ROW
    EXECUTE FUNCTION ensure_processing_fee();

-- 5. Create a function to record processing fee income automatically
-- Drop existing trigger first, then function to avoid dependency conflicts
DROP TRIGGER IF EXISTS trigger_record_processing_fee_income ON public.loans;
DROP FUNCTION IF EXISTS record_processing_fee_income() CASCADE;

CREATE OR REPLACE FUNCTION record_processing_fee_income()
RETURNS TRIGGER AS $$
BEGIN
    -- Only record income for new loans
    IF TG_OP = 'INSERT' AND NEW.processing_fee > 0 THEN
        -- Insert into transactions table using correct column names
        INSERT INTO public.transactions (
            transaction_type,
            amount,
            description,
            loan_id,
            member_id,
            branch_id,
            created_by,
            transaction_date,
            reference_number,
            payment_method,
            currency
        ) VALUES (
            'fee',
            NEW.processing_fee,
            'Loan Processing Fee - ' || COALESCE(NEW.loan_program, 'unknown'),
            NEW.id,
            NEW.customer_id,
            NEW.branch_id,
            NEW.created_by,
            NEW.issue_date,
            'PF-' || NEW.id::text,
            'cash',
            'KES'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically record processing fee income
CREATE TRIGGER trigger_record_processing_fee_income
    AFTER INSERT ON public.loans
    FOR EACH ROW
    EXECUTE FUNCTION record_processing_fee_income();

-- 6. Update the existing payment validation function to work with the new system
-- This was already fixed in the previous migration, but let's ensure it's working
-- Drop existing trigger first, then function to avoid dependency conflicts
DROP TRIGGER IF EXISTS trigger_validate_payment_amount ON public.loan_payments;
DROP FUNCTION IF EXISTS validate_payment_amount() CASCADE;

CREATE OR REPLACE FUNCTION validate_payment_amount()
RETURNS TRIGGER AS $$
DECLARE
    loan_record RECORD;
BEGIN
    -- Get loan details
    SELECT 
        principal_amount,
        interest_disbursed,
        total_paid,
        current_balance
    INTO loan_record
    FROM public.loans
    WHERE id = NEW.loan_id;
    
    -- Only validate that payment doesn't exceed the total outstanding balance
    -- Users should be able to pay multiple installments at once
    IF NEW.amount > loan_record.current_balance THEN
        RAISE EXCEPTION 'Payment amount KES % exceeds the current outstanding balance (KES %)', 
            NEW.amount, loan_record.current_balance;
    END IF;
    
    -- Validate that payment amount is positive
    IF NEW.amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than 0';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists
CREATE TRIGGER trigger_validate_payment_amount
    BEFORE INSERT ON public.loan_payments
    FOR EACH ROW
    EXECUTE FUNCTION validate_payment_amount();

-- 7. Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_loan_installments() TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_processing_fee() TO authenticated;
GRANT EXECUTE ON FUNCTION record_processing_fee_income() TO authenticated;
GRANT EXECUTE ON FUNCTION search_members_robust(TEXT, UUID) TO authenticated;

-- 8. Create an index to improve member search performance
-- Drop existing index first to avoid conflicts
DROP INDEX IF EXISTS idx_members_search;
CREATE INDEX idx_members_search ON public.members 
USING gin(to_tsvector('english', full_name || ' ' || COALESCE(id_number, '') || ' ' || COALESCE(phone_number, '')));

-- 9. Add a comment to document the processing fee structure
COMMENT ON COLUMN public.loans.processing_fee IS 'Processing fee is automatically calculated as 6% of principal amount';
COMMENT ON COLUMN public.loans.total_disbursed IS 'Total amount disbursed including principal, interest, and processing fee';
