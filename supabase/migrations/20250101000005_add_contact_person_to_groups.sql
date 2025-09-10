-- Add contact person functionality to groups table
-- This allows each group to have a designated contact person

-- Add contact_person_id column to groups table if it doesn't exist
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS contact_person_id UUID REFERENCES public.members(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_groups_contact_person_id ON public.groups(contact_person_id);

-- Add comment to explain the column
COMMENT ON COLUMN public.groups.contact_person_id IS 'Reference to the member who serves as the contact person for this group';
