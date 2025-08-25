-- Create transactions table
-- This table stores all financial transactions across the system

-- Drop table if exists (for idempotency)
DROP TABLE IF EXISTS public.transactions CASCADE;

-- Create transactions table
CREATE TABLE public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Transaction details
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('payment', 'disbursement', 'refund', 'fee', 'penalty', 'adjustment')),
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'KES',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('completed', 'pending', 'failed', 'cancelled')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'mobile_money', 'check', 'other')),
    reference_number TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Related entities
    loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
    member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    branch_id INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,

    -- Financial breakdown
    fees DECIMAL(15,2) DEFAULT 0,
    penalties DECIMAL(15,2) DEFAULT 0,
    principal_paid DECIMAL(15,2) DEFAULT 0,
    interest_paid DECIMAL(15,2) DEFAULT 0,
    total_paid DECIMAL(15,2) DEFAULT 0,
    balance_before DECIMAL(15,2) DEFAULT 0,
    balance_after DECIMAL(15,2) DEFAULT 0,

    -- Metadata
    notes TEXT,
    receipt_url TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_transactions_transaction_type ON public.transactions(transaction_type);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_transaction_date ON public.transactions(transaction_date);
CREATE INDEX idx_transactions_loan_id ON public.transactions(loan_id);
CREATE INDEX idx_transactions_member_id ON public.transactions(member_id);
CREATE INDEX idx_transactions_branch_id ON public.transactions(branch_id);
CREATE INDEX idx_transactions_reference_number ON public.transactions(reference_number);
CREATE INDEX idx_transactions_created_by ON public.transactions(created_by);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_transactions_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view transactions based on their role and access level
CREATE POLICY "Users can view transactions based on role" ON public.transactions
    FOR SELECT USING (
        -- Super admin can see all transactions
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
        OR
        -- Branch admin can see transactions from their branch
        EXISTS (
            SELECT 1 FROM public.profiles p1
            WHERE p1.id = auth.uid()
            AND p1.role = 'branch_admin'
            AND p1.branch_id = transactions.branch_id
        )
        OR
        -- Loan officer can see their own transactions
        EXISTS (
            SELECT 1 FROM public.profiles p1
            JOIN public.loans l ON l.id = transactions.loan_id
            WHERE p1.id = auth.uid() 
            AND p1.role = 'loan_officer' 
            AND l.loan_officer_id = p1.id
        )
        OR
        -- Users can see transactions they created
        created_by = auth.uid()
    );

-- Users can insert transactions based on their role
CREATE POLICY "Users can insert transactions based on role" ON public.transactions
    FOR INSERT WITH CHECK (
        -- Super admin can create any transaction
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
        OR
        -- Branch admin can create transactions for their branch
        EXISTS (
            SELECT 1 FROM public.profiles p1
            WHERE p1.id = auth.uid()
            AND p1.role = 'branch_admin'
            AND p1.branch_id = transactions.branch_id
        )
        OR
        -- Loan officer can create transactions for their loans
        EXISTS (
            SELECT 1 FROM public.profiles p1
            JOIN public.loans l ON l.id = transactions.loan_id
            WHERE p1.id = auth.uid() 
            AND p1.role = 'loan_officer' 
            AND l.loan_officer_id = p1.id
        )
        OR
        -- Users can create transactions for themselves
        created_by = auth.uid()
    );

-- Users can update transactions based on their role
CREATE POLICY "Users can update transactions based on role" ON public.transactions
    FOR UPDATE USING (
        -- Super admin can update any transaction
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
        OR
        -- Branch admin can update transactions from their branch
        EXISTS (
            SELECT 1 FROM public.profiles p1
            WHERE p1.id = auth.uid()
            AND p1.role = 'branch_admin'
            AND p1.branch_id = transactions.branch_id
        )
        OR
        -- Loan officer can update their own transactions
        EXISTS (
            SELECT 1 FROM public.profiles p1
            JOIN public.loans l ON l.id = transactions.loan_id
            WHERE p1.id = auth.uid() 
            AND p1.role = 'loan_officer' 
            AND l.loan_officer_id = p1.id
        )
        OR
        -- Users can update transactions they created
        created_by = auth.uid()
    );

-- Users can delete transactions based on their role
CREATE POLICY "Users can delete transactions based on role" ON public.transactions
    FOR DELETE USING (
        -- Super admin can delete any transaction
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
        OR
        -- Branch admin can delete transactions from their branch
        EXISTS (
            SELECT 1 FROM public.profiles p1
            WHERE p1.id = auth.uid()
            AND p1.role = 'branch_admin'
            AND p1.branch_id = transactions.branch_id
        )
        OR
        -- Loan officer can delete their own transactions
        EXISTS (
            SELECT 1 FROM public.profiles p1
            JOIN public.loans l ON l.id = transactions.loan_id
            WHERE p1.id = auth.uid() 
            AND p1.role = 'loan_officer' 
            AND l.loan_officer_id = p1.id
        )
        OR
        -- Users can delete transactions they created
        created_by = auth.uid()
    );

-- Grant permissions
GRANT ALL ON public.transactions TO authenticated;

-- Create a view for easy transaction reporting
CREATE OR REPLACE VIEW public.transaction_summary AS
SELECT 
    t.id,
    t.transaction_type,
    t.amount,
    t.currency,
    t.status,
    t.payment_method,
    t.reference_number,
    t.description,
    t.transaction_date,
    t.fees,
    t.penalties,
    t.principal_paid,
    t.interest_paid,
    t.total_paid,
    t.balance_before,
    t.balance_after,
    t.notes,
    t.created_at,
    t.updated_at,
    
    -- Related entities
    l.account_number as loan_account_number,
    m.full_name as member_name,
    m.id_number as member_id_number,
    m.phone_number as member_phone,
    b.name as branch_name,
    b.address as branch_address,
    p.full_name as loan_officer_name,
    p.phone_number as loan_officer_phone,
    creator.full_name as created_by_name
    
FROM public.transactions t
LEFT JOIN public.loans l ON t.loan_id = l.id
LEFT JOIN public.members m ON t.member_id = m.id
LEFT JOIN public.branches b ON t.branch_id = b.id
LEFT JOIN public.profiles p ON l.loan_officer_id = p.id
LEFT JOIN public.profiles creator ON t.created_by = creator.id;

-- Grant permissions on the view
GRANT SELECT ON public.transaction_summary TO authenticated;

-- Create trigger function to automatically create transaction records when payments are made
CREATE OR REPLACE FUNCTION create_transaction_from_payment()
RETURNS TRIGGER AS $$
DECLARE
    loan_record RECORD;
    member_record RECORD;
    branch_record RECORD;
    reference_number TEXT;
BEGIN
    -- Get loan details
    SELECT l.*, m.id as member_id, m.branch_id 
    INTO loan_record 
    FROM public.loans l
    JOIN public.members m ON l.member_id = m.id
    WHERE l.id = NEW.loan_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Loan not found';
    END IF;
    
    -- Generate unique reference number
    reference_number := 'TXN-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 8);
    
    -- Create transaction record
    INSERT INTO public.transactions (
        transaction_type,
        amount,
        currency,
        status,
        payment_method,
        reference_number,
        description,
        transaction_date,
        loan_id,
        member_id,
        branch_id,
        principal_paid,
        interest_paid,
        total_paid,
        balance_before,
        balance_after,
        notes,
        created_by
    ) VALUES (
        'payment',
        NEW.amount,
        'KES',
        'completed',
        NEW.payment_method,
        reference_number,
        COALESCE(NEW.notes, 'Loan payment'),
        NOW(),
        NEW.loan_id,
        loan_record.member_id,
        loan_record.branch_id,
        COALESCE(NEW.principal_component, NEW.amount),
        COALESCE(NEW.interest_component, 0),
        NEW.amount,
        loan_record.current_balance,
        loan_record.current_balance - NEW.amount,
        NEW.notes,
        NEW.recorded_by
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist (for idempotency)
DROP TRIGGER IF EXISTS trigger_create_transaction_from_payment ON public.payments;
DROP TRIGGER IF EXISTS trigger_create_transaction_from_repayment ON public.repayments;

-- Create trigger on payments table
CREATE TRIGGER trigger_create_transaction_from_payment
    AFTER INSERT ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION create_transaction_from_payment();

-- Also create trigger for repayments table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'repayments') THEN
        -- Create trigger function for repayments
        EXECUTE '
        CREATE OR REPLACE FUNCTION create_transaction_from_repayment()
        RETURNS TRIGGER AS $repayment_trigger$
        DECLARE
            loan_record RECORD;
            member_record RECORD;
            branch_record RECORD;
            reference_number TEXT;
        BEGIN
            -- Get loan details
            SELECT l.*, m.id as member_id, m.branch_id 
            INTO loan_record 
            FROM public.loans l
            JOIN public.members m ON l.member_id = m.id
            WHERE l.id = NEW.loan_id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION ''Loan not found'';
            END IF;
            
            -- Generate unique reference number
            reference_number := ''TXN-'' || to_char(NOW(), ''YYYYMMDD'') || ''-'' || substr(gen_random_uuid()::text, 1, 8);
            
            -- Create transaction record
            INSERT INTO public.transactions (
                transaction_type,
                amount,
                currency,
                status,
                payment_method,
                reference_number,
                description,
                transaction_date,
                loan_id,
                member_id,
                branch_id,
                principal_paid,
                interest_paid,
                total_paid,
                balance_before,
                balance_after,
                notes,
                created_by
            ) VALUES (
                ''payment'',
                NEW.amount,
                ''KES'',
                ''completed'',
                NEW.payment_method,
                reference_number,
                COALESCE(NEW.notes, ''Loan repayment''),
                NEW.payment_date,
                NEW.loan_id,
                loan_record.member_id,
                loan_record.branch_id,
                COALESCE(NEW.principal_portion, NEW.amount),
                COALESCE(NEW.interest_portion, 0),
                NEW.amount,
                loan_record.current_balance,
                loan_record.current_balance - NEW.amount,
                NEW.notes,
                NEW.received_by
            );
            
            RETURN NEW;
        END;
        $repayment_trigger$ LANGUAGE plpgsql SECURITY DEFINER;';
        
        -- Create trigger on repayments table
        EXECUTE '
        CREATE TRIGGER trigger_create_transaction_from_repayment
            AFTER INSERT ON public.repayments
            FOR EACH ROW
            EXECUTE FUNCTION create_transaction_from_repayment();';
    END IF;
END $$;

-- Backfill existing payments into transactions table
-- This converts all existing payments into transaction records
INSERT INTO public.transactions (
    transaction_type,
    amount,
    currency,
    status,
    payment_method,
    reference_number,
    description,
    transaction_date,
    loan_id,
    member_id,
    branch_id,
    principal_paid,
    interest_paid,
    total_paid,
    balance_before,
    balance_after,
    notes,
    created_by
)
SELECT 
    'payment' as transaction_type,
    CAST(p.amount AS DECIMAL(15,2)) as amount,
    'KES' as currency,
    'completed' as status,
    CASE 
        WHEN LOWER(p.payment_method) LIKE '%cash%' THEN 'cash'
        WHEN LOWER(p.payment_method) LIKE '%bank%' OR LOWER(p.payment_method) LIKE '%deposit%' THEN 'bank_transfer'
        WHEN LOWER(p.payment_method) LIKE '%mobile%' OR LOWER(p.payment_method) LIKE '%money%' THEN 'mobile_money'
        WHEN LOWER(p.payment_method) LIKE '%check%' THEN 'check'
        ELSE 'other'
    END as payment_method,
    'TXN-' || to_char(p.payment_date, 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 8) as reference_number,
    COALESCE(p.notes, 'Loan payment') as description,
    p.payment_date as transaction_date,
    p.loan_id,
    l.member_id,
    l.branch_id,
    CAST(p.principal_component AS DECIMAL(15,2)) as principal_paid,
    CAST(p.interest_component AS DECIMAL(15,2)) as interest_paid,
    CAST(p.amount AS DECIMAL(15,2)) as total_paid,
    0 as balance_before, -- We don't have historical balance data
    0 as balance_after,  -- We don't have historical balance data
    p.notes,
    p.recorded_by as created_by
FROM public.payments p
JOIN public.loans l ON p.loan_id = l.id
WHERE NOT EXISTS (
    -- Only insert if transaction doesn't already exist
    SELECT 1 FROM public.transactions t 
    WHERE t.loan_id = p.loan_id 
    AND t.amount = CAST(p.amount AS DECIMAL(15,2))
    AND t.transaction_date = p.payment_date
);
