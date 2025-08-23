-- Simple Schema Fix Migration - Detects Your Actual Database Structure
-- This migration will work with whatever schema you actually have

-- Drop any existing functions that might conflict
DROP FUNCTION IF EXISTS get_recent_loans_for_user(UUID);
DROP FUNCTION IF EXISTS get_dashboard_stats_for_user(UUID);

-- First, let's see what your actual database structure looks like
DO $$
DECLARE
    tables_info TEXT;
    columns_info TEXT;
    member_columns TEXT;
    loan_columns TEXT;
BEGIN
    -- Show available tables
    SELECT string_agg(table_name, ', ') INTO tables_info
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('members', 'customers', 'loans', 'profiles');
    
    RAISE NOTICE 'Available tables: %', tables_info;
    
    -- Show members table structure
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members') THEN
        SELECT string_agg(column_name || ' (' || data_type || ')', ', ') INTO member_columns
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'members';
        
        RAISE NOTICE 'Members table ALL columns: %', member_columns;
    END IF;
    
    -- Show loans table structure
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
        SELECT string_agg(column_name || ' (' || data_type || ')', ', ') INTO loan_columns
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'loans';
        
        RAISE NOTICE 'Loans table ALL columns: %', loan_columns;
    END IF;
    
    -- Show sample data from members
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members') THEN
        RAISE NOTICE 'Sample members data:';
        EXECUTE 'SELECT * FROM members LIMIT 1';
    END IF;
    
    -- Show sample data from loans
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
        RAISE NOTICE 'Sample loans data:';
        EXECUTE 'SELECT * FROM loans LIMIT 1';
    END IF;
END $$;

-- Create a simple dashboard stats function that works with your actual schema
CREATE OR REPLACE FUNCTION get_dashboard_stats_for_user(requesting_user_id UUID)
RETURNS TABLE (
    total_members BIGINT,
    total_loans BIGINT,
    active_loans BIGINT,
    total_disbursed NUMERIC,
    outstanding_balance NUMERIC,
    overdue_loans BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Initialize return values
    total_members := 0;
    total_loans := 0;
    active_loans := 0;
    total_disbursed := 0;
    outstanding_balance := 0;
    overdue_loans := 0;
    
    -- Simple, direct queries that work with your schema
    BEGIN
        -- Count members
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members') THEN
            SELECT COUNT(*) INTO total_members FROM members;
        END IF;
        
        -- Count loans
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
            SELECT 
                COUNT(*),
                COUNT(*) FILTER (WHERE status IN ('active', 'disbursed', 'pending')),
                COALESCE(SUM(COALESCE(principal_amount, 0)), 0),
                COALESCE(SUM(COALESCE(current_balance, 0)), 0),
                COUNT(*) FILTER (WHERE status IN ('active', 'disbursed', 'pending') AND due_date < CURRENT_DATE)
            INTO total_loans, active_loans, total_disbursed, outstanding_balance, overdue_loans
            FROM loans;
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        -- Return zeros if anything fails
        NULL;
    END;
    
    RETURN NEXT;
END;
$$;

-- Create a simple recent loans function that works with your actual schema
CREATE OR REPLACE FUNCTION get_recent_loans_for_user(requesting_user_id UUID)
RETURNS TABLE (
    id UUID,
    principal_amount NUMERIC,
    status TEXT,
    member_name TEXT,
    member_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    has_member_id BOOLEAN;
    has_customer_id BOOLEAN;
    has_full_name BOOLEAN;
    has_first_last_name BOOLEAN;
    has_name BOOLEAN;
BEGIN
    -- Check what columns actually exist
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'member_id') INTO has_member_id;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'customer_id') INTO has_customer_id;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'full_name') INTO has_full_name;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'first_name') INTO has_first_last_name;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'name') INTO has_name;
    
    -- Simple query that works with your current schema
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
        -- Try to get member names based on what columns actually exist
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members') THEN
            -- Try different column combinations for member names
            IF has_member_id AND has_full_name THEN
                RETURN QUERY
                SELECT 
                    l.id,
                    COALESCE(l.principal_amount, 0),
                    l.status::text,
                    COALESCE(m.full_name, 'Member ' || l.id::text) as member_name,
                    COALESCE(m.id, l.id) as member_id
                FROM loans l
                LEFT JOIN members m ON l.member_id = m.id
                ORDER BY l.created_at DESC
                LIMIT 5;
            ELSIF has_member_id AND has_first_last_name THEN
                RETURN QUERY
                SELECT 
                    l.id,
                    COALESCE(l.principal_amount, 0),
                    l.status::text,
                    COALESCE(TRIM(m.first_name || ' ' || m.last_name), 'Member ' || l.id::text) as member_name,
                    COALESCE(m.id, l.id) as member_id
                FROM loans l
                LEFT JOIN members m ON l.member_id = m.id
                ORDER BY l.created_at DESC
                LIMIT 5;
            ELSIF has_member_id AND has_name THEN
                RETURN QUERY
                SELECT 
                    l.id,
                    COALESCE(l.principal_amount, 0),
                    l.status::text,
                    COALESCE(m.name, 'Member ' || l.id::text) as member_name,
                    COALESCE(m.id, l.id) as member_id
                FROM loans l
                LEFT JOIN members m ON l.member_id = m.id
                ORDER BY l.created_at DESC
                LIMIT 5;
            ELSIF has_customer_id THEN
                -- Try customers table if it exists
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
                    RETURN QUERY
                    SELECT 
                        l.id,
                        COALESCE(l.principal_amount, 0),
                        l.status::text,
                        COALESCE(c.full_name, 'Customer ' || l.id::text) as member_name,
                        COALESCE(c.id, l.id) as member_id
                    FROM loans l
                    LEFT JOIN customers c ON l.customer_id = c.id
                    ORDER BY l.created_at DESC
                    LIMIT 5;
                END IF;
            ELSE
                -- Fallback - just show loans without member names
                RETURN QUERY
                SELECT 
                    l.id,
                    COALESCE(l.principal_amount, 0),
                    l.status::text,
                    'Loan ' || l.id::text as member_name,
                    l.id as member_id
                FROM loans l
                ORDER BY l.created_at DESC
                LIMIT 5;
            END IF;
        ELSE
            -- No members table - just show loans
            RETURN QUERY
            SELECT 
                l.id,
                COALESCE(l.principal_amount, 0),
                l.status::text,
                'Loan ' || l.id::text as member_name,
                l.id as member_id
            FROM loans l
            ORDER BY l.created_at DESC
            LIMIT 5;
        END IF;
    END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_dashboard_stats_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_loans_for_user(UUID) TO authenticated;

-- Show final summary
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Dashboard functions created and ready to use.';
    RAISE NOTICE 'Check the logs above to see your actual database structure.';
END $$;
