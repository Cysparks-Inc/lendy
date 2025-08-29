-- Migration: Add installment tracking functionality
-- This allows tracking of individual installments and their payment status

-- Create installments table to track individual installments
CREATE TABLE IF NOT EXISTS public.loan_installments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    principal_amount DECIMAL(15,2) NOT NULL,
    interest_amount DECIMAL(15,2) NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    amount_paid DECIMAL(15,2) DEFAULT 0,
    is_paid BOOLEAN DEFAULT false,
    paid_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique installments per loan
    UNIQUE(loan_id, installment_number)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_loan_installments_loan_id ON public.loan_installments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_installments_due_date ON public.loan_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_loan_installments_is_paid ON public.loan_installments(is_paid);

-- Add RLS policies
ALTER TABLE public.loan_installments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view installments for loans they have access to
CREATE POLICY "Users can view loan installments for accessible loans" ON public.loan_installments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.loans l
            WHERE l.id = loan_installments.loan_id
            AND (
                l.loan_officer_id = auth.uid() OR
                l.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                    AND p.role IN ('super_admin', 'branch_manager')
                )
            )
        )
    );

-- Policy: Users can update installments for loans they have access to
CREATE POLICY "Users can update loan installments for accessible loans" ON public.loan_installments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.loans l
            WHERE l.id = loan_installments.loan_id
            AND (
                l.loan_officer_id = auth.uid() OR
                l.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                    AND p.role IN ('super_admin', 'branch_manager')
                )
            )
        )
    );

-- Function to create installments when a loan is created
CREATE OR REPLACE FUNCTION create_loan_installments()
RETURNS TRIGGER AS $$
DECLARE
    installment_count INTEGER;
    weekly_principal DECIMAL(15,2);
    weekly_interest DECIMAL(15,2);
    start_date DATE;
    i INTEGER;
BEGIN
    -- Only proceed if this is a new loan
    IF TG_OP = 'INSERT' THEN
        -- Determine installment count based on loan program
        IF NEW.loan_program = 'small_loan' THEN
            installment_count := 8; -- 8 weeks
        ELSIF NEW.loan_program = 'big_loan' THEN
            installment_count := 12; -- 12 weeks
        ELSE
            -- Default to weekly installments
            installment_count := 8;
        END IF;
        
        -- Calculate amounts per installment
        weekly_principal := NEW.principal_amount / installment_count;
        weekly_interest := NEW.interest_disbursed / installment_count;
        
        -- Set start date
        start_date := NEW.issue_date;
        
        -- Create installments
        FOR i IN 1..installment_count LOOP
            INSERT INTO public.loan_installments (
                loan_id,
                installment_number,
                due_date,
                principal_amount,
                interest_amount,
                total_amount
            ) VALUES (
                NEW.id,
                i,
                start_date + (i * 7), -- Add weeks
                weekly_principal,
                weekly_interest,
                weekly_principal + weekly_interest
            );
            
            -- Move to next week
            start_date := start_date + 7;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create installments when a loan is created
DROP TRIGGER IF EXISTS trigger_create_loan_installments ON public.loans;
CREATE TRIGGER trigger_create_loan_installments
    AFTER INSERT ON public.loans
    FOR EACH ROW
    EXECUTE FUNCTION create_loan_installments();

-- Function to distribute payment across installments
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

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION distribute_payment_across_installments(UUID, DECIMAL) TO authenticated;

-- Update the existing payment trigger to also distribute payments
CREATE OR REPLACE FUNCTION update_loan_balance_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- First, distribute the payment across installments
    PERFORM distribute_payment_across_installments(NEW.loan_id, NEW.amount);
    
    -- Update the loan's total_paid and current_balance
    UPDATE public.loans 
    SET 
        total_paid = total_paid + NEW.amount,
        current_balance = current_balance - NEW.amount,
        updated_at = NOW()
    WHERE id = NEW.loan_id;
    
    -- Check if loan is fully paid
    UPDATE public.loans 
    SET status = 'repaid'
    WHERE id = NEW.loan_id 
    AND current_balance <= 0;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
