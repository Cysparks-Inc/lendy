-- Migration: Fix payment balance calculations to exclude processing fee
-- Processing fees are income, NOT part of loan repayment
-- This updates payment-related functions to exclude processing fee from balance calculations

-- 1. Fix update_loan_balance_on_payment function to exclude processing fee
DROP TRIGGER IF EXISTS trigger_update_loan_balance_on_payment ON public.loan_payments;
DROP FUNCTION IF EXISTS update_loan_balance_on_payment() CASCADE;

CREATE OR REPLACE FUNCTION update_loan_balance_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    loan_record RECORD;
    total_loan_amount DECIMAL(15,2);
BEGIN
    RAISE NOTICE 'Trigger fired for loan_id: %, amount: %', NEW.loan_id, NEW.amount;
    
    -- Get the loan details
    SELECT * INTO loan_record FROM public.loans WHERE id = NEW.loan_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Loan with id % not found', NEW.loan_id;
    END IF;
    
    -- Calculate the total loan amount (principal + interest only, processing fee excluded)
    total_loan_amount := COALESCE(loan_record.principal_amount, 0) + 
                        COALESCE(loan_record.interest_disbursed, 0);
    
    RAISE NOTICE 'Loan details: principal=%, interest=%, processing_fee=%, total_amount=%', 
        loan_record.principal_amount, loan_record.interest_disbursed, loan_record.processing_fee, total_loan_amount;
    
    -- Distribute the payment across installments
    PERFORM distribute_payment_across_installments(NEW.loan_id, NEW.amount);
    RAISE NOTICE 'Payment distributed successfully';
    
    -- Update the loan's total_paid and current_balance (excluding processing fee)
    UPDATE public.loans 
    SET 
        total_paid = loan_record.total_paid + NEW.amount,
        current_balance = total_loan_amount - (loan_record.total_paid + NEW.amount),
        updated_at = NOW()
    WHERE id = NEW.loan_id;
    
    RAISE NOTICE 'Loan balance updated: total_paid=%, current_balance=%', 
        loan_record.total_paid + NEW.amount, total_loan_amount - (loan_record.total_paid + NEW.amount);
    
    -- Check if loan is fully paid and update status (based on principal + interest only)
    UPDATE public.loans 
    SET status = 'repaid'
    WHERE id = NEW.loan_id 
    AND (loan_record.total_paid + NEW.amount) >= total_loan_amount;
    
    RAISE NOTICE 'Trigger function completed successfully';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER trigger_update_loan_balance_on_payment
    AFTER INSERT ON public.loan_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_loan_balance_on_payment();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_loan_balance_on_payment() TO authenticated;

-- 2. Fix any existing loans that have incorrect total_paid (including processing fee)
-- This corrects loans where total_paid was incorrectly set to include processing fee
UPDATE public.loans 
SET 
    total_paid = GREATEST(0, total_paid - COALESCE(processing_fee, 0)),
    current_balance = CASE 
        WHEN (principal_amount + COALESCE(interest_disbursed, 0)) - GREATEST(0, total_paid - COALESCE(processing_fee, 0)) < 0 
        THEN 0 
        ELSE (principal_amount + COALESCE(interest_disbursed, 0)) - GREATEST(0, total_paid - COALESCE(processing_fee, 0))
    END,
    status = CASE 
        WHEN GREATEST(0, total_paid - COALESCE(processing_fee, 0)) >= (principal_amount + COALESCE(interest_disbursed, 0))
        THEN 'repaid'
        ELSE status
    END
WHERE total_paid > (principal_amount + COALESCE(interest_disbursed, 0))
AND processing_fee > 0;

-- 3. Fix validate_payment_amount function if it exists and includes processing fee
-- Drop and recreate the function to exclude processing fee
DROP FUNCTION IF EXISTS validate_payment_amount() CASCADE;

CREATE OR REPLACE FUNCTION validate_payment_amount()
RETURNS TRIGGER AS $$
DECLARE
    loan_record RECORD;
    total_loan_amount DECIMAL(15,2);
BEGIN
    -- Get loan details
    SELECT * INTO loan_record FROM public.loans WHERE id = NEW.loan_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Loan with id % not found', NEW.loan_id;
    END IF;
    
    -- Calculate total loan amount (principal + interest only, processing fee excluded)
    total_loan_amount := COALESCE(loan_record.principal_amount, 0) + 
                        COALESCE(loan_record.interest_disbursed, 0);
    
    -- Validate payment doesn't exceed remaining balance (excluding processing fee)
    IF NEW.amount > loan_record.current_balance THEN
        RAISE EXCEPTION 'Payment amount (%) exceeds remaining balance (%)', 
            NEW.amount, loan_record.current_balance;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger if it was dropped
DROP TRIGGER IF EXISTS trigger_validate_payment_amount ON public.loan_payments;
CREATE TRIGGER trigger_validate_payment_amount
    BEFORE INSERT ON public.loan_payments
    FOR EACH ROW
    EXECUTE FUNCTION validate_payment_amount();

GRANT EXECUTE ON FUNCTION validate_payment_amount() TO authenticated;

