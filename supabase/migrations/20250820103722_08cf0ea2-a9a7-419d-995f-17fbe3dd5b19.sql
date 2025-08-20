-- Drop existing enum that conflicts
DROP TYPE IF EXISTS public.loan_status CASCADE;
DROP TYPE IF EXISTS public.interest_type CASCADE;
DROP TYPE IF EXISTS public.repayment_schedule CASCADE;

-- Create comprehensive microfinance database schema
-- 1. Create enums that don't exist
CREATE TYPE public.app_role AS ENUM ('super_admin', 'branch_admin', 'loan_officer', 'teller', 'auditor');
CREATE TYPE public.member_status AS ENUM ('active', 'inactive', 'suspended', 'deceased');
CREATE TYPE public.group_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE public.loan_status AS ENUM ('pending', 'approved', 'disbursed', 'active', 'completed', 'defaulted', 'written_off');
CREATE TYPE public.loan_interest_method AS ENUM ('flat', 'reducing_balance', 'simple');
CREATE TYPE public.payment_method AS ENUM ('cash', 'mobile_money', 'bank_transfer', 'cheque');
CREATE TYPE public.collateral_type AS ENUM ('land_title', 'vehicle', 'household_items', 'business_assets', 'guarantor');
CREATE TYPE public.document_type AS ENUM ('id_copy', 'passport_photo', 'business_permit', 'payslip', 'bank_statement', 'collateral_doc');

-- Create a super admin user in the existing profiles table
-- First, get the first user from auth.users (assuming it exists)
DO $$
DECLARE
    first_user_id UUID;
    first_branch_id UUID;
BEGIN
    -- Get the first user ID from auth.users
    SELECT id INTO first_user_id FROM auth.users LIMIT 1;
    
    -- Get the first branch ID
    SELECT id INTO first_branch_id FROM public.branches LIMIT 1;
    
    -- Only proceed if we have a user and branch
    IF first_user_id IS NOT NULL AND first_branch_id IS NOT NULL THEN
        -- Update or insert into profiles
        INSERT INTO public.profiles (id, full_name, email, phone_number, branch_id, employee_id, position, is_active)
        VALUES (
            first_user_id,
            'Super Administrator',
            (SELECT email FROM auth.users WHERE id = first_user_id),
            '+254700000000',
            first_branch_id,
            'EMP001',
            'Super Administrator',
            true
        )
        ON CONFLICT (id) DO UPDATE SET
            full_name = 'Super Administrator',
            branch_id = first_branch_id,
            employee_id = 'EMP001',
            position = 'Super Administrator',
            is_active = true;
        
        -- Assign super admin role
        INSERT INTO public.user_branch_roles (user_id, branch_id, role, assigned_by, is_active)
        VALUES (first_user_id, first_branch_id, 'super_admin', first_user_id, true)
        ON CONFLICT (user_id, branch_id, role) DO UPDATE SET
            is_active = true,
            assigned_at = NOW();
    END IF;
END $$;

-- Insert sample members and data for demonstration
DO $$
DECLARE
    nairobi_branch_id UUID;
    mombasa_branch_id UUID;
    sample_group_id UUID;
    sample_member_id UUID;
    sample_loan_id UUID;
    super_admin_id UUID;
BEGIN
    -- Get branch IDs
    SELECT id INTO nairobi_branch_id FROM public.branches WHERE code = 'NBC';
    SELECT id INTO mombasa_branch_id FROM public.branches WHERE code = 'MBA';
    
    -- Get super admin ID
    SELECT user_id INTO super_admin_id FROM public.user_branch_roles WHERE role = 'super_admin' LIMIT 1;
    
    IF nairobi_branch_id IS NOT NULL AND super_admin_id IS NOT NULL THEN
        -- Insert sample group
        INSERT INTO public.groups (id, branch_id, name, code, meeting_day, meeting_time, location, status, loan_officer_id, created_by)
        VALUES (
            gen_random_uuid(),
            nairobi_branch_id,
            'Upendo Self Help Group',
            'GRP001',
            2, -- Tuesday
            '14:00:00',
            'Community Center, Kawangware',
            'active',
            super_admin_id,
            super_admin_id
        )
        RETURNING id INTO sample_group_id;
        
        -- Insert sample members
        INSERT INTO public.members (
            id, branch_id, group_id, member_no, first_name, last_name, id_number, phone_number, 
            email, date_of_birth, gender, marital_status, address, occupation, monthly_income,
            next_of_kin_name, next_of_kin_phone, next_of_kin_relationship, status, 
            registration_fee_paid, shares_balance, savings_balance, created_by
        ) VALUES 
        (
            gen_random_uuid(), nairobi_branch_id, sample_group_id, 'MEM001', 'Alice', 'Wanjiku',
            '12345678', '+254712345678', 'alice.wanjiku@gmail.com', '1985-03-15', 'female', 'married',
            'Kawangware, Nairobi', 'Small Business Owner', 25000.00, 'John Wanjiku', '+254712345679',
            'Husband', 'active', true, 5000.00, 15000.00, super_admin_id
        ),
        (
            gen_random_uuid(), nairobi_branch_id, sample_group_id, 'MEM002', 'Mary', 'Njeri',
            '87654321', '+254787654321', 'mary.njeri@gmail.com', '1990-07-22', 'female', 'single',
            'Eastleigh, Nairobi', 'Hairdresser', 18000.00, 'Jane Njeri', '+254787654322',
            'Sister', 'active', true, 3000.00, 8000.00, super_admin_id
        ),
        (
            gen_random_uuid(), nairobi_branch_id, sample_group_id, 'MEM003', 'Peter', 'Kamau',
            '11223344', '+254798765432', 'peter.kamau@gmail.com', '1982-11-10', 'male', 'married',
            'Kibera, Nairobi', 'Mechanic', 30000.00, 'Grace Kamau', '+254798765433',
            'Wife', 'active', true, 7000.00, 12000.00, super_admin_id
        )
        RETURNING id INTO sample_member_id;
        
        -- Insert sample loans
        INSERT INTO public.loans (
            id, branch_id, member_id, group_id, loan_officer_id, application_no,
            principal_amount, interest_rate, interest_method, term_months, processing_fee,
            purpose, status, disbursed_amount, maturity_date, total_due, current_balance,
            created_by, applied_at, approved_at, approved_by, disbursed_at, disbursed_by
        ) VALUES (
            gen_random_uuid(), nairobi_branch_id, sample_member_id, sample_group_id, super_admin_id,
            'LOAN001', 50000.00, 0.15, 'reducing_balance', 12, 1000.00,
            'Business expansion', 'active', 49000.00, CURRENT_DATE + INTERVAL '12 months',
            57500.00, 42000.00, super_admin_id, NOW() - INTERVAL '2 months',
            NOW() - INTERVAL '2 months', super_admin_id, NOW() - INTERVAL '2 months', super_admin_id
        ) RETURNING id INTO sample_loan_id;
        
        -- Insert sample loan schedule
        INSERT INTO public.loan_schedule (
            loan_id, installment_no, due_date, principal_due, interest_due, total_due,
            principal_paid, interest_paid, total_paid, balance_after, is_paid, paid_at
        ) VALUES 
        (sample_loan_id, 1, CURRENT_DATE - INTERVAL '1 month', 4000.00, 625.00, 4625.00, 4000.00, 625.00, 4625.00, 46000.00, true, CURRENT_DATE - INTERVAL '1 month'),
        (sample_loan_id, 2, CURRENT_DATE, 4000.00, 575.00, 4575.00, 0.00, 0.00, 0.00, 42000.00, false, NULL),
        (sample_loan_id, 3, CURRENT_DATE + INTERVAL '1 month', 4000.00, 525.00, 4525.00, 0.00, 0.00, 0.00, 38000.00, false, NULL);
        
        -- Insert sample repayment
        INSERT INTO public.repayments (
            loan_id, schedule_id, receipt_no, amount, principal_portion, interest_portion,
            payment_method, payment_date, received_by
        ) SELECT 
            sample_loan_id, ls.id, 'RCT001', 4625.00, 4000.00, 625.00,
            'cash', CURRENT_DATE - INTERVAL '1 month', super_admin_id
        FROM public.loan_schedule ls 
        WHERE ls.loan_id = sample_loan_id AND ls.installment_no = 1;
    END IF;
END $$;