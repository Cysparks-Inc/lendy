-- Add profession fields to members table
-- Adds: profession (TEXT), profession_other (TEXT)

BEGIN;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS profession TEXT,
  ADD COLUMN IF NOT EXISTS profession_other TEXT;

COMMENT ON COLUMN public.members.profession IS 'Member profession from predefined list (or Other)';
COMMENT ON COLUMN public.members.profession_other IS 'Custom profession when profession is Other';

COMMIT;


