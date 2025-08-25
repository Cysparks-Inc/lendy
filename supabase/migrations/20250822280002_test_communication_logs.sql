-- Test Migration: Verify Communication Logs Table
-- This migration tests that the communication_logs table can be created and used

-- Only run tests if the table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_logs') THEN
        -- Test inserting a simple communication log without foreign key constraints
        INSERT INTO communication_logs (
            member_id,
            loan_id,
            officer_id,
            communication_type,
            notes
        ) VALUES (
            NULL,
            NULL,
            NULL,
            'Test',
            'Test communication log to verify table structure'
        ) ON CONFLICT DO NOTHING;

        -- Clean up test data
        DELETE FROM communication_logs WHERE notes = 'Test communication log to verify table structure';

        -- Verify the table structure
        -- Check if required columns exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'communication_logs' AND column_name = 'id'
        ) THEN
            RAISE EXCEPTION 'id column missing from communication_logs';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'communication_logs' AND column_name = 'communication_type'
        ) THEN
            RAISE EXCEPTION 'communication_type column missing from communication_logs';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'communication_logs' AND column_name = 'notes'
        ) THEN
            RAISE EXCEPTION 'notes column missing from communication_logs';
        END IF;
        
        RAISE NOTICE 'communication_logs table structure verified successfully';
    ELSE
        RAISE NOTICE 'communication_logs table does not exist, skipping tests';
    END IF;
END $$;
