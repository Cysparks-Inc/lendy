-- Migration: Add loan deletion functionality for admins
-- This adds the ability to permanently delete loans for super admins only

-- Add is_deleted column to loans table to track soft deletes
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_loans_is_deleted ON public.loans(is_deleted);

-- Add comment
COMMENT ON COLUMN public.loans.is_deleted IS 'Whether the loan has been soft deleted by an admin';
COMMENT ON COLUMN public.loans.deleted_at IS 'When the loan was deleted';
COMMENT ON COLUMN public.loans.deleted_by IS 'Which admin deleted the loan';

-- Create function to delete a loan (admin only)
CREATE OR REPLACE FUNCTION delete_loan(loan_id UUID, admin_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
    loan_exists BOOLEAN;
BEGIN
    -- Check if user is super admin
    SELECT role INTO user_role
    FROM profiles
    WHERE id = admin_user_id;
    
    IF user_role != 'super_admin' THEN
        RAISE EXCEPTION 'Only super admins can delete loans';
    END IF;
    
    -- Check if loan exists and is not already deleted
    SELECT EXISTS(
        SELECT 1 FROM loans 
        WHERE id = loan_id AND is_deleted = false
    ) INTO loan_exists;
    
    IF NOT loan_exists THEN
        RAISE EXCEPTION 'Loan not found or already deleted';
    END IF;
    
    -- Soft delete the loan
    UPDATE loans 
    SET 
        is_deleted = true,
        deleted_at = NOW(),
        deleted_by = admin_user_id
    WHERE id = loan_id;
    
    RETURN true;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_loan(UUID, UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION delete_loan(UUID, UUID) IS 'Soft delete a loan (super admin only)';

-- Update RLS policies to exclude deleted loans
DROP POLICY IF EXISTS "Users can view loans" ON public.loans;
CREATE POLICY "Users can view non-deleted loans" ON public.loans
    FOR SELECT USING (
        is_deleted = false AND (
            -- Super admin can see all loans
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            ) OR
            -- Branch admin can see loans from their branch
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'branch_admin' 
                AND branch_id = loans.branch_id
            ) OR
            -- Loan officer can see their assigned loans
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'loan_officer' 
                AND id = loans.loan_officer_id
            ) OR
            -- Auditor can see all loans
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'auditor'
            )
        )
    );
