-- Fix groups table to add missing description column
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS description TEXT;

-- Also ensure other missing columns exist
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS meeting_day INTEGER CHECK (meeting_day BETWEEN 1 AND 7);
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS meeting_time TIME;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT 30;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS current_members INTEGER DEFAULT 0;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS loan_officer_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS contact_person_id UUID REFERENCES public.members(id);

-- If code is required but doesn't exist
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS code TEXT;

-- Create unique index on code if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_code ON public.groups(code);

-- Grant permissions
GRANT ALL ON groups TO authenticated;

-- Done!
