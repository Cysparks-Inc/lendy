-- Ensure app_role enum includes 'admin' value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'admin';
  END IF;
END $$;

-- Optional: Comment to document intent
COMMENT ON TYPE public.app_role IS 'Application roles. Includes super_admin, admin, branch_admin, loan_officer, auditor (teller deprecated).';

