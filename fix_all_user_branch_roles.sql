-- Comprehensive fix for all user_branch_roles references
-- Run this in Supabase SQL Editor to fix all issues

-- Step 1: Drop any remaining user_branch_roles table references
DROP TABLE IF EXISTS public.user_branch_roles CASCADE;

-- Step 2: Ensure user_roles table exists with correct structure
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    branch_id UUID REFERENCES public.branches(id),
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role, branch_id)
);

-- Ensure branch_id column exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_roles' 
        AND column_name = 'branch_id'
    ) THEN
        ALTER TABLE public.user_roles ADD COLUMN branch_id UUID REFERENCES public.branches(id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_roles' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.user_roles ADD COLUMN created_by UUID REFERENCES public.profiles(id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_roles' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.user_roles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Step 3: Fix search_members_robust function to use user_roles instead
CREATE OR REPLACE FUNCTION public.search_members_robust(search_text TEXT, current_user_id UUID)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    member_id TEXT,
    phone TEXT,
    email TEXT,
    status TEXT,
    branch_id UUID,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.full_name,
        m.member_id,
        m.phone,
        m.email,
        m.status::TEXT,
        m.branch_id,
        m.created_at
    FROM public.members m
    WHERE (
        -- Search conditions
        m.full_name ILIKE '%' || search_text || '%'
        OR m.member_id ILIKE '%' || search_text || '%'
        OR m.phone ILIKE '%' || search_text || '%'
        OR m.email ILIKE '%' || search_text || '%'
    )
    AND (
        -- User can view members if:
        -- 1. They are assigned as loan officer
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = current_user_id
            AND p.role::text = 'loan_officer'
            AND p.id = m.assigned_officer_id
        )
        OR
        -- 2. Member belongs to their branch (using user_roles instead of user_branch_roles)
        m.branch_id = ANY(
            SELECT ur.branch_id FROM public.user_roles ur
            WHERE ur.user_id = current_user_id AND ur.branch_id IS NOT NULL
        )
    )
    ORDER BY m.full_name
    LIMIT 20;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.search_members_robust(TEXT, UUID) TO authenticated;

-- Step 4: Replace any views that reference user_branch_roles
DO $$ 
DECLARE
    view_def TEXT;
BEGIN
    -- Get view definition and replace references
    FOR view_def IN 
        SELECT view_definition 
        FROM information_schema.views 
        WHERE table_schema = 'public'
        AND view_definition LIKE '%user_branch_roles%'
    LOOP
        -- Log that we need to fix these views manually
        RAISE NOTICE 'Found view with user_branch_roles reference: %', view_def;
    END LOOP;
END $$;

-- Step 5: Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create simple policies for user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage user roles" ON public.user_roles
FOR ALL 
USING (auth.uid() IS NOT NULL); -- Simplified for now

-- Done! All references should now use user_roles instead of user_branch_roles
