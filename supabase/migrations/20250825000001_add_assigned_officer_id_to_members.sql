-- Migration: Add assigned_officer_id field to members table
-- This allows members to be assigned to specific loan officers

-- Add the assigned_officer_id column to members table
DO $$ 
BEGIN
    -- Check if column doesn't exist before adding
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'members' AND column_name = 'assigned_officer_id'
    ) THEN
        ALTER TABLE public.members ADD COLUMN assigned_officer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
        
        -- Add index for better performance
        CREATE INDEX IF NOT EXISTS idx_members_assigned_officer_id ON public.members(assigned_officer_id);
        
        -- Add comment
        COMMENT ON COLUMN public.members.assigned_officer_id IS 'ID of the loan officer assigned to manage this member';
    END IF;
END $$;

-- Update RLS policies to include assigned_officer_id
DO $$ 
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Members can view own profile" ON public.members;
    DROP POLICY IF EXISTS "Loan officers can view assigned members" ON public.members;
    DROP POLICY IF EXISTS "Branch admins can view branch members" ON public.members;
    DROP POLICY IF EXISTS "Super admins can view all members" ON public.members;
    DROP POLICY IF EXISTS "Super admins can insert/update members" ON public.members;
    DROP POLICY IF EXISTS "Branch admins can insert/update branch members" ON public.members;
    DROP POLICY IF EXISTS "Loan officers can update assigned members" ON public.members;
    
    -- Create new policies with assigned_officer_id support
    CREATE POLICY "Members can view own profile" ON public.members
        FOR SELECT USING (auth.uid() = id);
    
    CREATE POLICY "Loan officers can view assigned members" ON public.members
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() 
                AND role = 'loan_officer' 
                AND id = members.assigned_officer_id
            )
        );
    
    CREATE POLICY "Branch admins can view branch members" ON public.members
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() 
                AND role = 'branch_admin' 
                AND branch_id = members.branch_id
            )
        );
    
    CREATE POLICY "Super admins can view all members" ON public.members
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() 
                AND role = 'super_admin'
            )
        );
    
    -- Insert/Update policies
    CREATE POLICY "Super admins can insert/update members" ON public.members
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() 
                AND role = 'super_admin'
            )
        );
    
    CREATE POLICY "Branch admins can insert/update branch members" ON public.members
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() 
                AND role = 'branch_admin' 
                AND branch_id = members.branch_id
            )
        );
    
    CREATE POLICY "Loan officers can update assigned members" ON public.members
        FOR UPDATE USING (
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() 
                AND role = 'loan_officer' 
                AND id = members.assigned_officer_id
            )
        );
END $$;

-- Create function to transfer member data when loan officer changes
CREATE OR REPLACE FUNCTION transfer_member_to_new_officer(
    member_id_param uuid,
    new_officer_id_param uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    old_officer_id uuid;
    member_name text;
BEGIN
    -- Get current officer and member name
    SELECT assigned_officer_id, full_name INTO old_officer_id, member_name
    FROM public.members 
    WHERE id = member_id_param;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Member not found';
    END IF;
    
    -- Update the member's assigned officer
    UPDATE public.members 
    SET assigned_officer_id = new_officer_id_param,
        updated_at = NOW()
    WHERE id = member_id_param;
    
    -- Update all loans for this member to have the new loan officer
    UPDATE public.loans 
    SET loan_officer_id = new_officer_id_param,
        updated_at = NOW()
    WHERE member_id = member_id_param OR customer_id = member_id_param;
    
    -- Log the transfer in communication logs if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_logs') THEN
        INSERT INTO public.communication_logs (
            member_id,
            officer_id,
            communication_type,
            notes,
            created_at,
            updated_at
        ) VALUES (
            member_id_param,
            new_officer_id_param,
            'Other',
            format('[TRANSFER] Member transferred from officer %s to %s. All loans and communication history moved with member.', 
                   COALESCE((SELECT full_name FROM public.profiles WHERE id = old_officer_id), 'Unassigned'),
                   (SELECT full_name FROM public.profiles WHERE id = new_officer_id_param)
            ),
            NOW(),
            NOW()
        );
    END IF;
    
    -- Log the action
    RAISE NOTICE 'Member % transferred from officer % to officer %', 
        member_name,
        COALESCE((SELECT full_name FROM public.profiles WHERE id = old_officer_id), 'Unassigned'),
        (SELECT full_name FROM public.profiles WHERE id = new_officer_id_param);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION transfer_member_to_new_officer TO authenticated;

-- Create function to assign unassigned members to a loan officer
CREATE OR REPLACE FUNCTION assign_unassigned_members_to_officer(
    officer_id_param uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    assigned_count integer;
    officer_name text;
BEGIN
    -- Get officer name
    SELECT full_name INTO officer_name
    FROM public.profiles 
    WHERE id = officer_id_param;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Loan officer not found';
    END IF;
    
    -- Assign unassigned members to this officer
    UPDATE public.members 
    SET assigned_officer_id = officer_id_param,
        updated_at = NOW()
    WHERE assigned_officer_id IS NULL;
    
    GET DIAGNOSTICS assigned_count = ROW_COUNT;
    
    -- Log the action
    RAISE NOTICE 'Assigned % unassigned members to officer %', assigned_count, officer_name;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION assign_unassigned_members_to_officer TO authenticated;

-- Create trigger to automatically update loan_officer_id when assigned_officer_id changes
CREATE OR REPLACE FUNCTION update_loan_officer_on_member_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- If assigned_officer_id changed, update all loans for this member
    IF OLD.assigned_officer_id IS DISTINCT FROM NEW.assigned_officer_id THEN
        UPDATE public.loans 
        SET loan_officer_id = NEW.assigned_officer_id,
            updated_at = NOW()
        WHERE member_id = NEW.id OR customer_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create the trigger
DO $$ 
BEGIN
    DROP TRIGGER IF EXISTS trigger_update_loan_officer_on_member_transfer ON public.members;
    
    CREATE TRIGGER trigger_update_loan_officer_on_member_transfer
        AFTER UPDATE OF assigned_officer_id ON public.members
        FOR EACH ROW
        EXECUTE FUNCTION update_loan_officer_on_member_transfer();
END $$;
