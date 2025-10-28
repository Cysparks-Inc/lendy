-- Fix the set_loan_approval_status function to use member_id instead of customer_id
-- This fixes the "column customer_id does not exist" error when approving loans

CREATE OR REPLACE FUNCTION public.set_loan_approval_status(
  p_loan_id UUID,
  p_status TEXT,
  p_set_by UUID
) RETURNS VOID AS $$
DECLARE
  v_processing_fee DECIMAL(15,2);
  v_branch_id UUID;  -- Changed from INT to UUID
  v_member_id UUID;  -- Changed from v_customer_id to v_member_id
BEGIN
  IF p_status NOT IN ('approved','rejected','pending') THEN
    RAISE EXCEPTION 'Invalid approval status %', p_status;
  END IF;

  -- Update loan approval status
  UPDATE public.loans
  SET approval_status = p_status,
      updated_at = NOW()
  WHERE id = p_loan_id;

  -- Only on approval: book processing fee in transactions if table exists
  IF p_status = 'approved' THEN
    -- Fixed: Use member_id instead of customer_id
    SELECT processing_fee, branch_id, member_id
    INTO v_processing_fee, v_branch_id, v_member_id
    FROM public.loans
    WHERE id = p_loan_id;

    IF COALESCE(v_processing_fee,0) > 0 THEN
      -- Check if transactions table exists before inserting
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions'
      ) THEN
        -- Insert fee transaction if not exists
        INSERT INTO public.transactions (
          amount,
          transaction_type,
          description,
          loan_id,
          member_id,
          transaction_date,
          created_by,
          status,
          reference_number,
          branch_id,
          payment_method,
          currency,
          total_paid,
          fees
        )
        SELECT
          v_processing_fee,
          'fee',
          'Processing Fee',
          p_loan_id,
          v_member_id,  -- Fixed: Use v_member_id instead of v_customer_id
          CURRENT_DATE,
          p_set_by,
          'completed',
          'PF-' || p_loan_id::text,
          v_branch_id,
          'cash',  -- Default payment method
          'KES',   -- Currency
          v_processing_fee,
          v_processing_fee
        WHERE NOT EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.reference_number = 'PF-' || p_loan_id::text
        );
      END IF;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.set_loan_approval_status(UUID, TEXT, UUID) TO authenticated;

