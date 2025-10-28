-- Fix branches table to support activation/deactivation
-- Add missing columns for branch status management

BEGIN;

-- Add is_active column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'branches' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.branches ADD COLUMN is_active BOOLEAN DEFAULT true;
        COMMENT ON COLUMN public.branches.is_active IS 'Whether the branch is active';
    END IF;
END $$;

-- Add deactivated_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'branches' 
        AND column_name = 'deactivated_at'
    ) THEN
        ALTER TABLE public.branches ADD COLUMN deactivated_at TIMESTAMPTZ;
        COMMENT ON COLUMN public.branches.deactivated_at IS 'Date when the branch was deactivated';
    END IF;
END $$;

-- Add deactivated_by column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'branches' 
        AND column_name = 'deactivated_by'
    ) THEN
        ALTER TABLE public.branches ADD COLUMN deactivated_by UUID REFERENCES public.profiles(id);
        COMMENT ON COLUMN public.branches.deactivated_by IS 'ID of the user who deactivated the branch';
    END IF;
END $$;

COMMIT;

