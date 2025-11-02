-- Fix set_loan_approval_status function to update approved_by and approved_at fields
-- This ensures that when loans are approved, we track who approved them

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

  -- Update loan approval status, approved_by, and approved_at
  UPDATE public.loans
  SET approval_status = p_status,
      approved_by = CASE WHEN p_status IN ('approved', 'rejected') THEN p_set_by ELSE approved_by END,
      approved_at = CASE WHEN p_status IN ('approved', 'rejected') THEN NOW() ELSE approved_at END,
      updated_at = NOW()
  WHERE id = p_loan_id;

  -- Only on approval: book processing fee in transactions if not already posted
  IF p_status = 'approved' THEN
    -- Use member_id instead of customer_id
    SELECT processing_fee, branch_id, member_id
    INTO v_processing_fee, v_branch_id, v_member_id
    FROM public.loans
    WHERE id = p_loan_id;

    IF COALESCE(v_processing_fee,0) > 0 THEN
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.set_loan_approval_status(UUID, TEXT, UUID) TO authenticated;

-- Backfill approved_by for existing approved loans where it's null
-- We can use the processing fee transaction's created_by as a hint for who approved
-- Only run if transactions table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'transactions'
  ) THEN
    UPDATE public.loans l
    SET approved_by = (
      SELECT t.created_by 
      FROM public.transactions t 
      WHERE t.loan_id = l.id 
        AND t.reference_number = 'PF-' || l.id::text
        AND t.transaction_type = 'fee'
      LIMIT 1
    )
    WHERE l.approval_status = 'approved' 
      AND l.approved_by IS NULL
      AND EXISTS (
        SELECT 1 FROM public.transactions t 
        WHERE t.loan_id = l.id 
          AND t.reference_number = 'PF-' || l.id::text
          AND t.transaction_type = 'fee'
      );
  END IF;
END $$;

-- For loans approved without processing fee transactions, we can't determine the approver
-- They will remain with approved_by = NULL and show "System" in the UI

