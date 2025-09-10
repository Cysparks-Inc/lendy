-- Migration: Fix processing fee and registration fee status to be 'completed'
-- Processing fees and registration fees are money coming in and should be marked as completed

-- 1. Update existing processing fees to completed status
UPDATE public.transactions 
SET status = 'completed' 
WHERE transaction_type = 'fee' 
  AND description ILIKE '%Processing Fee%'
  AND status = 'pending';

-- 2. Update existing registration fees to completed status  
UPDATE public.transactions 
SET status = 'completed' 
WHERE transaction_type = 'fee' 
  AND description ILIKE '%Registration Fee%'
  AND status = 'pending';

-- 3. Update the trigger function to set fees as completed by default
DROP TRIGGER IF EXISTS trigger_record_processing_fee_income ON public.loans;
DROP FUNCTION IF EXISTS record_processing_fee_income() CASCADE;

CREATE OR REPLACE FUNCTION record_processing_fee_income()
RETURNS TRIGGER AS $$
BEGIN
    -- Only record income for new loans
    IF TG_OP = 'INSERT' AND NEW.processing_fee > 0 THEN
        -- Insert into transactions table with completed status
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
            currency,
            status
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
            'KES',
            'completed'  -- Set as completed since it's money coming in
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_record_processing_fee_income
    AFTER INSERT ON public.loans
    FOR EACH ROW
    EXECUTE FUNCTION record_processing_fee_income();
