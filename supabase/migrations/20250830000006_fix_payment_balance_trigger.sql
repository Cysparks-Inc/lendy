-- Fix payment balance trigger to ensure it works with the updated function
-- This migration ensures the trigger is properly recreated after function updates

-- Drop the existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_loan_balance_on_payment ON public.loan_payments;

-- Recreate the trigger to ensure it uses the updated function
CREATE TRIGGER trigger_update_loan_balance_on_payment
    AFTER INSERT ON public.loan_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_loan_balance_on_payment();

-- Also ensure the function exists and is working
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
    
    -- Calculate the total loan amount (principal + interest + processing fee)
    total_loan_amount := COALESCE(loan_record.principal_amount, 0) + 
                        COALESCE(loan_record.interest_disbursed, 0) + 
                        COALESCE(loan_record.processing_fee, 0);
    
    RAISE NOTICE 'Loan details: principal=%, interest=%, processing_fee=%, total_amount=%', 
        loan_record.principal_amount, loan_record.interest_disbursed, loan_record.processing_fee, total_loan_amount;
    
    -- Distribute the payment across installments
    PERFORM distribute_payment_across_installments(NEW.loan_id, NEW.amount);
    RAISE NOTICE 'Payment distributed successfully';
    
    -- Update the loan's total_paid and current_balance - FIXED: Calculate outstanding balance correctly
    UPDATE public.loans 
    SET 
        total_paid = loan_record.total_paid + NEW.amount,
        current_balance = total_loan_amount - (loan_record.total_paid + NEW.amount),
        updated_at = NOW()
    WHERE id = NEW.loan_id;
    
    RAISE NOTICE 'Loan balance updated: total_paid=%, current_balance=%', 
        loan_record.total_paid + NEW.amount, total_loan_amount - (loan_record.total_paid + NEW.amount);
    
    -- Check if loan is fully paid and update status
    UPDATE public.loans 
    SET status = 'repaid'
    WHERE id = NEW.loan_id 
    AND (loan_record.total_paid + NEW.amount) >= total_loan_amount;
    
    RAISE NOTICE 'Trigger function completed successfully';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_loan_balance_on_payment() TO authenticated;
