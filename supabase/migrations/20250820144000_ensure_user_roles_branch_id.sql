-- Ensure user_roles table has branch_id column
-- This fixes the "column ur.branch_id does not exist" error in dashboard

-- First, let's check the actual data type of branches.id
DO $$
DECLARE 
    branches_id_type TEXT;
BEGIN
    -- Get the data type of branches.id
    SELECT data_type INTO branches_id_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'branches' 
    AND column_name = 'id';
    
    -- Add branch_id column with the correct type
    IF branches_id_type = 'uuid' THEN
        -- branches.id is UUID, so use UUID
        ALTER TABLE public.user_roles 
        ADD COLUMN IF NOT EXISTS branch_id UUID;
        
        -- Add foreign key constraint
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'user_roles_branch_id_fkey' 
            AND table_name = 'user_roles'
        ) THEN
            ALTER TABLE public.user_roles 
            ADD CONSTRAINT user_roles_branch_id_fkey 
            FOREIGN KEY (branch_id) REFERENCES public.branches(id);
        END IF;
        
    ELSIF branches_id_type = 'bigint' THEN
        -- branches.id is BIGINT, so use BIGINT
        ALTER TABLE public.user_roles 
        ADD COLUMN IF NOT EXISTS branch_id BIGINT;
        
        -- Add foreign key constraint
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'user_roles_branch_id_fkey' 
            AND table_name = 'user_roles'
        ) THEN
            ALTER TABLE public.user_roles 
            ADD CONSTRAINT user_roles_branch_id_fkey 
            FOREIGN KEY (branch_id) REFERENCES public.branches(id);
        END IF;
        
    ELSE
        -- If branches table doesn't exist or has unknown type, just add the column without constraint
        ALTER TABLE public.user_roles 
        ADD COLUMN IF NOT EXISTS branch_id UUID;
    END IF;
END $$;

-- Also ensure created_by column exists (in case it's missing)
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

-- Add updated_at column if it doesn't exist
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for better performance on branch_id lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_branch_id ON public.user_roles(branch_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
