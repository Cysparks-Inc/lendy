-- Migration: Delete rejected loans so they don't get saved or counted
-- When a loan is rejected, it should be marked as deleted and not appear in any statistics or listings

CREATE OR REPLACE FUNCTION public.set_loan_approval_status(
  p_loan_id UUID,
  p_status TEXT,
  p_set_by UUID
) RETURNS VOID AS $$
DECLARE
  v_processing_fee DECIMAL(15,2);
  v_branch_id UUID;
  v_member_id UUID;
BEGIN
  IF p_status NOT IN ('approved','rejected','pending') THEN
    RAISE EXCEPTION 'Invalid approval status %', p_status;
  END IF;

  -- If rejected, mark the loan as deleted so it doesn't get counted
  IF p_status = 'rejected' THEN
    UPDATE public.loans
    SET approval_status = 'rejected',
        is_deleted = true,
        approved_by = p_set_by,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_loan_id;
    
    -- Delete any related loan installments for rejected loans
    DELETE FROM public.loan_installments
    WHERE loan_id = p_loan_id;
    
    -- Delete any related loan payments for rejected loans
    DELETE FROM public.loan_payments
    WHERE loan_id = p_loan_id;
    
    -- Delete any processing fee transactions for rejected loans
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'transactions'
    ) THEN
      DELETE FROM public.transactions
      WHERE loan_id = p_loan_id
      AND reference_number = 'PF-' || p_loan_id::text;
    END IF;
    
    RETURN;
  END IF;

  -- For approved loans, update approval status and track who approved
  IF p_status = 'approved' THEN
    UPDATE public.loans
    SET approval_status = 'approved',
        approved_by = p_set_by,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_loan_id;
    
    -- Book processing fee in transactions if not already posted
    SELECT processing_fee, branch_id, member_id
    INTO v_processing_fee, v_branch_id, v_member_id
    FROM public.loans
    WHERE id = p_loan_id;

    IF COALESCE(v_processing_fee,0) > 0 THEN
      -- Only insert fee transaction if transactions table exists
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
          branch_id
        )
        SELECT
          v_processing_fee,
          'fee',
          'Processing Fee',
          p_loan_id,
          v_member_id,
          CURRENT_DATE,
          p_set_by,
          'completed',
          'PF-' || p_loan_id::text,
          v_branch_id
        WHERE NOT EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.reference_number = 'PF-' || p_loan_id::text
        );
      END IF;
    END IF;
    
    RETURN;
  END IF;

  -- For pending status, just update the approval status
  UPDATE public.loans
  SET approval_status = 'pending',
      updated_at = NOW()
  WHERE id = p_loan_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.set_loan_approval_status(UUID, TEXT, UUID) TO authenticated;

-- Update existing rejected loans to be marked as deleted
UPDATE public.loans
SET is_deleted = true
WHERE approval_status = 'rejected'
AND (is_deleted IS NULL OR is_deleted = false);

