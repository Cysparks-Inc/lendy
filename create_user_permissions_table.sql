-- Create user_permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, permission)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own permissions
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;
CREATE POLICY "Users can view their own permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow super admins to manage all permissions
DROP POLICY IF EXISTS "Super admins can manage all permissions" ON public.user_permissions;
CREATE POLICY "Super admins can manage all permissions"
ON public.user_permissions
FOR ALL
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'super_admin'
));

-- Grant access
GRANT SELECT ON public.user_permissions TO authenticated;

