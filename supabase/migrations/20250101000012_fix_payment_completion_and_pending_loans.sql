-- Fix payment completion logic and pending loan validation
-- This migration addresses overpayment handling and loan status updates

-- 1. Fix the member_has_pending_loans function to check both member_id and customer_id
CREATE OR REPLACE FUNCTION public.member_has_pending_loans(_member_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.loans 
        WHERE (member_id = _member_id OR customer_id = _member_id)
        AND status IN ('pending', 'active', 'disbursed')
        AND current_balance > 0
    );
$$;

-- 2. Create a better payment balance update function that handles overpayments correctly
CREATE OR REPLACE FUNCTION update_loan_balance_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    loan_record RECORD;
    new_balance DECIMAL(15,2);
    total_loan_amount DECIMAL(15,2);
BEGIN
    RAISE NOTICE 'Payment trigger fired for loan_id: %, amount: %', NEW.loan_id, NEW.amount;
    
    -- Get the loan details
    SELECT * INTO loan_record FROM public.loans WHERE id = NEW.loan_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Loan with id % not found', NEW.loan_id;
    END IF;
    
    -- Calculate the total loan amount (principal + interest + processing fee)
    total_loan_amount := COALESCE(loan_record.principal_amount, 0) + 
                        COALESCE(loan_record.interest_disbursed, 0) + 
                        COALESCE(loan_record.processing_fee, 0);
    
    RAISE NOTICE 'Loan details: principal=%, interest=%, processing_fee=%, total_amount=%', 
        loan_record.principal_amount, loan_record.interest_disbursed, loan_record.processing_fee, total_loan_amount;
    
    -- Calculate new balance (prevent negative balances)
    new_balance := GREATEST(0, loan_record.current_balance - NEW.amount);
    
    RAISE NOTICE 'Current balance: %, payment: %, new balance: %', 
        loan_record.current_balance, NEW.amount, new_balance;
    
    -- Update the loan with proper balance handling
    UPDATE public.loans 
    SET 
        total_paid = LEAST(total_loan_amount, total_paid + NEW.amount),
        current_balance = new_balance,
        status = CASE 
            WHEN new_balance <= 0 THEN 'repaid'
            ELSE status
        END,
        updated_at = NOW()
    WHERE id = NEW.loan_id;
    
    RAISE NOTICE 'Loan updated: new_balance=%, status will be repaid=%', 
        new_balance, (new_balance <= 0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Drop and recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS trigger_update_loan_balance_on_payment ON public.loan_payments;

CREATE TRIGGER trigger_update_loan_balance_on_payment
    AFTER INSERT ON public.loan_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_loan_balance_on_payment();

-- 4. Grant execute permission
GRANT EXECUTE ON FUNCTION update_loan_balance_on_payment() TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_has_pending_loans(UUID) TO authenticated;

-- 5. Fix any existing loans with negative balances
UPDATE public.loans 
SET 
    current_balance = 0,
    status = 'repaid',
    total_paid = principal_amount + COALESCE(interest_disbursed, 0) + COALESCE(processing_fee, 0)
WHERE current_balance < 0;

-- 6. Fix any loans that should be repaid but aren't marked as such
UPDATE public.loans 
SET status = 'repaid'
WHERE current_balance <= 0 
AND status IN ('active', 'disbursed', 'pending');
