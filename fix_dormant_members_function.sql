-- Fix get_dormant_members function to use first_name and last_name instead of full_name

BEGIN;

-- Drop existing function
DROP FUNCTION IF EXISTS get_dormant_members();

-- Recreate with correct column names (only return full_name, not first_name and last_name)
CREATE OR REPLACE FUNCTION get_dormant_members()
RETURNS TABLE(
    id UUID,
    full_name TEXT,
    id_number TEXT,
    phone_number TEXT,
    branch_name TEXT,
    last_activity_date TIMESTAMPTZ,
    months_inactive INTEGER,
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
        TRIM(CONCAT(COALESCE(m.first_name, ''), ' ', COALESCE(m.last_name, ''))) as full_name,
        m.id_number,
        m.phone_number,
        b.name as branch_name,
        m.last_activity_date,
        EXTRACT(MONTH FROM AGE(NOW(), m.last_activity_date))::INTEGER as months_inactive,
        m.status,
        COALESCE(m.activation_fee_paid, false) as activation_fee_paid
    FROM public.members m
    LEFT JOIN public.branches b ON m.branch_id = b.id
    WHERE 
        m.last_activity_date < NOW() - INTERVAL '3 months'
        AND m.status = 'active'
    ORDER BY m.last_activity_date DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_dormant_members() TO authenticated;

COMMIT;

