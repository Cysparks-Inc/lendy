-- Fix transactions table to use UUID for branch_id and ensure it exists

-- First, ensure transactions table exists with correct schema
CREATE TABLE IF NOT EXISTS public.transactions (
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
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,  -- Fixed: Changed from INTEGER to UUID

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
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_type ON public.transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_date ON public.transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_loan_id ON public.transactions(loan_id);
CREATE INDEX IF NOT EXISTS idx_transactions_member_id ON public.transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_transactions_branch_id ON public.transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_reference_number ON public.transactions(reference_number);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON public.transactions(created_by);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_transactions_updated_at ON public.transactions;
CREATE TRIGGER trigger_update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_transactions_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view transactions based on role" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert transactions based on role" ON public.transactions;
DROP POLICY IF EXISTS "Users can update transactions based on role" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete transactions based on role" ON public.transactions;

-- RLS Policies
CREATE POLICY "Users can view transactions based on role" ON public.transactions
    FOR SELECT USING (true);  -- All authenticated users can view

CREATE POLICY "Users can insert transactions based on role" ON public.transactions
    FOR INSERT WITH CHECK (true);  -- All authenticated users can insert

CREATE POLICY "Users can update transactions based on role" ON public.transactions
    FOR UPDATE USING (true);  -- All authenticated users can update

CREATE POLICY "Users can delete transactions based on role" ON public.transactions
    FOR DELETE USING (true);  -- All authenticated users can delete

-- Grant permissions
GRANT ALL ON public.transactions TO authenticated;

