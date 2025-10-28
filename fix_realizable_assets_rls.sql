-- Fix RLS policies for realizable_assets table to allow authenticated users to update and delete

BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view realizable assets" ON public.realizable_assets;
DROP POLICY IF EXISTS "Authenticated users can insert realizable assets" ON public.realizable_assets;
DROP POLICY IF EXISTS "Authenticated users can update realizable assets" ON public.realizable_assets;
DROP POLICY IF EXISTS "Only super admins can delete realizable assets" ON public.realizable_assets;

-- SELECT: All authenticated users can view
CREATE POLICY "Authenticated users can view realizable assets" 
ON public.realizable_assets 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- INSERT: Authenticated users can insert (with created_by check)
CREATE POLICY "Authenticated users can insert realizable assets" 
ON public.realizable_assets 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- UPDATE: Authenticated users can update their own assets, or super admins can update any
CREATE POLICY "Authenticated users can update realizable assets" 
ON public.realizable_assets 
FOR UPDATE 
USING (
    auth.uid() IS NOT NULL AND 
    (created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    ))
);

-- DELETE: Authenticated users can delete their own assets, or super admins can delete any
CREATE POLICY "Authenticated users can delete realizable assets" 
ON public.realizable_assets 
FOR DELETE 
USING (
    auth.uid() IS NOT NULL AND 
    (created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    ))
);

COMMIT;

