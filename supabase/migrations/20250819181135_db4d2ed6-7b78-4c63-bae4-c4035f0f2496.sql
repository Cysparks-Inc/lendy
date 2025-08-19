-- LendWise Financial Management System Database Schema

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- Create enum for loan status
CREATE TYPE public.loan_status AS ENUM ('active', 'repaid', 'defaulted');

-- Create enum for interest type
CREATE TYPE public.interest_type AS ENUM ('simple', 'compound');

-- Create enum for repayment schedule
CREATE TYPE public.repayment_schedule AS ENUM ('weekly', 'monthly');

-- Create profiles table for user management
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create user_roles table for role-based access
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL,
    assigned_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- Create customers table
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    id_number TEXT UNIQUE NOT NULL,
    phone_number TEXT NOT NULL,
    address TEXT,
    notes TEXT,
    next_of_kin_name TEXT,
    next_of_kin_phone TEXT,
    next_of_kin_relationship TEXT,
    group_assignment TEXT,
    created_by UUID REFERENCES public.profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create loans table
CREATE TABLE public.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    principal_amount DECIMAL(15,2) NOT NULL CHECK (principal_amount > 0),
    interest_rate DECIMAL(5,2) NOT NULL CHECK (interest_rate >= 0),
    interest_type public.interest_type NOT NULL,
    repayment_schedule public.repayment_schedule NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    status public.loan_status NOT NULL DEFAULT 'active',
    current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_interest_accrued DECIMAL(15,2) NOT NULL DEFAULT 0,
    late_payment_penalty_rate DECIMAL(5,2) DEFAULT 5.0,
    penalty_type TEXT DEFAULT 'percentage' CHECK (penalty_type IN ('flat', 'percentage')),
    created_by UUID REFERENCES public.profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create repayments table
CREATE TABLE public.repayments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    recorded_by UUID REFERENCES public.profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create audit_log table for security and compliance
CREATE TABLE public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Function to check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE p.id = _user_id
        AND ur.role = _role
    );
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT public.has_role(_user_id, 'admin');
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- RLS Policies for user_roles (only admins can manage roles)
CREATE POLICY "Admins can manage all roles"
    ON public.user_roles FOR ALL
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own roles"
    ON public.user_roles FOR SELECT
    USING (user_id = auth.uid());

-- RLS Policies for customers (admins and staff can access)
CREATE POLICY "Authenticated users can view customers"
    ON public.customers FOR SELECT
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'staff')
    );

CREATE POLICY "Authenticated users can insert customers"
    ON public.customers FOR INSERT
    TO authenticated
    WITH CHECK (
        (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
        AND created_by = auth.uid()
    );

CREATE POLICY "Authenticated users can update customers"
    ON public.customers FOR UPDATE
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'staff')
    );

CREATE POLICY "Only admins can delete customers"
    ON public.customers FOR DELETE
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- RLS Policies for loans (same as customers)
CREATE POLICY "Authenticated users can view loans"
    ON public.loans FOR SELECT
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'staff')
    );

CREATE POLICY "Authenticated users can insert loans"
    ON public.loans FOR INSERT
    TO authenticated
    WITH CHECK (
        (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
        AND created_by = auth.uid()
    );

CREATE POLICY "Authenticated users can update loans"
    ON public.loans FOR UPDATE
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'staff')
    );

CREATE POLICY "Only admins can delete loans"
    ON public.loans FOR DELETE
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- RLS Policies for repayments
CREATE POLICY "Authenticated users can view repayments"
    ON public.repayments FOR SELECT
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'staff')
    );

CREATE POLICY "Authenticated users can insert repayments"
    ON public.repayments FOR INSERT
    TO authenticated
    WITH CHECK (
        (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
        AND recorded_by = auth.uid()
    );

-- RLS Policies for audit_log (read-only for most, full access for admins)
CREATE POLICY "Admins can view all audit logs"
    ON public.audit_log FOR SELECT
    TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Staff can view their own actions in audit log"
    ON public.audit_log FOR SELECT
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'staff') AND 
        user_id = auth.uid()
    );

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, phone_number)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.email,
        NEW.raw_user_meta_data->>'phone_number'
    );
    RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_loans_updated_at
    BEFORE UPDATE ON public.loans
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Function to calculate loan interest and update balance
CREATE OR REPLACE FUNCTION public.calculate_loan_interest()
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
    loan_record RECORD;
    days_elapsed INTEGER;
    daily_rate DECIMAL(10,8);
    new_interest DECIMAL(15,2);
    penalty_amount DECIMAL(15,2);
BEGIN
    -- Process all active loans
    FOR loan_record IN 
        SELECT * FROM public.loans WHERE status = 'active'
    LOOP
        -- Calculate days since issue date
        days_elapsed := CURRENT_DATE - loan_record.issue_date;
        
        IF days_elapsed > 0 THEN
            -- Calculate interest based on type
            IF loan_record.interest_type = 'simple' THEN
                -- Simple interest: Principal × Rate × Time
                new_interest := loan_record.principal_amount * (loan_record.interest_rate / 100) * (days_elapsed / 365.0);
            ELSE
                -- Compound interest (daily compounding)
                daily_rate := loan_record.interest_rate / 100 / 365;
                new_interest := loan_record.principal_amount * (POWER(1 + daily_rate, days_elapsed) - 1);
            END IF;
            
            -- Calculate late payment penalty if overdue
            penalty_amount := 0;
            IF CURRENT_DATE > loan_record.due_date THEN
                IF loan_record.penalty_type = 'flat' THEN
                    penalty_amount := loan_record.late_payment_penalty_rate;
                ELSE
                    penalty_amount := loan_record.current_balance * (loan_record.late_payment_penalty_rate / 100);
                END IF;
            END IF;
            
            -- Update loan with new interest and balance
            UPDATE public.loans 
            SET 
                total_interest_accrued = new_interest,
                current_balance = principal_amount + new_interest + penalty_amount,
                updated_at = NOW()
            WHERE id = loan_record.id;
        END IF;
    END LOOP;
END;
$$;

-- Function to log audit trail
CREATE OR REPLACE FUNCTION public.log_audit_trail()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_values)
        VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_values, new_values)
        VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_log (user_id, action, table_name, record_id, new_values)
        VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;

-- Create audit triggers for all main tables
CREATE TRIGGER customers_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

CREATE TRIGGER loans_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.loans
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

CREATE TRIGGER repayments_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.repayments
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

-- Function to update loan balance after repayment
CREATE OR REPLACE FUNCTION public.update_loan_balance_after_repayment()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
    loan_record RECORD;
    total_repaid DECIMAL(15,2);
BEGIN
    -- Get the loan record
    SELECT * INTO loan_record FROM public.loans WHERE id = NEW.loan_id;
    
    -- Calculate total repayments for this loan
    SELECT COALESCE(SUM(amount), 0) INTO total_repaid
    FROM public.repayments 
    WHERE loan_id = NEW.loan_id;
    
    -- Update current balance (principal + interest - total repaid)
    UPDATE public.loans 
    SET 
        current_balance = GREATEST(0, principal_amount + total_interest_accrued - total_repaid),
        status = CASE 
            WHEN (principal_amount + total_interest_accrued - total_repaid) <= 0 THEN 'repaid'::public.loan_status
            ELSE status
        END,
        updated_at = NOW()
    WHERE id = NEW.loan_id;
    
    RETURN NEW;
END;
$$;

-- Trigger to update loan balance after repayment
CREATE TRIGGER update_loan_after_repayment
    AFTER INSERT ON public.repayments
    FOR EACH ROW EXECUTE FUNCTION public.update_loan_balance_after_repayment();

-- Create indexes for better performance
CREATE INDEX idx_customers_id_number ON public.customers(id_number);
CREATE INDEX idx_loans_customer_id ON public.loans(customer_id);
CREATE INDEX idx_loans_status ON public.loans(status);
CREATE INDEX idx_loans_due_date ON public.loans(due_date);
CREATE INDEX idx_repayments_loan_id ON public.repayments(loan_id);
CREATE INDEX idx_repayments_payment_date ON public.repayments(payment_date);
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_timestamp ON public.audit_log(timestamp);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);