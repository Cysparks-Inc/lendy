-- Fix: Update RLS policies for profiles table to allow updating is_active, deactivated_at, and deactivated_by
BEGIN;

-- Drop existing restrictive update policies
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;

-- Create policy to allow authenticated users to update profiles
CREATE POLICY "Authenticated users can update profiles"
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

COMMIT;

