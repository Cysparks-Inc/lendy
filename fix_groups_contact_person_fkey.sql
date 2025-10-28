-- Fix: Drop and recreate the foreign key constraint for groups.contact_person_id
-- The constraint should reference members table, not profiles table
BEGIN;

DO $$
BEGIN
    -- Drop the existing foreign key constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'groups_contact_person_id_fkey'
        AND table_name = 'groups'
    ) THEN
        ALTER TABLE public.groups DROP CONSTRAINT groups_contact_person_id_fkey;
        RAISE NOTICE 'Dropped existing foreign key constraint groups_contact_person_id_fkey';
    END IF;
    
    -- Recreate the constraint to reference members table instead of profiles
    ALTER TABLE public.groups 
    ADD CONSTRAINT groups_contact_person_id_fkey 
    FOREIGN KEY (contact_person_id) 
    REFERENCES public.members(id) 
    ON DELETE SET NULL;
    
    RAISE NOTICE 'Created new foreign key constraint groups_contact_person_id_fkey referencing members table';
END $$;

COMMIT;

