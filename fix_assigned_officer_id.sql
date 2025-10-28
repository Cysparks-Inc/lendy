-- Fix: Add assigned_officer_id column to members table if it doesn't exist

BEGIN;

-- Add the assigned_officer_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'members' 
        AND column_name = 'assigned_officer_id'
    ) THEN
        ALTER TABLE public.members ADD COLUMN assigned_officer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
        
        -- Add index for better performance
        CREATE INDEX IF NOT EXISTS idx_members_assigned_officer_id ON public.members(assigned_officer_id);
        
        -- Add comment
        COMMENT ON COLUMN public.members.assigned_officer_id IS 'ID of the loan officer assigned to manage this member';
        
        RAISE NOTICE 'Added assigned_officer_id column to members table';
    ELSE
        RAISE NOTICE 'assigned_officer_id column already exists';
    END IF;
END $$;

COMMIT;

