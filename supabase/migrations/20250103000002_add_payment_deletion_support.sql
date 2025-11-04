-- Migration: Add support for payment deletion with proper balance reversion
-- This allows users to delete payments and automatically reverts loan balances

-- Function to revert payment from loan balance and installments
CREATE OR REPLACE FUNCTION revert_payment_from_loan(
  p_loan_payment_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_payment RECORD;
  v_loan_id UUID;
  v_payment_amount DECIMAL(15,2);
  v_interest_amount DECIMAL(15,2);
  v_payment_date DATE;
  v_remaining_amount DECIMAL(15,2);
  v_installment RECORD;
  v_amount_to_revert DECIMAL(15,2);
BEGIN
  -- Get the payment details before it's deleted
  SELECT loan_id, amount, payment_date
  INTO v_payment
  FROM public.loan_payments
  WHERE id = p_loan_payment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment with id % not found', p_loan_payment_id;
  END IF;
  
  v_loan_id := v_payment.loan_id;
  v_payment_amount := v_payment.amount;
  v_payment_date := v_payment.payment_date;
  v_remaining_amount := v_payment_amount;
  
  -- Calculate interest amount from installments that were paid on this payment date
  -- This is an approximation - we'll use the interest portion from the installments
  SELECT COALESCE(SUM(interest_amount), 0)
  INTO v_interest_amount
  FROM public.loan_installments
  WHERE loan_id = v_loan_id
  AND paid_date = v_payment_date
  AND amount_paid > 0;
  
  -- If we can't determine interest from installments, set to 0
  -- The income deletion will still work based on loan_id and date
  v_interest_amount := COALESCE(v_interest_amount, 0);
  
  -- Revert payment from installments (in reverse order of payment)
  -- Get installments that were paid, ordered by paid_date DESC (most recently paid first)
  FOR v_installment IN 
    SELECT * FROM public.loan_installments 
    WHERE loan_id = v_loan_id 
    AND amount_paid > 0
    ORDER BY paid_date DESC NULLS LAST, installment_number DESC
  LOOP
    IF v_remaining_amount <= 0 THEN
      EXIT;
    END IF;
    
    -- Calculate how much to revert from this installment
    v_amount_to_revert := LEAST(v_remaining_amount, v_installment.amount_paid);
    
    -- Revert the payment from the installment
    UPDATE public.loan_installments 
    SET 
      amount_paid = GREATEST(0, amount_paid - v_amount_to_revert),
      is_paid = CASE 
        WHEN (amount_paid - v_amount_to_revert) >= total_amount THEN true
        WHEN (amount_paid - v_amount_to_revert) < total_amount THEN false
        ELSE is_paid
      END,
      paid_date = CASE 
        WHEN (amount_paid - v_amount_to_revert) < total_amount THEN NULL
        ELSE paid_date
      END,
      updated_at = NOW()
    WHERE id = v_installment.id;
    
    v_remaining_amount := v_remaining_amount - v_amount_to_revert;
  END LOOP;
  
  -- Revert the loan balance
  UPDATE public.loans 
  SET 
    total_paid = GREATEST(0, total_paid - v_payment_amount),
    current_balance = current_balance + v_payment_amount,
    status = CASE 
      WHEN (current_balance + v_payment_amount) > 0 AND status = 'repaid' THEN 'active'
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = v_loan_id;
  
  -- Delete income entries if they exist in the income table
  -- Note: Income is typically calculated dynamically from loan_payments,
  -- but if there's a separate income table, we need to remove entries
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'income'
  ) THEN
    -- Delete income entry associated with this payment
    -- Match by loan_payment_id if that column exists, or by loan_id, date, and interest amount
    DELETE FROM public.income 
    WHERE (
      EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'income' 
        AND column_name = 'loan_payment_id'
      )
      AND loan_payment_id = p_loan_payment_id
    ) OR (
      loan_id = v_loan_id 
      AND transaction_date = v_payment_date
      AND ABS(amount - v_interest_amount) < 0.01 -- Match interest amount (within 1 cent tolerance)
      AND source = 'interest'
    );
  END IF;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION revert_payment_from_loan(UUID) TO authenticated;

-- Trigger to automatically revert loan balance when payment is deleted
CREATE OR REPLACE FUNCTION trigger_revert_payment_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Revert the payment before deletion
  PERFORM revert_payment_from_loan(OLD.id);
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for payment deletion
DROP TRIGGER IF EXISTS trigger_revert_payment_on_delete ON public.loan_payments;
CREATE TRIGGER trigger_revert_payment_on_delete
    BEFORE DELETE ON public.loan_payments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_revert_payment_on_delete();

-- Update RLS policy to allow deletion ONLY for admins and super admins
DROP POLICY IF EXISTS "Only super admins can delete payments" ON public.loan_payments;
DROP POLICY IF EXISTS "Users can delete payments they have access to" ON public.loan_payments;
DROP POLICY IF EXISTS "Only admins can delete payments" ON public.loan_payments;
CREATE POLICY "Only admins can delete payments" ON public.loan_payments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND (p.role = 'super_admin' OR p.role = 'admin')
        )
    );

