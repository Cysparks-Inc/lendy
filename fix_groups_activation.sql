-- Fix: Add is_active, deactivated_at, and deactivated_by columns to groups table if they don't exist
BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'is_active') THEN
        ALTER TABLE public.groups ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        COMMENT ON COLUMN public.groups.is_active IS 'Indicates if the group is currently active or deactivated.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'deactivated_at') THEN
        ALTER TABLE public.groups ADD COLUMN deactivated_at TIMESTAMPTZ;
        COMMENT ON COLUMN public.groups.deactivated_at IS 'Timestamp when the group was deactivated.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'deactivated_by') THEN
        ALTER TABLE public.groups ADD COLUMN deactivated_by UUID REFERENCES public.profiles(id);
        COMMENT ON COLUMN public.groups.deactivated_by IS 'ID of the user who deactivated the group.';
    END IF;
END $$;

COMMIT;

