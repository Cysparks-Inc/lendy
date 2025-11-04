-- Migration: Remove increment level validation from database functions
-- This simplifies loan creation by removing increment level restrictions

-- Drop the increment validation functions if they exist
DROP FUNCTION IF EXISTS public.validate_loan_increment(UUID, DECIMAL, INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_next_loan_increment(UUID) CASCADE;

-- Drop the increment-related function that checks pending loans (if it exists and uses increment_level)
DROP FUNCTION IF EXISTS public.member_has_pending_loans(UUID) CASCADE;

-- Recreate a simplified member_has_pending_loans function without increment_level
CREATE OR REPLACE FUNCTION public.member_has_pending_loans(_member_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.loans 
        WHERE member_id = _member_id 
        AND status IN ('active', 'pending', 'defaulted')
        AND (is_deleted IS NULL OR is_deleted = false)
        AND current_balance > 0
    );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.member_has_pending_loans(UUID) TO authenticated;

-- Note: The loan_increment_levels table and increment_level column can remain in the database
-- but won't be used for validation. They can be removed in a future cleanup migration if needed.

