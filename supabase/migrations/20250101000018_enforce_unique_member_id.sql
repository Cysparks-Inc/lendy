-- Enforce unique KYC ID on members

BEGIN;

-- Create unique index on id_number if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'id_number'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_members_id_number ON public.members(id_number);
  END IF;
END $$;

COMMIT;


