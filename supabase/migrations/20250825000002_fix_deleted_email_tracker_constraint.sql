-- Migration: Fix deleted_email_tracker unique constraint
-- This migration adds the missing unique constraint that causes the ON CONFLICT error

-- First, ensure the table exists with proper structure
CREATE TABLE IF NOT EXISTS deleted_email_tracker (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  original_email text NOT NULL,
  deleted_at timestamp with time zone DEFAULT NOW(),
  deleted_user_id uuid NOT NULL,
  can_reuse_after timestamp with time zone DEFAULT (NOW() + INTERVAL '24 hours'),
  is_reusable boolean DEFAULT false,
  notes text
);

-- Drop existing constraint if it exists (to avoid conflicts)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'deleted_email_tracker_original_email_key'
  ) THEN
    ALTER TABLE deleted_email_tracker DROP CONSTRAINT deleted_email_tracker_original_email_key;
    RAISE NOTICE 'Dropped existing unique constraint on original_email column';
  END IF;
END $$;

-- Add unique constraint with proper naming
ALTER TABLE deleted_email_tracker 
ADD CONSTRAINT deleted_email_tracker_original_email_key 
UNIQUE (original_email);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deleted_email_tracker_email ON deleted_email_tracker(original_email);
CREATE INDEX IF NOT EXISTS idx_deleted_email_tracker_reusable ON deleted_email_tracker(is_reusable);

-- Update the track_deleted_email function to use the correct constraint name
CREATE OR REPLACE FUNCTION track_deleted_email(user_email text, user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert or update the deleted email record
  INSERT INTO deleted_email_tracker (original_email, deleted_user_id, notes)
  VALUES (user_email, user_id, 'User deleted via delete-user function')
  ON CONFLICT ON CONSTRAINT deleted_email_tracker_original_email_key
  DO UPDATE SET
    deleted_at = NOW(),
    deleted_user_id = user_id,
    can_reuse_after = NOW() + INTERVAL '24 hours',
    is_reusable = false,
    notes = 'User deleted via delete-user function - updated timestamp';
    
  RAISE NOTICE 'Tracked deleted email: % for user %', user_email, user_id;
END;
$$;

-- Verify the constraint exists
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'deleted_email_tracker' 
  AND tc.constraint_type = 'UNIQUE'
  AND kcu.column_name = 'original_email';

