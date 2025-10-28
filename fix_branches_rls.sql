-- Fix branches table RLS policies
-- This allows authenticated users to view branches and super admins to manage them

-- Step 1: Drop all existing policies on branches
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'branches' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON branches';
    END LOOP;
END $$;

-- Step 2: Temporarily disable and re-enable RLS
ALTER TABLE branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Step 3: Create simple policies
-- Anyone authenticated can view branches
CREATE POLICY "branches_select_all" 
ON branches FOR SELECT 
TO authenticated 
USING (true);

-- Policy for service role (bypasses RLS but good to have explicitly)
CREATE POLICY "branches_service_role_all"
ON branches FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow authenticated users to insert branches (needed for initial setup)
CREATE POLICY "branches_insert_authenticated" 
ON branches FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow authenticated users to update branches
CREATE POLICY "branches_update_authenticated" 
ON branches FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete branches
CREATE POLICY "branches_delete_authenticated" 
ON branches FOR DELETE 
TO authenticated 
USING (true);

-- Grant permissions
GRANT ALL ON branches TO authenticated;

-- Done! Now you should be able to add branches
