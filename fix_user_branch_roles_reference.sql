-- Fix reference to non-existent user_branch_roles table
-- Replace all references with user_roles

-- Fix the search_members_robust function
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
            AND p.role = 'loan_officer'
            AND p.id = m.assigned_officer_id
        )
        OR
        -- 2. Member belongs to their branch (using user_roles)
        m.branch_id = ANY(
            SELECT ur.branch_id FROM public.user_roles ur
            WHERE ur.user_id = current_user_id AND branch_id IS NOT NULL
        )
    )
    ORDER BY m.full_name
    LIMIT 20;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.search_members_robust(TEXT, UUID) TO authenticated;
