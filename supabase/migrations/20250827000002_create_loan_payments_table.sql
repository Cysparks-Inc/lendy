-- Create loan_payments table for tracking installment payments
CREATE TABLE IF NOT EXISTS public.loan_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_reference TEXT NOT NULL UNIQUE,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_id ON public.loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_payment_date ON public.loan_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_loan_payments_reference ON public.loan_payments(payment_reference);

-- Add RLS policies
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view payments for loans they have access to
CREATE POLICY "Users can view loan payments for accessible loans" ON public.loan_payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.loans l
            WHERE l.id = loan_payments.loan_id
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

-- Policy: Users can insert payments for loans they have access to
CREATE POLICY "Users can insert loan payments for accessible loans" ON public.loan_payments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.loans l
            WHERE l.id = loan_payments.loan_id
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

-- Policy: Users can update payments they created
CREATE POLICY "Users can update payments they created" ON public.loan_payments
    FOR UPDATE USING (created_by = auth.uid());

-- Policy: Only super admins can delete payments
CREATE POLICY "Only super admins can delete payments" ON public.loan_payments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role = 'super_admin'
        )
    );

-- Function to update loan balance when payment is made
CREATE OR REPLACE FUNCTION update_loan_balance_on_payment()
RETURNS TRIGGER AS $$
BEGIN
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

-- Trigger to automatically update loan balance when payment is made
CREATE TRIGGER trigger_update_loan_balance_on_payment
    AFTER INSERT ON public.loan_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_loan_balance_on_payment();

-- Function to validate payment amount
CREATE OR REPLACE FUNCTION validate_payment_amount()
RETURNS TRIGGER AS $$
DECLARE
    loan_record RECORD;
    total_owed DECIMAL(15,2);
BEGIN
    -- Get loan details
    SELECT 
        principal_amount,
        interest_disbursed,
        total_paid,
        current_balance
    INTO loan_record
    FROM public.loans
    WHERE id = NEW.loan_id;
    
    -- Calculate total owed for this installment
    total_owed := (loan_record.principal_amount + loan_record.interest_disbursed) / 
                   CASE 
                       WHEN EXISTS (SELECT 1 FROM public.loans WHERE id = NEW.loan_id AND loan_program = 'small_loan') THEN 8
                       WHEN EXISTS (SELECT 1 FROM public.loans WHERE id = NEW.loan_id AND loan_program = 'big_loan') THEN 12
                       ELSE 8
                   END;
    
    -- Check if payment exceeds what's owed for this installment
    IF NEW.amount > total_owed THEN
        RAISE EXCEPTION 'Payment amount KES % exceeds the amount owed for this installment (KES %)', 
            NEW.amount, total_owed;
    END IF;
    
    -- Check if payment would result in negative balance
    IF NEW.amount > loan_record.current_balance THEN
        RAISE EXCEPTION 'Payment amount KES % exceeds the current outstanding balance (KES %)', 
            NEW.amount, loan_record.current_balance;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate payment amount before insertion
CREATE TRIGGER trigger_validate_payment_amount
    BEFORE INSERT ON public.loan_payments
    FOR EACH ROW
    EXECUTE FUNCTION validate_payment_amount();
