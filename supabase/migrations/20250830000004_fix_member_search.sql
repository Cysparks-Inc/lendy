-- Fix Member Search Functionality
-- Run this in your Supabase SQL Editor to improve member search reliability

-- Create a simple, robust member search function
CREATE OR REPLACE FUNCTION search_members_simple(search_term TEXT)
RETURNS TABLE(
    id UUID,
    full_name TEXT,
    id_number TEXT,
    phone_number TEXT,
    branch_id UUID,
    group_id UUID,
    branch_name TEXT,
    group_name TEXT,
    status TEXT,
    activation_fee_paid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.full_name,
        m.id_number,
        m.phone_number,
        m.branch_id,
        m.group_id,
        b.name as branch_name,
        g.name as group_name,
        m.status,
        m.activation_fee_paid
    FROM public.members m
    LEFT JOIN public.branches b ON m.branch_id = b.id
    LEFT JOIN public.groups g ON m.group_id = g.id
    WHERE (
        m.full_name ILIKE '%' || search_term || '%' OR
        m.id_number ILIKE '%' || search_term || '%' OR
        m.phone_number ILIKE '%' || search_term || '%'
    )
    AND m.status = 'active'
    AND m.activation_fee_paid = true
    ORDER BY m.full_name
    LIMIT 20;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_members_simple(TEXT) TO authenticated;

-- Create an index to improve member search performance
CREATE INDEX IF NOT EXISTS idx_members_search_simple ON public.members 
USING gin(to_tsvector('english', full_name || ' ' || COALESCE(id_number, '') || ' ' || COALESCE(phone_number, '')));
