-- Fix: Add deactivated_at, deactivated_by, and is_active columns to profiles table
BEGIN;

-- Add deactivated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'deactivated_at') THEN
        ALTER TABLE public.profiles ADD COLUMN deactivated_at TIMESTAMPTZ;
        COMMENT ON COLUMN public.profiles.deactivated_at IS 'Timestamp when the user was deactivated';
    END IF;
END $$;

-- Add deactivated_by column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'deactivated_by') THEN
        ALTER TABLE public.profiles ADD COLUMN deactivated_by UUID REFERENCES public.profiles(id);
        COMMENT ON COLUMN public.profiles.deactivated_by IS 'ID of the user who deactivated this user';
    END IF;
END $$;

-- Add is_active column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_active') THEN
        ALTER TABLE public.profiles ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        COMMENT ON COLUMN public.profiles.is_active IS 'Indicates if the user is currently active';
    END IF;
END $$;

-- Set all existing users to active if is_active is null
UPDATE public.profiles SET is_active = TRUE WHERE is_active IS NULL;

COMMIT;

