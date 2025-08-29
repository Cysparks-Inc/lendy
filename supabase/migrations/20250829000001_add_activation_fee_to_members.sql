-- Migration: Add activation_fee_paid field to members table
-- This allows tracking of activation fees for dormant members

-- Add the activation_fee_paid column to members table
DO $$ 
BEGIN
    -- Check if column doesn't exist before adding
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'members' AND column_name = 'activation_fee_paid'
    ) THEN
        ALTER TABLE public.members ADD COLUMN activation_fee_paid BOOLEAN DEFAULT false;
        
        -- Add index for better performance
        CREATE INDEX IF NOT EXISTS idx_members_activation_fee_paid ON public.members(activation_fee_paid);
        
        -- Add comment
        COMMENT ON COLUMN public.members.activation_fee_paid IS 'Whether the member has paid the KES 500 activation fee to reactivate from dormant status';
    END IF;
END $$;

-- Add last_activity_date column to track when member was last active
DO $$ 
BEGIN
    -- Check if column doesn't exist before adding
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'members' AND column_name = 'last_activity_date'
    ) THEN
        ALTER TABLE public.members ADD COLUMN last_activity_date TIMESTAMPTZ DEFAULT NOW();
        
        -- Add index for better performance
        CREATE INDEX IF NOT EXISTS idx_members_last_activity_date ON public.members(last_activity_date);
        
        -- Add comment
        COMMENT ON COLUMN public.members.last_activity_date IS 'Date when member was last active (had loan activity or made payments)';
    END IF;
END $$;

-- Add registration_fee_paid column to track registration fees
DO $$ 
BEGIN
    -- Check if column doesn't exist before adding
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'members' AND column_name = 'registration_fee_paid'
    ) THEN
        ALTER TABLE public.members ADD COLUMN registration_fee_paid BOOLEAN DEFAULT false;
        
        -- Add index for better performance
        CREATE INDEX IF NOT EXISTS idx_members_registration_fee_paid ON public.members(registration_fee_paid);
        
        -- Add comment
        COMMENT ON COLUMN public.members.registration_fee_paid IS 'Whether the member has paid the KES 500 registration fee';
    END IF;
END $$;

-- Create function to update last_activity_date when loans are created or payments are made
-- Drop existing function first to avoid conflicts
DROP FUNCTION IF EXISTS update_member_last_activity() CASCADE;

CREATE OR REPLACE FUNCTION update_member_last_activity()
RETURNS TRIGGER AS $$
DECLARE
    member_uuid UUID;
BEGIN
    -- Add debugging information
    RAISE NOTICE 'update_member_last_activity called for table: %', TG_TABLE_NAME;
    
    -- Get member ID based on the table being triggered
    IF TG_TABLE_NAME = 'loans' THEN
        -- For loans table, member_id is member_id
        member_uuid := NEW.member_id;
        RAISE NOTICE 'Loans table: member_id = %', member_uuid;
    ELSIF TG_TABLE_NAME = 'loan_payments' THEN
        -- For loan_payments table, get member_id from the loan
        SELECT member_id INTO member_uuid
        FROM public.loans
        WHERE id = NEW.loan_id;
        RAISE NOTICE 'Loan payments table: loan_id = %, member_id = %', NEW.loan_id, member_uuid;
    ELSE
        -- Unknown table, return without error
        RAISE NOTICE 'Unknown table: %', TG_TABLE_NAME;
        RETURN NEW;
    END IF;
    
    -- Update last_activity_date for the member if we found one
    IF member_uuid IS NOT NULL THEN
        BEGIN
            UPDATE public.members 
            SET last_activity_date = NOW()
            WHERE id = member_uuid;
            RAISE NOTICE 'Updated member activity for member: %', member_uuid;
        EXCEPTION WHEN OTHERS THEN
            -- Log error but don't fail the transaction
            RAISE WARNING 'Failed to update member activity for member %: %', member_uuid, SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'No member_id found, skipping update';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update member activity when loans are created
DROP TRIGGER IF EXISTS trigger_update_member_activity_on_loan ON public.loans;
CREATE TRIGGER trigger_update_member_activity_on_loan
    AFTER INSERT ON public.loans
    FOR EACH ROW
    EXECUTE FUNCTION update_member_last_activity();

-- Create trigger to update member activity when payments are made
-- Drop existing trigger first to avoid conflicts
DROP TRIGGER IF EXISTS trigger_update_member_activity_on_payment ON public.loan_payments;
CREATE TRIGGER trigger_update_member_activity_on_payment
    AFTER INSERT ON public.loan_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_member_last_activity();

-- Create function to identify dormant members (inactive for 3+ months)
-- Drop existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS get_dormant_members();

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
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.full_name,
        m.id_number,
        m.phone_number,
        b.name as branch_name,
        m.last_activity_date,
        EXTRACT(MONTH FROM AGE(NOW(), m.last_activity_date))::INTEGER as months_inactive,
        m.status,
        m.activation_fee_paid
    FROM public.members m
    LEFT JOIN public.branches b ON m.branch_id = b.id
    WHERE 
        m.last_activity_date < NOW() - INTERVAL '3 months'
        AND m.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_dormant_members() TO authenticated;

-- Create function to activate a dormant member
CREATE OR REPLACE FUNCTION activate_dormant_member(member_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Update member to mark activation fee as paid and update last activity
    UPDATE public.members 
    SET 
        activation_fee_paid = true,
        last_activity_date = NOW(),
        updated_at = NOW()
    WHERE id = member_uuid;
    
    -- Return true if update was successful
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the activation function
GRANT EXECUTE ON FUNCTION activate_dormant_member(UUID) TO authenticated;

-- Add unique constraint on id_number to prevent duplicate members
DO $$ 
BEGIN
    -- Check if unique constraint doesn't exist before adding
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'members_id_number_unique'
    ) THEN
        -- Add unique constraint on id_number
        ALTER TABLE public.members ADD CONSTRAINT members_id_number_unique UNIQUE (id_number);
        
        -- Add comment
        COMMENT ON CONSTRAINT members_id_number_unique ON public.members IS 'Ensures each ID number is unique across all members';
    END IF;
END $$;

-- Make id_number NOT NULL to enforce it's always provided
DO $$ 
BEGIN
    -- Check if column is already NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'members' 
        AND column_name = 'id_number' 
        AND is_nullable = 'YES'
    ) THEN
        -- Make id_number NOT NULL
        ALTER TABLE public.members ALTER COLUMN id_number SET NOT NULL;
        
        -- Add comment
        COMMENT ON COLUMN public.members.id_number IS 'KYC ID number - must be unique and is required for all members';
    END IF;
END $$;
