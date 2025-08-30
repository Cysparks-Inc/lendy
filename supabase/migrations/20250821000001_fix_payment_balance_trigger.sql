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
BEGIN
    -- First, distribute the payment across installments
    PERFORM distribute_payment_across_installments(NEW.loan_id, NEW.amount);
    
    -- Update the loan's total_paid and current_balance
    UPDATE public.loans 
    SET 
        total_paid = total_paid + NEW.amount,
        current_balance = current_balance - NEW.amount,
        updated_at = NOW()
    WHERE id = NEW.loan_id;
    
    -- Check if loan is fully paid
    UPDATE public.loans 
    SET status = 'repaid'
    WHERE id = NEW.loan_id 
    AND current_balance <= 0;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_loan_balance_on_payment() TO authenticated;
