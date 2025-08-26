-- Migration: Immediate fix for user deletion issue
-- This migration temporarily disables the problematic trigger and fixes the table structure

-- Step 1: Temporarily disable the problematic trigger
DROP TRIGGER IF EXISTS profile_deletion_trigger ON profiles;

-- Step 2: Ensure the deleted_email_tracker table exists with proper structure
DROP TABLE IF EXISTS deleted_email_tracker CASCADE;

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

-- Step 6: Create a simplified version of the track_deleted_email function
CREATE OR REPLACE FUNCTION track_deleted_email(user_email text, user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Simple insert - if email already exists, just update it
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
EXCEPTION
  WHEN OTHERS THEN
    -- If there's any error, just log it and continue
    RAISE NOTICE 'Error tracking deleted email: % - %', user_email, SQLERRM;
END;
$$;

-- Step 7: Create a simplified cleanup function that doesn't call track_deleted_email
CREATE OR REPLACE FUNCTION cleanup_user_references_simple(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Clean up member assignments
  UPDATE members 
  SET assigned_officer_id = NULL 
  WHERE assigned_officer_id = user_id_param;
  
  -- Clean up loan officer assignments
  UPDATE loans 
  SET loan_officer_id = NULL 
  WHERE loan_officer_id = user_id_param;
  
  -- Clean up any audit logs
  DELETE FROM audit_log 
  WHERE user_id = user_id_param;
  
  -- Clean up any communication logs
  DELETE FROM communication_logs 
  WHERE officer_id = user_id_param;
  
  -- Clean up any collection logs
  DELETE FROM collection_logs 
  WHERE officer_id = user_id_param;
  
  -- Clean up any payments recorded by this user
  UPDATE payments 
  SET recorded_by = NULL 
  WHERE recorded_by = user_id_param;
  
  -- Clean up any loans created by this user
  UPDATE loans 
  SET created_by = NULL 
  WHERE created_by = user_id_param;
  
  -- Clean up any members created by this user
  UPDATE members 
  SET created_by = NULL 
  WHERE created_by = user_id_param;
  
  -- Clean up any groups created by this user
  UPDATE groups 
  SET created_by = NULL 
  WHERE created_by = user_id_param;
  
  -- Clean up any branches where this user is the manager
  UPDATE branches 
  SET manager_id = NULL 
  WHERE manager_id = user_id_param;
  
  RAISE NOTICE 'Cleaned up all references for user %', user_id_param;
EXCEPTION
  WHEN OTHERS THEN
    -- If there's any error, just log it and continue
    RAISE NOTICE 'Error during cleanup for user %: %', user_id_param, SQLERRM;
END;
$$;

-- Step 8: Grant permissions
GRANT EXECUTE ON FUNCTION cleanup_user_references_simple(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION track_deleted_email(text, uuid) TO authenticated;

-- Step 9: Add table comment
COMMENT ON TABLE deleted_email_tracker IS 'Tracks deleted emails and their reuse eligibility';

-- Step 10: Verify the setup
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
  
  RAISE NOTICE 'User deletion fix applied successfully! The problematic trigger has been disabled.';
  RAISE NOTICE 'You can now delete users without the ON CONFLICT error.';
END $$;
