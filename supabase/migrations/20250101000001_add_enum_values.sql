-- First migration: Add only admin enum value
-- This must be committed before the value can be used

DO $$ 
DECLARE
    admin_exists boolean;
BEGIN
    -- Check if admin exists
    SELECT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'admin' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
    ) INTO admin_exists;
    
    -- Add admin if it doesn't exist
    IF NOT admin_exists THEN
        ALTER TYPE public.app_role ADD VALUE 'admin';
    END IF;
END $$;
