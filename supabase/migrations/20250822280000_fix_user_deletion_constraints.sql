-- Migration: Fix User Deletion Constraints
-- This migration ensures proper cleanup when users are deleted

-- First, let's check what foreign key constraints exist
-- and then create proper cleanup procedures

-- Step 1: Drop problematic foreign key constraints that prevent user deletion
-- Drop all foreign key constraints that reference profiles.id to allow user deletion
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
  -- Drop all foreign key constraints that reference profiles.id
  FOR constraint_record IN 
    SELECT 
      tc.table_name,
      tc.constraint_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu 
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'profiles'
      AND ccu.column_name = 'id'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 
                   constraint_record.table_name, 
                   constraint_record.constraint_name);
    RAISE NOTICE 'Dropped constraint % on table %', 
                  constraint_record.constraint_name, 
                  constraint_record.table_name;
  END LOOP;
END $$;

-- Step 2: Ensure the loans_with_details view exists and is working correctly
DROP VIEW IF EXISTS loans_with_details CASCADE;
CREATE VIEW loans_with_details AS
SELECT 
    l.id,
    l.principal_amount,
    l.status,
    l.due_date,
    l.member_id,
    l.customer_id,
    l.loan_officer_id,
    l.created_by,
    l.branch_id,
    l.group_id,
    l.created_at,
    l.updated_at,
    l.current_balance,
    l.total_paid,
    l.account_number,
    l.interest_rate,
    l.issue_date,
    COALESCE(m.full_name, 'Unknown Member') as member_name,
    m.id_number as member_id_number,
    m.phone_number as member_phone,
    m.status as member_status,
    COALESCE(b.name, 'Unknown Branch') as branch_name,
    COALESCE(g.name, 'Unknown Group') as group_name,
    COALESCE(p.full_name, 'Unknown Officer') as loan_officer_name
FROM loans l
LEFT JOIN members m ON l.member_id = m.id
LEFT JOIN branches b ON l.branch_id = b.id
LEFT JOIN groups g ON l.group_id = g.id
LEFT JOIN profiles p ON l.loan_officer_id = p.id;

-- Grant permissions
GRANT SELECT ON loans_with_details TO authenticated;
ALTER VIEW loans_with_details SET (security_invoker = true);

-- Step 3: Create the get_dashboard_stats_for_user function
DROP FUNCTION IF EXISTS get_dashboard_stats_for_user(text, integer, uuid) CASCADE;
CREATE FUNCTION get_dashboard_stats_for_user(user_role text, user_branch_id integer DEFAULT NULL, user_id uuid DEFAULT NULL)
RETURNS TABLE(
    total_members bigint,
    total_loans bigint,
    active_loans bigint,
    total_disbursed decimal,
    outstanding_balance decimal,
    overdue_loans bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Super admin sees all data
    IF user_role = 'super_admin' THEN
        RETURN QUERY
        SELECT 
            COUNT(DISTINCT m.id)::bigint as total_members,
            COUNT(l.id)::bigint as total_loans,
            COUNT(CASE WHEN l.status IN ('active', 'pending') THEN 1 END)::bigint as active_loans,
            COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.principal_amount ELSE 0 END), 0) as total_disbursed,
            COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.current_balance ELSE 0 END), 0) as outstanding_balance,
            COUNT(CASE WHEN l.status IN ('active', 'pending') AND l.due_date < CURRENT_DATE THEN 1 END)::bigint as overdue_loans
        FROM loans l
        LEFT JOIN members m ON l.member_id = m.id;
    
    -- Branch manager sees branch-specific data
    ELSIF user_role = 'branch_manager' AND user_branch_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            COUNT(DISTINCT m.id)::bigint as total_members,
            COUNT(l.id)::bigint as total_loans,
            COUNT(CASE WHEN l.status IN ('active', 'pending') THEN 1 END)::bigint as active_loans,
            COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.principal_amount ELSE 0 END), 0) as total_disbursed,
            COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.current_balance ELSE 0 END), 0) as outstanding_balance,
            COUNT(CASE WHEN l.status IN ('active', 'pending') AND l.due_date < CURRENT_DATE THEN 1 END)::bigint as overdue_loans
        FROM loans l
        LEFT JOIN members m ON l.member_id = m.id
        WHERE l.branch_id = user_branch_id;
    
    -- Loan officer sees own loans and members
    ELSIF user_role = 'loan_officer' AND user_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            COUNT(DISTINCT m.id)::bigint as total_members,
            COUNT(l.id)::bigint as total_loans,
            COUNT(CASE WHEN l.status IN ('active', 'pending') THEN 1 END)::bigint as active_loans,
            COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.principal_amount ELSE 0 END), 0) as total_disbursed,
            COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.current_balance ELSE 0 END), 0) as outstanding_balance,
            COUNT(CASE WHEN l.status IN ('active', 'pending') AND l.due_date < CURRENT_DATE THEN 1 END)::bigint as overdue_loans
        FROM loans l
        LEFT JOIN members m ON l.member_id = m.id
        WHERE l.created_by = user_id OR l.loan_officer_id = user_id;
    
    -- Teller/Auditor sees branch-specific data
    ELSIF user_role IN ('teller', 'auditor') AND user_branch_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            COUNT(DISTINCT m.id)::bigint as total_members,
            COUNT(l.id)::bigint as total_loans,
            COUNT(CASE WHEN l.status IN ('active', 'pending') THEN 1 END)::bigint as active_loans,
            COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.principal_amount ELSE 0 END), 0) as total_disbursed,
            COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.current_balance ELSE 0 END), 0) as outstanding_balance,
            COUNT(CASE WHEN l.status IN ('active', 'pending') AND l.due_date < CURRENT_DATE THEN 1 END)::bigint as overdue_loans
        FROM loans l
        LEFT JOIN members m ON l.member_id = m.id
        WHERE l.branch_id = user_branch_id;
    
    -- Default: return zeros
    ELSE
        RETURN QUERY
        SELECT 0::bigint, 0::bigint, 0::bigint, 0::decimal, 0::decimal, 0::bigint;
    END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_dashboard_stats_for_user(text, integer, uuid) TO authenticated;

-- Step 4: Fix data integrity issues in the loans table
-- Check and fix loans with null member_id
DO $$
DECLARE
    loan_record RECORD;
    member_count integer;
BEGIN
    -- Count loans with null member_id
    SELECT COUNT(*) INTO member_count
    FROM loans 
    WHERE member_id IS NULL;
    
    RAISE NOTICE 'Found % loans with null member_id', member_count;
    
    -- If there are loans with null member_id, we need to investigate
    IF member_count > 0 THEN
        RAISE NOTICE 'Please check the loans table for data integrity issues';
        RAISE NOTICE 'Loans should have valid member_id values';
    END IF;
END $$;

-- Step 5: Create a function to get loan details with proper member information
CREATE OR REPLACE FUNCTION get_loan_details_with_member(loan_id uuid)
RETURNS TABLE(
    loan_id uuid,
    member_name text,
    member_id uuid,
    branch_name text,
    loan_officer_name text,
    principal_amount decimal,
    current_balance decimal,
    status text,
    due_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id as loan_id,
        COALESCE(m.full_name, 'Unknown Member') as member_name,
        l.member_id,
        COALESCE(b.name, 'Unknown Branch') as branch_name,
        COALESCE(p.full_name, 'Unknown Officer') as loan_officer_name,
        l.principal_amount,
        l.current_balance,
        l.status,
        l.due_date
    FROM loans l
    LEFT JOIN members m ON l.member_id = m.id
    LEFT JOIN branches b ON l.branch_id = b.id
    LEFT JOIN profiles p ON l.loan_officer_id = p.id
    WHERE l.id = loan_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_loan_details_with_member(uuid) TO authenticated;

-- Step 6: Comprehensive data integrity check and fix
DO $$
DECLARE
    loan_record RECORD;
    member_count integer;
    orphaned_loans_count integer;
    total_loans integer;
BEGIN
    -- Get total loans count
    SELECT COUNT(*) INTO total_loans FROM loans;
    
    -- Count loans with null member_id
    SELECT COUNT(*) INTO member_count
    FROM loans 
    WHERE member_id IS NULL;
    
    -- Count orphaned loans (loans with member_id that doesn't exist in members table)
    SELECT COUNT(*) INTO orphaned_loans_count
    FROM loans l
    LEFT JOIN members m ON l.member_id = m.id
    WHERE l.member_id IS NOT NULL AND m.id IS NULL;
    
    RAISE NOTICE '=== DATA INTEGRITY REPORT ===';
    RAISE NOTICE 'Total loans: %', total_loans;
    RAISE NOTICE 'Loans with null member_id: %', member_count;
    RAISE NOTICE 'Orphaned loans (invalid member_id): %', orphaned_loans_count;
    
    -- Show sample of problematic loans
    IF member_count > 0 THEN
        RAISE NOTICE '--- Sample loans with null member_id ---';
        FOR loan_record IN 
            SELECT id, principal_amount, status, created_at 
            FROM loans 
            WHERE member_id IS NULL 
            LIMIT 5
        LOOP
            RAISE NOTICE 'Loan ID: %, Amount: %, Status: %, Created: %', 
                loan_record.id, loan_record.principal_amount, loan_record.status, loan_record.created_at;
        END LOOP;
    END IF;
    
    IF orphaned_loans_count > 0 THEN
        RAISE NOTICE '--- Sample orphaned loans ---';
        FOR loan_record IN 
            SELECT l.id, l.member_id, l.principal_amount, l.status 
            FROM loans l
            LEFT JOIN members m ON l.member_id = m.id
            WHERE l.member_id IS NOT NULL AND m.id IS NULL
            LIMIT 5
        LOOP
            RAISE NOTICE 'Loan ID: %, Invalid Member ID: %, Amount: %, Status: %', 
                loan_record.id, loan_record.member_id, loan_record.principal_amount, loan_record.status;
        END LOOP;
    END IF;
    
    -- Recommendations
    IF member_count > 0 OR orphaned_loans_count > 0 THEN
        RAISE NOTICE '--- RECOMMENDATIONS ---';
        RAISE NOTICE '1. Check if loans were created without proper member assignment';
        RAISE NOTICE '2. Verify that all members exist in the members table';
        RAISE NOTICE '3. Consider updating loan creation process to require member_id';
        RAISE NOTICE '4. Review loan data migration if this is a legacy system';
    ELSE
        RAISE NOTICE 'All loans have valid member_id references!';
    END IF;
    
END $$;

-- Create a table to track deleted emails and their reuse status
CREATE TABLE IF NOT EXISTS deleted_email_tracker (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  original_email text NOT NULL,
  deleted_at timestamp with time zone DEFAULT NOW(),
  deleted_user_id uuid NOT NULL,
  can_reuse_after timestamp with time zone DEFAULT (NOW() + INTERVAL '24 hours'),
  is_reusable boolean DEFAULT false,
  notes text
);

-- Create index for efficient email lookups
CREATE INDEX IF NOT EXISTS idx_deleted_email_tracker_email ON deleted_email_tracker(original_email);
CREATE INDEX IF NOT EXISTS idx_deleted_email_tracker_reusable ON deleted_email_tracker(is_reusable);

-- Function to check if an email can be reused
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

-- Function to mark an email as deleted and track it
CREATE OR REPLACE FUNCTION track_deleted_email(user_email text, user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert or update the deleted email record
  INSERT INTO deleted_email_tracker (original_email, deleted_user_id, notes)
  VALUES (user_email, user_id, 'User deleted via delete-user function')
  ON CONFLICT (original_email) 
  DO UPDATE SET
    deleted_at = NOW(),
    deleted_user_id = user_id,
    can_reuse_after = NOW() + INTERVAL '24 hours',
    is_reusable = false,
    notes = 'User deleted via delete-user function - updated timestamp';
    
  RAISE NOTICE 'Tracked deleted email: % for user %', user_email, user_id;
END;
$$;

-- Function to force email reuse (for admin purposes)
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

-- Function to get email reuse status
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION can_reuse_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION track_deleted_email(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION force_email_reuse(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_email_reuse_status(text) TO authenticated;
GRANT SELECT, INSERT, UPDATE ON deleted_email_tracker TO authenticated;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS cleanup_user_references(uuid) CASCADE;

-- Create a comprehensive cleanup function for user references
CREATE OR REPLACE FUNCTION cleanup_user_references(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email text;
BEGIN
  -- Get the user's email before cleanup
  SELECT email INTO user_email
  FROM profiles
  WHERE id = user_id_param;
  
  -- Track the deleted email
  IF user_email IS NOT NULL THEN
    PERFORM track_deleted_email(user_email, user_id_param);
  END IF;
  
  -- Clean up member assignments
  UPDATE members 
  SET assigned_officer_id = NULL 
  WHERE assigned_officer_id = user_id_param;
  
  -- Clean up loan officer assignments
  UPDATE loans 
  SET loan_officer_id = NULL 
  WHERE loan_officer_id = user_id_param;
  
  -- Clean up any audit logs (using the correct table name)
  DELETE FROM audit_log 
  WHERE user_id = user_id_param;
  
  -- Clean up any communication logs (using the correct column name)
  DELETE FROM communication_logs 
  WHERE officer_id = user_id_param;
  
  -- Clean up any collection logs (using the correct column name)
  DELETE FROM collection_logs 
  WHERE officer_id = user_id_param;
  
  -- Clean up any payments recorded by this user
  UPDATE payments 
  SET recorded_by = NULL 
  WHERE recorded_by = user_id_param;
  
  -- Clean up any loans created by this user (only if column exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'created_by') THEN
    UPDATE loans 
    SET created_by = NULL 
    WHERE created_by = user_id_param;
  END IF;
  
  -- Clean up any members created by this user (only if column exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'created_by') THEN
    UPDATE members 
    SET created_by = NULL 
    WHERE created_by = user_id_param;
  END IF;
  
  -- Clean up any groups created by this user (only if column exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'created_by') THEN
    UPDATE groups 
    SET created_by = NULL 
    WHERE created_by = user_id_param;
  END IF;
  
  -- Clean up any branches where this user is the manager (only if column exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'manager_id') THEN
    UPDATE branches 
    SET manager_id = NULL 
    WHERE manager_id = user_id_param;
  END IF;
  
  -- Clean up any member documents uploaded by this user (only if table and column exist)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'member_documents') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'member_documents' AND column_name = 'uploaded_by') THEN
      UPDATE member_documents 
      SET uploaded_by = NULL 
      WHERE uploaded_by = user_id_param;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'member_documents' AND column_name = 'verified_by') THEN
      UPDATE member_documents 
      SET verified_by = NULL 
      WHERE verified_by = user_id_param;
    END IF;
  END IF;
  
  -- Clean up any collateral created by this user (only if table and column exist)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'collateral') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collateral' AND column_name = 'created_by') THEN
      UPDATE collateral 
      SET created_by = NULL 
      WHERE created_by = user_id_param;
    END IF;
  END IF;
  
  -- Clean up any repayments received by this user (only if table and column exist)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'repayments') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repayments' AND column_name = 'received_by') THEN
      UPDATE repayments 
      SET received_by = NULL 
      WHERE received_by = user_id_param;
    END IF;
  END IF;
  
  -- Log the cleanup
  INSERT INTO audit_log (action, table_name, record_id, user_id, timestamp)
  VALUES (
    'DELETE', 
    'profiles', 
    user_id_param, 
    user_id_param, 
    NOW()
  );
  
  RAISE NOTICE 'Cleaned up all references for user % (email: %)', user_id_param, user_email;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_user_references(uuid) TO authenticated;

-- Create a trigger function to automatically clean up when a profile is deleted
CREATE OR REPLACE FUNCTION handle_profile_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Call the cleanup function
  PERFORM cleanup_user_references(OLD.id);
  
  -- Log the deletion
  INSERT INTO audit_log (action, table_name, record_id, user_id, timestamp)
  VALUES (
    'DELETE', 
    'profiles', 
    OLD.id, 
    OLD.id, 
    NOW()
  );
  
  RETURN OLD;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS profile_deletion_trigger ON profiles;
CREATE TRIGGER profile_deletion_trigger
  BEFORE DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_profile_deletion();

-- Use a DO block to handle conditional schema modifications
DO $$
BEGIN
  -- Update members table to allow NULL for assigned_officer_id (only if column exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'assigned_officer_id') THEN
    ALTER TABLE members 
    ALTER COLUMN assigned_officer_id DROP NOT NULL;
  END IF;

  -- Update loans table to allow NULL for loan_officer_id (only if column exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'loan_officer_id') THEN
    ALTER TABLE loans 
    ALTER COLUMN loan_officer_id DROP NOT NULL;
  END IF;

  -- Update loans table to allow NULL for created_by (only if column exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'created_by') THEN
    ALTER TABLE loans 
    ALTER COLUMN created_by DROP NOT NULL;
  END IF;

  -- Update members table to allow NULL for created_by (only if column exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'created_by') THEN
    ALTER TABLE members 
    ALTER COLUMN created_by DROP NOT NULL;
  END IF;

  -- Update groups table to allow NULL for created_by (only if column exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'created_by') THEN
    ALTER TABLE groups 
    ALTER COLUMN created_by DROP NOT NULL;
  END IF;

  -- Update branches table to allow NULL for manager_id (only if column exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'manager_id') THEN
    ALTER TABLE branches 
    ALTER COLUMN manager_id DROP NOT NULL;
  END IF;

  -- Update member_documents table to allow NULL for uploaded_by and verified_by (only if table and columns exist)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'member_documents') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'member_documents' AND column_name = 'uploaded_by') THEN
      ALTER TABLE member_documents 
      ALTER COLUMN uploaded_by DROP NOT NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'member_documents' AND column_name = 'verified_by') THEN
      ALTER TABLE member_documents 
      ALTER COLUMN verified_by DROP NOT NULL;
    END IF;
  END IF;

  -- Update collateral table to allow NULL for created_by (only if table and column exist)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'collateral') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collateral' AND column_name = 'created_by') THEN
      ALTER TABLE collateral 
      ALTER COLUMN created_by DROP NOT NULL;
    END IF;
  END IF;

  -- Update repayments table to allow NULL for received_by (only if table and column exist)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'repayments') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repayments' AND column_name = 'received_by') THEN
      ALTER TABLE repayments 
      ALTER COLUMN received_by DROP NOT NULL;
    END IF;
  END IF;

  -- Update payments table to allow NULL for recorded_by (only if table and column exist)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'recorded_by') THEN
      ALTER TABLE payments 
      ALTER COLUMN recorded_by DROP NOT NULL;
    END IF;
  END IF;

  -- For audit_log, we want to keep the records but allow NULL user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_log' AND column_name = 'user_id') THEN
      ALTER TABLE audit_log 
      ALTER COLUMN user_id DROP NOT NULL;
    END IF;
  END IF;

  -- Create indexes for better performance on cleanup operations (only if columns exist)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'assigned_officer_id') THEN
    CREATE INDEX IF NOT EXISTS idx_members_assigned_officer_id ON members(assigned_officer_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'loan_officer_id') THEN
    CREATE INDEX IF NOT EXISTS idx_loans_loan_officer_id ON loans(loan_officer_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'created_by') THEN
    CREATE INDEX IF NOT EXISTS idx_loans_created_by ON loans(created_by);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'created_by') THEN
    CREATE INDEX IF NOT EXISTS idx_members_created_by ON members(created_by);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'created_by') THEN
    CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'manager_id') THEN
    CREATE INDEX IF NOT EXISTS idx_branches_manager_id ON branches(manager_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'member_documents') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'member_documents' AND column_name = 'uploaded_by') THEN
      CREATE INDEX IF NOT EXISTS idx_member_documents_uploaded_by ON member_documents(uploaded_by);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'member_documents' AND column_name = 'verified_by') THEN
      CREATE INDEX IF NOT EXISTS idx_member_documents_verified_by ON member_documents(verified_by);
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'collateral') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collateral' AND column_name = 'created_by') THEN
      CREATE INDEX IF NOT EXISTS idx_collateral_created_by ON collateral(created_by);
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'repayments') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repayments' AND column_name = 'received_by') THEN
      CREATE INDEX IF NOT EXISTS idx_repayments_received_by ON repayments(received_by);
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'recorded_by') THEN
      CREATE INDEX IF NOT EXISTS idx_payments_recorded_by ON payments(recorded_by);
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_log' AND column_name = 'user_id') THEN
      CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_logs') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'communication_logs' AND column_name = 'officer_id') THEN
      CREATE INDEX IF NOT EXISTS idx_communication_logs_officer_id ON communication_logs(officer_id);
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'collection_logs') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collection_logs' AND column_name = 'officer_id') THEN
      CREATE INDEX IF NOT EXISTS idx_collection_logs_officer_id ON collection_logs(officer_id);
    END IF;
  END IF;

END $$;

-- Add a constraint to ensure at least one super admin exists
-- This will be enforced at the application level, but we can add a database check too

-- Create a function to check super admin count
CREATE OR REPLACE FUNCTION check_super_admin_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  super_admin_count integer;
BEGIN
  -- Count super admins
  SELECT COUNT(*) INTO super_admin_count
  FROM profiles
  WHERE role = 'super_admin';
  
  -- If this is a deletion and it would leave 0 super admins, prevent it
  IF TG_OP = 'DELETE' AND OLD.role = 'super_admin' AND super_admin_count <= 1 THEN
    RAISE EXCEPTION 'Cannot delete the last super admin. At least one super admin must remain in the system.';
  END IF;
  
  -- If this is an update and it would leave 0 super admins, prevent it
  IF TG_OP = 'UPDATE' AND OLD.role = 'super_admin' AND NEW.role != 'super_admin' AND super_admin_count <= 1 THEN
    RAISE EXCEPTION 'Cannot change the role of the last super admin. At least one super admin must remain in the system.';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create the trigger for super admin protection
DROP TRIGGER IF EXISTS super_admin_protection_trigger ON profiles;
CREATE TRIGGER super_admin_protection_trigger
  BEFORE DELETE OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_super_admin_count();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_super_admin_count() TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION cleanup_user_references(uuid) IS 'Comprehensive cleanup function for removing all user references when deleting a user';
COMMENT ON FUNCTION handle_profile_deletion() IS 'Trigger function to automatically clean up user references when a profile is deleted';
COMMENT ON FUNCTION check_super_admin_count() IS 'Protection function to ensure at least one super admin remains in the system';
COMMENT ON FUNCTION can_reuse_email(text) IS 'Check if an email can be reused after user deletion';
COMMENT ON FUNCTION track_deleted_email(text, uuid) IS 'Track deleted emails for reuse management';
COMMENT ON FUNCTION force_email_reuse(text) IS 'Force an email to be reusable (admin function)';
COMMENT ON FUNCTION get_email_reuse_status(text) IS 'Get the reuse status of a deleted email';
COMMENT ON TABLE deleted_email_tracker IS 'Tracks deleted emails and their reuse eligibility';
