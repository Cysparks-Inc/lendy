-- Migration: Exclude processing fee from loan repayment amount
-- Processing fees should be treated like registration fees - they are income but NOT part of loan repayment
-- This ensures processing fee is NOT included in total_disbursed or current_balance

-- Update the ensure_processing_fee function to exclude processing fee from repayment calculations
DROP TRIGGER IF EXISTS trigger_ensure_processing_fee ON public.loans;
DROP FUNCTION IF EXISTS ensure_processing_fee() CASCADE;

CREATE OR REPLACE FUNCTION ensure_processing_fee()
RETURNS TRIGGER AS $$
BEGIN
    -- Always ensure processing fee is calculated as 6% of principal
    IF NEW.processing_fee IS NULL OR NEW.processing_fee = 0 THEN
        NEW.processing_fee := ROUND(NEW.principal_amount * 0.06, 2);
    END IF;
    
    -- Ensure total_disbursed does NOT include processing fee (only principal + interest)
    -- Processing fee is income, not part of loan repayment
    IF NEW.total_disbursed IS NULL OR NEW.total_disbursed = 0 THEN
        NEW.total_disbursed := NEW.principal_amount + COALESCE(NEW.interest_disbursed, 0);
    END IF;
    
    -- Ensure current_balance is set correctly (only principal + interest, excluding processing fee)
    IF NEW.current_balance IS NULL OR NEW.current_balance = 0 THEN
        NEW.current_balance := NEW.total_disbursed;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger to ensure processing fee is always set
CREATE TRIGGER trigger_ensure_processing_fee
    BEFORE INSERT OR UPDATE ON public.loans
    FOR EACH ROW
    EXECUTE FUNCTION ensure_processing_fee();

-- Update the comment to reflect the new behavior
COMMENT ON COLUMN public.loans.processing_fee IS 'Processing fee is automatically calculated as 6% of principal amount. It is income but NOT part of loan repayment.';
COMMENT ON COLUMN public.loans.total_disbursed IS 'Total amount to be repaid including principal and interest only (processing fee excluded)';
COMMENT ON COLUMN public.loans.current_balance IS 'Current outstanding balance (principal + interest only, processing fee excluded)';

