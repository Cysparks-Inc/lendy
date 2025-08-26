-- Migration: Complete fix for deleted_email_tracker table and constraints
-- This migration ensures the table exists with proper structure and constraints

-- Step 1: Drop the existing table if it exists (to start fresh)
DROP TABLE IF EXISTS deleted_email_tracker CASCADE;

-- Step 2: Create the table with proper structure
CREATE TABLE deleted_email_tracker (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  original_email text NOT NULL,
  deleted_at timestamp with time zone DEFAULT NOW(),
  deleted_user_id uuid NOT NULL,
  can_reuse_after timestamp with time zone DEFAULT (NOW() + INTERVAL '24 hours'),
  is_reusable boolean DEFAULT false,
  notes text
);

-- Step 3: Add the unique constraint with proper naming
ALTER TABLE deleted_email_tracker 
ADD CONSTRAINT deleted_email_tracker_original_email_key 
UNIQUE (original_email);

-- Step 4: Create indexes for performance
CREATE INDEX idx_deleted_email_tracker_email ON deleted_email_tracker(original_email);
CREATE INDEX idx_deleted_email_tracker_reusable ON deleted_email_tracker(is_reusable);
CREATE INDEX idx_deleted_email_tracker_deleted_at ON deleted_email_tracker(deleted_at);

-- Step 5: Grant permissions
GRANT SELECT, INSERT, UPDATE ON deleted_email_tracker TO authenticated;

-- Step 6: Create or replace the track_deleted_email function with correct constraint reference
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

-- Step 7: Create or replace the can_reuse_email function
CREATE OR REPLACE FUNCTION can_reuse_email(email_to_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  email_record RECORD;
BEGIN
  -- Check if email exists in deleted tracker
  SELECT * INTO email_record
  FROM deleted_email_tracker
  WHERE original_email = email_to_check;
  
  -- If email is not in tracker, it can be reused
  IF NOT FOUND THEN
    RETURN true;
  END IF;
  
  -- If email is marked as reusable, it can be reused
  IF email_record.is_reusable THEN
    RETURN true;
  END IF;
  
  -- If the waiting period has passed, mark as reusable
  IF email_record.can_reuse_after <= NOW() THEN
    UPDATE deleted_email_tracker
    SET is_reusable = true
    WHERE id = email_record.id;
    RETURN true;
  END IF;
  
  -- Otherwise, email cannot be reused yet
  RETURN false;
END;
$$;

-- Step 8: Create or replace the force_email_reuse function
CREATE OR REPLACE FUNCTION force_email_reuse(email_to_force text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE deleted_email_tracker
  SET 
    is_reusable = true,
    can_reuse_after = NOW(),
    notes = COALESCE(notes, '') || ' - Forcefully made reusable by admin'
  WHERE original_email = email_to_force;
  
  IF FOUND THEN
    RAISE NOTICE 'Email % is now forcefully reusable', email_to_force;
    RETURN true;
  ELSE
    RAISE NOTICE 'Email % not found in deleted tracker', email_to_force;
    RETURN false;
  END IF;
END;
$$;

-- Step 9: Create or replace the get_email_reuse_status function
CREATE OR REPLACE FUNCTION get_email_reuse_status(email_to_check text)
RETURNS TABLE(
  email text,
  deleted_at timestamp with time zone,
  can_reuse_after timestamp with time zone,
  is_reusable boolean,
  time_until_reusable interval,
  notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    det.original_email,
    det.deleted_at,
    det.can_reuse_after,
    det.is_reusable,
    CASE 
      WHEN det.is_reusable THEN interval '0'
      ELSE det.can_reuse_after - NOW()
    END as time_until_reusable,
    det.notes
  FROM deleted_email_tracker det
  WHERE det.original_email = email_to_check;
END;
$$;

-- Step 10: Grant execute permissions on all functions
GRANT EXECUTE ON FUNCTION can_reuse_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION track_deleted_email(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION force_email_reuse(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_email_reuse_status(text) TO authenticated;

-- Step 11: Add table comment
COMMENT ON TABLE deleted_email_tracker IS 'Tracks deleted emails and their reuse eligibility';

-- Step 12: Verify the setup
DO $$
BEGIN
  -- Check if table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deleted_email_tracker') THEN
    RAISE EXCEPTION 'Table deleted_email_tracker was not created successfully';
  END IF;
  
  -- Check if constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'deleted_email_tracker_original_email_key'
  ) THEN
    RAISE EXCEPTION 'Unique constraint on original_email was not created successfully';
  END IF;
  
  -- Check if functions exist
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'track_deleted_email') THEN
    RAISE EXCEPTION 'Function track_deleted_email was not created successfully';
  END IF;
  
  RAISE NOTICE 'deleted_email_tracker table and functions set up successfully!';
END $$;
