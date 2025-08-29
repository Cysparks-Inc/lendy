-- Migration: Fix payment validation function
-- This removes the incorrect validation that prevents paying multiple installments at once

-- Drop the existing validation trigger and function
DROP TRIGGER IF EXISTS trigger_validate_payment_amount ON public.loan_payments;
DROP FUNCTION IF EXISTS validate_payment_amount();

-- Create a new, corrected validation function
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

-- Recreate the trigger with the corrected validation function
CREATE TRIGGER trigger_validate_payment_amount
    BEFORE INSERT ON public.loan_payments
    FOR EACH ROW
    EXECUTE FUNCTION validate_payment_amount();

-- Update the payment distribution function to handle larger payments better
CREATE OR REPLACE FUNCTION distribute_payment_across_installments(
    p_loan_id UUID,
    p_amount DECIMAL(15,2)
)
RETURNS BOOLEAN AS $$
DECLARE
    remaining_amount DECIMAL(15,2);
    current_installment RECORD;
    amount_to_apply DECIMAL(15,2);
BEGIN
    remaining_amount := p_amount;
    
    -- Get unpaid installments ordered by due date
    FOR current_installment IN 
        SELECT * FROM public.loan_installments 
        WHERE loan_id = p_loan_id 
        AND is_paid = false 
        ORDER BY installment_number
    LOOP
        -- Calculate how much to apply to this installment
        amount_to_apply := LEAST(
            remaining_amount, 
            current_installment.total_amount - current_installment.amount_paid
        );
        
        -- Apply payment to installment
        UPDATE public.loan_installments 
        SET 
            amount_paid = amount_paid + amount_to_apply,
            is_paid = (amount_paid + amount_to_apply) >= total_amount,
            paid_date = CASE 
                WHEN (amount_paid + amount_to_apply) >= total_amount THEN CURRENT_DATE
                ELSE paid_date
            END,
            updated_at = NOW()
        WHERE id = current_installment.id;
        
        -- Reduce remaining amount
        remaining_amount := remaining_amount - amount_to_apply;
        
        -- If no more amount to distribute, break
        IF remaining_amount <= 0 THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the updated function
GRANT EXECUTE ON FUNCTION distribute_payment_across_installments(UUID, DECIMAL) TO authenticated;
