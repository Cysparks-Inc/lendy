-- Add missing columns to loans table
-- This ensures the loans table has all the columns needed by the application

BEGIN;

-- Add installment_type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'loans' 
        AND column_name = 'installment_type'
    ) THEN
        ALTER TABLE public.loans ADD COLUMN installment_type TEXT DEFAULT 'weekly' CHECK (installment_type IN ('weekly', 'monthly', 'daily'));
        COMMENT ON COLUMN public.loans.installment_type IS 'Type of installment schedule';
        RAISE NOTICE 'Added installment_type column to loans table';
    ELSE
        RAISE NOTICE 'installment_type column already exists';
    END IF;
END $$;

-- Add issue_date column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'loans' 
        AND column_name = 'issue_date'
    ) THEN
        ALTER TABLE public.loans ADD COLUMN issue_date DATE;
        COMMENT ON COLUMN public.loans.issue_date IS 'Date when the loan was issued';
        RAISE NOTICE 'Added issue_date column to loans table';
    ELSE
        RAISE NOTICE 'issue_date column already exists';
    END IF;
END $$;

-- Add repayment_schedule column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'loans' 
        AND column_name = 'repayment_schedule'
    ) THEN
        ALTER TABLE public.loans ADD COLUMN repayment_schedule TEXT DEFAULT 'weekly' CHECK (repayment_schedule IN ('weekly', 'monthly', 'daily'));
        COMMENT ON COLUMN public.loans.repayment_schedule IS 'Repayment schedule frequency';
        RAISE NOTICE 'Added repayment_schedule column to loans table';
    ELSE
        RAISE NOTICE 'repayment_schedule column already exists';
    END IF;
END $$;

-- Add maturity_date column if it doesn't exist  
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'loans' 
        AND column_name = 'maturity_date'
    ) THEN
        ALTER TABLE public.loans ADD COLUMN maturity_date DATE;
        COMMENT ON COLUMN public.loans.maturity_date IS 'Date when the loan matures';
        RAISE NOTICE 'Added maturity_date column to loans table';
    ELSE
        RAISE NOTICE 'maturity_date column already exists';
    END IF;
END $$;

-- Add interest_disbursed column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'loans' 
        AND column_name = 'interest_disbursed'
    ) THEN
        ALTER TABLE public.loans ADD COLUMN interest_disbursed DECIMAL(15,2) DEFAULT 0;
        COMMENT ON COLUMN public.loans.interest_disbursed IS 'Total interest amount disbursed';
        RAISE NOTICE 'Added interest_disbursed column to loans table';
    ELSE
        RAISE NOTICE 'interest_disbursed column already exists';
    END IF;
END $$;

-- Add total_disbursed column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'loans' 
        AND column_name = 'total_disbursed'
    ) THEN
        ALTER TABLE public.loans ADD COLUMN total_disbursed DECIMAL(15,2) DEFAULT 0;
        COMMENT ON COLUMN public.loans.total_disbursed IS 'Total amount disbursed including principal and interest';
        RAISE NOTICE 'Added total_disbursed column to loans table';
    ELSE
        RAISE NOTICE 'total_disbursed column already exists';
    END IF;
END $$;

-- Add approval_status column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'loans' 
        AND column_name = 'approval_status'
    ) THEN
        ALTER TABLE public.loans ADD COLUMN approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));
        COMMENT ON COLUMN public.loans.approval_status IS 'Loan approval status';
        RAISE NOTICE 'Added approval_status column to loans table';
    ELSE
        RAISE NOTICE 'approval_status column already exists';
    END IF;
END $$;

-- Add interest_type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'loans' 
        AND column_name = 'interest_type'
    ) THEN
        ALTER TABLE public.loans ADD COLUMN interest_type TEXT DEFAULT 'simple' CHECK (interest_type IN ('flat', 'reducing_balance', 'simple'));
        COMMENT ON COLUMN public.loans.interest_type IS 'Type of interest calculation';
        RAISE NOTICE 'Added interest_type column to loans table';
    ELSE
        RAISE NOTICE 'interest_type column already exists';
    END IF;
END $$;

-- Add total_paid column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'loans' 
        AND column_name = 'total_paid'
    ) THEN
        ALTER TABLE public.loans ADD COLUMN total_paid DECIMAL(15,2) DEFAULT 0;
        COMMENT ON COLUMN public.loans.total_paid IS 'Total amount paid by the borrower';
        RAISE NOTICE 'Added total_paid column to loans table';
    ELSE
        RAISE NOTICE 'total_paid column already exists';
    END IF;
END $$;

COMMIT;

