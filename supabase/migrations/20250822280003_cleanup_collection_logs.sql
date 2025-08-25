-- Migration: Clean up old collection_logs table
-- Since we're now using the unified communication_logs table for all communications,
-- we can remove the old collection_logs table to avoid confusion

-- Drop the old collection_logs table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'collection_logs') THEN
        DROP TABLE IF EXISTS public.collection_logs CASCADE;
        RAISE NOTICE 'Dropped old collection_logs table - now using unified communication_logs table';
    ELSE
        RAISE NOTICE 'collection_logs table does not exist, no cleanup needed';
    END IF;
END $$;

-- Note: All communication and follow-up activities are now stored in the unified
-- communication_logs table, which handles:
-- 1. General communications (calls, SMS, emails, visits, meetings)
-- 2. Follow-up activities and reminders
-- 3. Collection-related communications
-- 4. Any other member or loan interactions
