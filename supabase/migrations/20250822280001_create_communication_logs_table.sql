-- Migration: Create Communication Logs Table
-- This table will store all communication logs from both loan details and member pages
-- ensuring unified communication tracking across the system

-- Drop the table if it exists to ensure clean creation
DROP TABLE IF EXISTS public.communication_logs CASCADE;

-- Create the communication_logs table
CREATE TABLE public.communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID,
    loan_id UUID,
    officer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    communication_type TEXT NOT NULL CHECK (communication_type IN ('Call', 'SMS', 'Email', 'Visit', 'Meeting', 'Other')),
    notes TEXT NOT NULL,
    follow_up_date DATE,
    follow_up_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraints with proper error handling
DO $$
DECLARE
    loans_table_exists BOOLEAN;
    loans_id_column_exists BOOLEAN;
    loans_id_column_type TEXT;
    members_table_exists BOOLEAN;
    members_id_column_exists BOOLEAN;
    members_id_column_type TEXT;
BEGIN
    -- Check if loans table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'loans'
    ) INTO loans_table_exists;
    
    -- Check if members table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'members'
    ) INTO members_table_exists;
    
    -- Check if loans.id column exists and get its type
    IF loans_table_exists THEN
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'loans' 
            AND column_name = 'id'
        ),
        (
            SELECT data_type FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'loans' 
            AND column_name = 'id'
        )
        INTO loans_id_column_exists, loans_id_column_type;
        
        RAISE NOTICE 'Loans table exists: %, loans.id column exists: %, type: %', 
                     loans_table_exists, loans_id_column_exists, loans_id_column_type;
    ELSE
        RAISE NOTICE 'Loans table does not exist, skipping loan_id foreign key';
    END IF;
    
    -- Check if members.id column exists and get its type
    IF members_table_exists THEN
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'members' 
            AND column_name = 'id'
        ),
        (
            SELECT data_type FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'members' 
            AND column_name = 'id'
        )
        INTO members_id_column_exists, members_id_column_type;
        
        RAISE NOTICE 'Members table exists: %, members.id column exists: %, type: %', 
                     members_table_exists, members_id_column_exists, members_id_column_type;
    ELSE
        RAISE NOTICE 'Members table does not exist, skipping member_id foreign key';
    END IF;
    
    -- Add member_id foreign key if members table exists and members.id column exists
    IF members_table_exists 
       AND members_id_column_exists
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                      WHERE constraint_name = 'communication_logs_member_id_fkey' 
                      AND table_name = 'communication_logs') THEN
        
        RAISE NOTICE 'Adding member_id foreign key constraint to members.id';
        
        ALTER TABLE communication_logs 
        ADD CONSTRAINT communication_logs_member_id_fkey 
        FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Added member_id foreign key constraint';
    ELSE
        RAISE NOTICE 'Skipping member_id FK: members table or members.id column not found, or constraint already exists';
    END IF;
    
    -- Add loan_id foreign key if loans table exists, loans.id column exists, and constraint doesn't exist
    IF loans_table_exists 
       AND loans_id_column_exists
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                      WHERE constraint_name = 'communication_logs_loan_id_fkey' 
                      AND table_name = 'communication_logs') THEN
        
        RAISE NOTICE 'Adding loan_id foreign key constraint to loans.id';
        
        ALTER TABLE communication_logs 
        ADD CONSTRAINT communication_logs_loan_id_fkey 
        FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Added loan_id foreign key constraint';
    ELSE
        RAISE NOTICE 'Skipping loan_id FK: loans table or loans.id column not found, or constraint already exists';
    END IF;
    
    RAISE NOTICE 'Foreign key constraint section completed';
END $$;

-- Create indexes for better performance (IF NOT EXISTS handles duplicates)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_logs') THEN
        CREATE INDEX IF NOT EXISTS idx_communication_logs_member_id ON communication_logs(member_id);
        CREATE INDEX IF NOT EXISTS idx_communication_logs_loan_id ON communication_logs(loan_id);
        CREATE INDEX IF NOT EXISTS idx_communication_logs_officer_id ON communication_logs(officer_id);
        CREATE INDEX IF NOT EXISTS idx_communication_logs_created_at ON communication_logs(created_at);
        RAISE NOTICE 'Indexes created successfully';
    END IF;
END $$;

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_communication_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at (DROP IF EXISTS first to avoid conflicts)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_logs') THEN
        DROP TRIGGER IF EXISTS trigger_update_communication_logs_updated_at ON communication_logs;
        CREATE TRIGGER trigger_update_communication_logs_updated_at
            BEFORE UPDATE ON communication_logs
            FOR EACH ROW
            EXECUTE FUNCTION update_communication_logs_updated_at();
        RAISE NOTICE 'Trigger created successfully';
    END IF;
END $$;

-- Enable Row Level Security (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_logs') THEN
        ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled on communication_logs table';
    END IF;
END $$;

-- Create RLS policies for role-based access control
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_logs') THEN
        -- Drop existing policies first to avoid conflicts
        DROP POLICY IF EXISTS "Super admin can view all communication logs" ON communication_logs;
        DROP POLICY IF EXISTS "Branch admin can view communication logs for their branch" ON communication_logs;
        DROP POLICY IF EXISTS "Loan officer can view communication logs for assigned members" ON communication_logs;
        DROP POLICY IF EXISTS "Users can insert communication logs for accessible members" ON communication_logs;
        DROP POLICY IF EXISTS "Users can update their own communication logs" ON communication_logs;

        -- Super admin can see all communication logs
        CREATE POLICY "Super admin can view all communication logs" ON communication_logs
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() 
                    AND profiles.role = 'super_admin'
                )
            );

        -- Branch admin can see communication logs for members in their branch
        CREATE POLICY "Branch admin can view communication logs for their branch" ON communication_logs
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.id = auth.uid() 
                    AND p.role = 'branch_admin'
                    AND (
                        (communication_logs.member_id IS NOT NULL AND EXISTS (
                            SELECT 1 FROM members m 
                            WHERE m.id = communication_logs.member_id 
                            AND m.branch_id = p.branch_id
                        ))
                        OR 
                        (communication_logs.loan_id IS NOT NULL AND EXISTS (
                            SELECT 1 FROM loans l
                            JOIN members m ON m.id = l.member_id
                            WHERE l.id = communication_logs.loan_id 
                            AND m.branch_id = p.branch_id
                        ))
                    )
                )
            );

        -- Loan officer can see communication logs for members assigned to them
        CREATE POLICY "Loan officer can view communication logs for assigned members" ON communication_logs
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.id = auth.uid() 
                    AND p.role = 'loan_officer'
                    AND (
                        (communication_logs.member_id IS NOT NULL AND EXISTS (
                            SELECT 1 FROM members m 
                            WHERE m.id = communication_logs.member_id 
                            AND m.assigned_officer_id = p.id
                        ))
                        OR 
                        (communication_logs.loan_id IS NOT NULL AND EXISTS (
                            SELECT 1 FROM loans l
                            JOIN members m ON m.id = l.member_id
                            WHERE l.id = communication_logs.loan_id 
                            AND m.assigned_officer_id = p.id
                        ))
                    )
                )
            );

        -- Users can insert communication logs for members they have access to
        CREATE POLICY "Users can insert communication logs for accessible members" ON communication_logs
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.id = auth.uid() 
                    AND (
                        p.role = 'super_admin' OR
                        (p.role = 'branch_admin' AND (
                            (communication_logs.member_id IS NOT NULL AND EXISTS (
                                SELECT 1 FROM members m 
                                WHERE m.id = communication_logs.member_id 
                                AND m.branch_id = p.branch_id
                            ))
                            OR 
                            (communication_logs.loan_id IS NOT NULL AND EXISTS (
                                SELECT 1 FROM loans l
                                JOIN members m ON m.id = l.member_id
                                WHERE l.id = communication_logs.loan_id 
                                AND m.branch_id = p.branch_id
                            ))
                        )) OR
                        (p.role = 'loan_officer' AND (
                            (communication_logs.member_id IS NOT NULL AND EXISTS (
                                SELECT 1 FROM members m 
                                WHERE m.id = communication_logs.member_id 
                                AND m.assigned_officer_id = p.id
                            ))
                            OR 
                            (communication_logs.loan_id IS NOT NULL AND EXISTS (
                                SELECT 1 FROM loans l
                                JOIN members m ON m.id = l.member_id
                                WHERE l.id = communication_logs.loan_id 
                                AND m.assigned_officer_id = p.id
                            ))
                        ))
                    )
                )
            );

        -- Users can update their own communication logs
        CREATE POLICY "Users can update their own communication logs" ON communication_logs
            FOR UPDATE USING (officer_id = auth.uid());
            
        -- Users can delete their own communication logs
        CREATE POLICY "Users can delete their own communication logs" ON communication_logs
            FOR DELETE USING (officer_id = auth.uid());
            
        -- Super admins can delete any communication logs
        CREATE POLICY "Super admin can delete all communication logs" ON communication_logs
            FOR DELETE USING (
                EXISTS (
                    SELECT 1 FROM profiles p 
                    WHERE p.id = auth.uid() 
                    AND p.role = 'super_admin'
                )
            );
            
        -- Branch admins can delete communication logs in their branch
        CREATE POLICY "Branch admin can delete communication logs in their branch" ON communication_logs
            FOR DELETE USING (
                EXISTS (
                    SELECT 1 FROM profiles p 
                    WHERE p.id = auth.uid() 
                    AND p.role = 'branch_admin'
                    AND p.branch_id IS NOT NULL
                    AND (
                        -- For member-based logs
                        (communication_logs.member_id IS NOT NULL AND EXISTS (
                            SELECT 1 FROM members m 
                            WHERE m.id = communication_logs.member_id 
                            AND m.branch_id = p.branch_id
                        ))
                        OR
                        -- For loan-based logs
                        (communication_logs.loan_id IS NOT NULL AND EXISTS (
                            SELECT 1 FROM loans l 
                            JOIN members m ON m.id = l.member_id
                            WHERE l.id = communication_logs.loan_id 
                            AND m.branch_id = p.branch_id
                        ))
                    )
                )
            );
            
        RAISE NOTICE 'RLS policies created successfully';
    END IF;
END $$;

-- Grant necessary permissions (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_logs') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON communication_logs TO authenticated;
        RAISE NOTICE 'Permissions granted successfully';
    END IF;
END $$;

-- Create a view for easier querying of communication logs with member and officer information
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_logs') THEN
        CREATE OR REPLACE VIEW communication_logs_with_details AS
        SELECT 
            cl.id,
            cl.member_id,
            cl.loan_id,
            cl.officer_id,
            cl.communication_type,
            cl.notes,
            cl.follow_up_date,
            cl.follow_up_notes,
            cl.created_at,
            cl.updated_at,
            COALESCE(m.full_name, 'Unknown Member') as member_name,
            COALESCE(m.branch_id, m2.branch_id) as branch_id,
            COALESCE(b.name, 'Unknown Branch') as branch_name,
            p.full_name as officer_name,
            p.role as officer_role
        FROM communication_logs cl
        LEFT JOIN members m ON cl.member_id = m.id
        LEFT JOIN loans l ON cl.loan_id = l.id
        LEFT JOIN members m2 ON l.member_id = m2.id
        LEFT JOIN branches b ON COALESCE(m.branch_id, m2.branch_id) = b.id
        LEFT JOIN profiles p ON cl.officer_id = p.id;

        -- Grant access to the view
        GRANT SELECT ON communication_logs_with_details TO authenticated;
        
        RAISE NOTICE 'View created successfully';
    END IF;
END $$;

-- Create a function to get communication logs for a user based on their role
-- This function must be created at the top level, not inside a DO block
CREATE OR REPLACE FUNCTION get_communication_logs_for_user(
    requesting_user_id UUID,
    member_id_filter UUID DEFAULT NULL,
    loan_id_filter UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    member_id UUID,
    loan_id UUID,
    officer_id UUID,
    communication_type TEXT,
    notes TEXT,
    follow_up_date DATE,
    follow_up_notes TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    member_name TEXT,
    branch_name TEXT,
    officer_name TEXT,
    officer_role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
    user_branch_id UUID;
BEGIN
    -- Get user's role and branch from profiles table
    SELECT p.role, p.branch_id INTO user_role, user_branch_id
    FROM profiles p
    WHERE p.id = requesting_user_id
    LIMIT 1;

    -- If no role found, return empty results
    IF user_role IS NULL THEN
        RETURN;
    END IF;

    -- Super admin sees all communication logs
    IF user_role = 'super_admin' THEN
        RETURN QUERY
        SELECT 
            cl.id,
            cl.member_id,
            cl.loan_id,
            cl.officer_id,
            cl.communication_type,
            cl.notes,
            cl.follow_up_date,
            cl.follow_up_notes,
            cl.created_at,
            cl.updated_at,
            COALESCE(m.full_name, 'Unknown Member') as member_name,
            COALESCE(b.name, 'Unknown Branch') as branch_name,
            p.full_name as officer_name,
            p.role as officer_role
        FROM communication_logs cl
        LEFT JOIN members m ON cl.member_id = m.id
        LEFT JOIN loans l ON cl.loan_id = l.id
        LEFT JOIN members m2 ON l.member_id = m2.id
        LEFT JOIN branches b ON COALESCE(m.branch_id, m2.branch_id) = b.id
        LEFT JOIN profiles p ON cl.officer_id = p.id
        WHERE (member_id_filter IS NULL OR cl.member_id = member_id_filter)
        AND (loan_id_filter IS NULL OR cl.loan_id = loan_id_filter)
        ORDER BY cl.created_at DESC;
    
    -- Branch admin sees communication logs for their branch
    ELSIF user_role = 'branch_admin' AND user_branch_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            cl.id,
            cl.member_id,
            cl.loan_id,
            cl.officer_id,
            cl.communication_type,
            cl.notes,
            cl.follow_up_date,
            cl.follow_up_notes,
            cl.created_at,
            cl.updated_at,
            COALESCE(m.full_name, 'Unknown Member') as member_name,
            COALESCE(b.name, 'Unknown Branch') as branch_name,
            p.full_name as officer_name,
            p.role as officer_role
        FROM communication_logs cl
        LEFT JOIN members m ON cl.member_id = m.id
        LEFT JOIN loans l ON cl.loan_id = l.id
        LEFT JOIN members m2 ON l.member_id = m2.id
        LEFT JOIN branches b ON COALESCE(m.branch_id, m2.branch_id) = b.id
        LEFT JOIN profiles p ON cl.officer_id = p.id
        WHERE (cl.member_id IS NOT NULL AND m.branch_id = user_branch_id)
           OR (cl.loan_id IS NOT NULL AND m2.branch_id = user_branch_id)
        AND (member_id_filter IS NULL OR cl.member_id = member_id_filter)
        AND (loan_id_filter IS NULL OR cl.loan_id = loan_id_filter)
        ORDER BY cl.created_at DESC;
    
    -- Loan officer sees communication logs for members assigned to them
    ELSIF user_role = 'loan_officer' THEN
        RETURN QUERY
        SELECT 
            cl.id,
            cl.member_id,
            cl.loan_id,
            cl.officer_id,
            cl.communication_type,
            cl.notes,
            cl.follow_up_date,
            cl.follow_up_notes,
            cl.created_at,
            cl.updated_at,
            COALESCE(m.full_name, 'Unknown Member') as member_name,
            COALESCE(b.name, 'Unknown Branch') as branch_name,
            p.full_name as officer_name,
            p.role as officer_role
        FROM communication_logs cl
        LEFT JOIN members m ON cl.member_id = m.id
        LEFT JOIN loans l ON cl.loan_id = l.id
        LEFT JOIN members m2 ON l.member_id = m2.id
        LEFT JOIN branches b ON COALESCE(m.branch_id, m2.branch_id) = b.id
        LEFT JOIN profiles p ON cl.officer_id = p.id
        WHERE (cl.member_id IS NOT NULL AND m.assigned_officer_id = requesting_user_id)
           OR (cl.loan_id IS NOT NULL AND m2.assigned_officer_id = requesting_user_id)
        AND (member_id_filter IS NULL OR cl.member_id = member_id_filter)
        AND (loan_id_filter IS NULL OR cl.loan_id = loan_id_filter)
        ORDER BY cl.created_at DESC;
    
    -- Teller and auditor see communication logs for their branch if they have one
    ELSIF user_role IN ('teller', 'auditor') AND user_branch_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            cl.id,
            cl.member_id,
            cl.loan_id,
            cl.officer_id,
            cl.communication_type,
            cl.notes,
            cl.follow_up_date,
            cl.follow_up_notes,
            cl.created_at,
            cl.updated_at,
            COALESCE(m.full_name, 'Unknown Member') as member_name,
            COALESCE(b.name, 'Unknown Branch') as branch_name,
            p.full_name as officer_name,
            p.role as officer_role
        FROM communication_logs cl
        LEFT JOIN members m ON cl.member_id = m.id
        LEFT JOIN loans l ON cl.loan_id = l.id
        LEFT JOIN members m2 ON l.customer_id = m2.id OR l.member_id = m2.id
        LEFT JOIN branches b ON COALESCE(m.branch_id, m2.branch_id) = b.id
        LEFT JOIN profiles p ON cl.officer_id = p.id
        WHERE (cl.member_id IS NOT NULL AND m.branch_id = user_branch_id)
           OR (cl.loan_id IS NOT NULL AND m2.branch_id = user_branch_id)
        AND (member_id_filter IS NULL OR cl.member_id = member_id_filter)
        AND (loan_id_filter IS NULL OR cl.loan_id = loan_id_filter)
        ORDER BY cl.created_at DESC;
    END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_communication_logs_for_user(uuid, uuid, uuid) TO authenticated;

-- Add table and column comments (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_logs') THEN
        COMMENT ON TABLE communication_logs IS 'Stores all communication logs from both loan details and member pages for unified tracking. Can link to member, loan, or both.';
        COMMENT ON COLUMN communication_logs.member_id IS 'Reference to the member (can be NULL if only loan-specific)';
        COMMENT ON COLUMN communication_logs.loan_id IS 'Reference to the loan (can be NULL if only member-specific)';
        COMMENT ON COLUMN communication_logs.officer_id IS 'Reference to the loan officer or staff member who logged the communication';
        COMMENT ON COLUMN communication_logs.communication_type IS 'Type of communication (Call, SMS, Email, Visit, Meeting, Other)';
        COMMENT ON COLUMN communication_logs.notes IS 'Detailed notes about the communication';
        COMMENT ON COLUMN communication_logs.follow_up_date IS 'Date for next follow-up if applicable';
        COMMENT ON COLUMN communication_logs.follow_up_notes IS 'Notes about the follow-up action required';
        
        RAISE NOTICE 'Table comments added successfully';
    END IF;
END $$;

-- Note: This table is designed to be flexible and can handle:
-- 1. Member-only logs (member_id populated, loan_id NULL)
-- 2. Loan-only logs (loan_id populated, member_id NULL) 
-- 3. Both member and loan logs (both populated)
-- The foreign key constraints are added conditionally to handle different database schemas

-- Final success message
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_logs') THEN
        RAISE NOTICE 'Migration completed successfully! communication_logs table is ready for use.';
    ELSE
        RAISE NOTICE 'Migration completed, but communication_logs table was not created.';
    END IF;
END $$;
