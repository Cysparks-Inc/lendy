-- Loans approval workflow and fee booking timing

BEGIN;

-- 1) Add approval_status to loans
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending';

COMMENT ON COLUMN public.loans.approval_status IS 'Business approval state: pending | approved | rejected';

-- 2) Ensure existing rows have a sensible default
UPDATE public.loans SET approval_status = COALESCE(approval_status, 'pending');

-- 3) Create a function to approve/reject loans and handle fee postings only on approval
CREATE OR REPLACE FUNCTION public.set_loan_approval_status(
  p_loan_id UUID,
  p_status TEXT,
  p_set_by UUID
) RETURNS VOID AS $$
DECLARE
  v_processing_fee DECIMAL(15,2);
  v_branch_id INT;
  v_customer_id UUID;
BEGIN
  IF p_status NOT IN ('approved','rejected','pending') THEN
    RAISE EXCEPTION 'Invalid approval status %', p_status;
  END IF;

  -- Update loan approval status
  UPDATE public.loans
  SET approval_status = p_status,
      updated_at = NOW()
  WHERE id = p_loan_id;

  -- Only on approval: book processing fee income if not already booked
  IF p_status = 'approved' THEN
    SELECT processing_fee, branch_id, customer_id
    INTO v_processing_fee, v_branch_id, v_customer_id
    FROM public.loans
    WHERE id = p_loan_id;

    IF COALESCE(v_processing_fee,0) > 0 THEN
      -- Insert processing fee income if not exists
      INSERT INTO public.income (
        amount,
        category,
        description,
        customer_id,
        branch_id,
        created_by,
        transaction_date,
        reference_number,
        status
      )
      SELECT
        v_processing_fee,
        'processing_fee',
        'Loan processing fee',
        v_customer_id,
        v_branch_id,
        p_set_by,
        CURRENT_DATE,
        'PF-' || p_loan_id::text,
        'completed'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.income i
        WHERE i.reference_number = 'PF-' || p_loan_id::text
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Optional helper policy notes (RLS assumed already in place)
-- Grant execute to authenticated users who can approve (typically admins)
GRANT EXECUTE ON FUNCTION public.set_loan_approval_status(UUID, TEXT, UUID) TO authenticated;

COMMIT;


