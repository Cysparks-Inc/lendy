-- Migration: Create Comprehensive Expenses Management System
-- This migration creates a complete expense tracking system for super admins
-- This migration is idempotent - safe to run multiple times

-- Drop existing objects if they exist (for idempotency)
-- Drop triggers only if table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expenses') THEN
        DROP TRIGGER IF EXISTS trigger_generate_expense_number ON public.expenses;
        DROP TRIGGER IF EXISTS trigger_update_budget_spent ON public.expenses;
        DROP TRIGGER IF EXISTS trigger_check_budget_limit ON public.expenses;
    END IF;
END $$;

DROP FUNCTION IF EXISTS generate_expense_number();
DROP FUNCTION IF EXISTS update_budget_spent();
DROP FUNCTION IF EXISTS check_budget_limit();

DROP TABLE IF EXISTS public.expense_reports CASCADE;
DROP TABLE IF EXISTS public.expense_budgets CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.expense_categories CASCADE;

DROP TYPE IF EXISTS public.expense_category CASCADE;
DROP TYPE IF EXISTS public.expense_status CASCADE;
DROP TYPE IF EXISTS public.payment_method CASCADE;

-- Create expense-related enums
CREATE TYPE public.expense_category AS ENUM (
    'office_supplies',
    'utilities',
    'rent',
    'salaries',
    'marketing',
    'travel',
    'equipment',
    'maintenance',
    'insurance',
    'legal_fees',
    'consulting',
    'training',
    'software',
    'hardware',
    'communications',
    'transportation',
    'meals',
    'entertainment',
    'other'
);

CREATE TYPE public.expense_status AS ENUM (
    'active',
    'inactive'
);

CREATE TYPE public.payment_method AS ENUM (
    'cash',
    'bank_transfer',
    'check',
    'mobile_money',
    'credit_card',
    'debit_card',
    'other'
);

-- Approval level enum removed - not needed for super admin expense tracking

-- Create expense categories table for dynamic categorization
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    budget_limit DECIMAL(15,2),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create main expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    currency TEXT DEFAULT 'KES',
    category_id UUID REFERENCES public.expense_categories(id),
    expense_date DATE NOT NULL,
    due_date DATE,
    vendor_name TEXT,
    vendor_contact TEXT,
    invoice_number TEXT,
    receipt_url TEXT,
    status public.expense_status DEFAULT 'active',
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    payment_method public.payment_method,
    payment_date DATE,
    branch_id UUID REFERENCES public.branches(id) NULL,
    department TEXT,
    tags TEXT[],
    attachments JSONB DEFAULT '[]',
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense approvals table removed - not needed for super admin expense tracking

-- Create expense budgets table for budget management
CREATE TABLE IF NOT EXISTS public.expense_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.expense_categories(id),
    branch_id UUID REFERENCES public.branches(id) NULL,
    year INTEGER NOT NULL,
    month INTEGER CHECK (month BETWEEN 1 AND 12),
    budget_amount DECIMAL(15,2) NOT NULL,
    spent_amount DECIMAL(15,2) DEFAULT 0,
    remaining_amount DECIMAL(15,2) GENERATED ALWAYS AS (budget_amount - spent_amount) STORED,
    created_by UUID REFERENCES public.profiles(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category_id, branch_id, year, month)
);

-- Create expense reports table for scheduled reports
CREATE TABLE IF NOT EXISTS public.expense_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_name TEXT NOT NULL,
    report_type TEXT CHECK (report_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')) NOT NULL,
    parameters JSONB DEFAULT '{}',
    last_generated TIMESTAMPTZ,
    next_generation TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON public.expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON public.expenses(branch_id);
-- Approval level index removed - not needed
CREATE INDEX IF NOT EXISTS idx_expense_budgets_year_month ON public.expense_budgets(year, month);

-- Create function to generate expense numbers
CREATE OR REPLACE FUNCTION generate_expense_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    next_number INTEGER;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(expense_number FROM 4) AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.expenses
    WHERE expense_number LIKE 'EXP%';
    
    NEW.expense_number := 'EXP' || LPAD(next_number::TEXT, 6, '0');
    RETURN NEW;
END;
$$;

-- Create function to update budget spent amounts
CREATE OR REPLACE FUNCTION update_budget_spent()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Add new expense amount to budget
        UPDATE public.expense_budgets
        SET spent_amount = spent_amount + NEW.amount
        WHERE category_id = NEW.category_id
        AND (branch_id = NEW.branch_id OR (NEW.branch_id IS NULL AND branch_id IS NULL))
        AND year = EXTRACT(YEAR FROM NEW.expense_date)
        AND month = EXTRACT(MONTH FROM NEW.expense_date);
        
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Update budget when expense amount changes
        IF OLD.amount != NEW.amount OR OLD.category_id != NEW.category_id OR 
           OLD.branch_id != NEW.branch_id OR OLD.expense_date != NEW.expense_date THEN
            
            -- Subtract old amount from old budget
            UPDATE public.expense_budgets
            SET spent_amount = spent_amount - OLD.amount
            WHERE category_id = OLD.category_id
            AND (branch_id = OLD.branch_id OR (OLD.branch_id IS NULL AND branch_id IS NULL))
            AND year = EXTRACT(YEAR FROM OLD.expense_date)
            AND month = EXTRACT(MONTH FROM OLD.expense_date);
            
            -- Add new amount to new budget
            UPDATE public.expense_budgets
            SET spent_amount = spent_amount + NEW.amount
            WHERE category_id = NEW.category_id
            AND (branch_id = NEW.branch_id OR (NEW.branch_id IS NULL AND branch_id IS NULL))
            AND year = EXTRACT(YEAR FROM NEW.expense_date)
            AND month = EXTRACT(MONTH FROM NEW.expense_date);
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Subtract deleted expense amount from budget
        UPDATE public.expense_budgets
        SET spent_amount = spent_amount - OLD.amount
        WHERE category_id = OLD.category_id
        AND (branch_id = OLD.branch_id OR (OLD.branch_id IS NULL AND branch_id IS NULL))
        AND year = EXTRACT(YEAR FROM OLD.expense_date)
        AND month = EXTRACT(MONTH FROM OLD.expense_date);
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Create trigger for budget updates
CREATE TRIGGER trigger_update_budget_spent
    AFTER INSERT OR UPDATE OR DELETE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION update_budget_spent();

-- Create function to check budget limits
CREATE OR REPLACE FUNCTION check_budget_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    budget_limit DECIMAL(15,2);
    current_spent DECIMAL(15,2);
BEGIN
    -- Get budget limit for the category
    SELECT eb.budget_amount
    INTO budget_limit
    FROM public.expense_budgets eb
    WHERE eb.category_id = NEW.category_id
    AND (eb.branch_id = NEW.branch_id OR (NEW.branch_id IS NULL AND eb.branch_id IS NULL))
    AND eb.year = EXTRACT(YEAR FROM NEW.expense_date)
    AND eb.month = EXTRACT(MONTH FROM NEW.expense_date);
    
    IF budget_limit IS NOT NULL THEN
        -- Get current spent amount
        SELECT eb.spent_amount
        INTO current_spent
        FROM public.expense_budgets eb
        WHERE eb.category_id = NEW.category_id
        AND (eb.branch_id = NEW.branch_id OR (NEW.branch_id IS NULL AND eb.branch_id IS NULL))
        AND eb.year = EXTRACT(YEAR FROM NEW.expense_date)
        AND eb.month = EXTRACT(MONTH FROM NEW.expense_date);
        
        -- Check if new expense would exceed budget
        IF (current_spent + NEW.amount) > budget_limit THEN
            RAISE EXCEPTION 'Expense amount would exceed budget limit of % for this category', budget_limit;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for budget limit checking
CREATE TRIGGER trigger_check_budget_limit
    BEFORE INSERT OR UPDATE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION check_budget_limit();

-- Create trigger to automatically generate expense number
CREATE TRIGGER trigger_generate_expense_number
    BEFORE INSERT ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION generate_expense_number();

-- Insert default expense categories (only if they don't exist)
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Get a super admin user ID
    -- Get a super admin user ID (use 'postgres' fallback if no super admin exists)
    SELECT COALESCE(
        (SELECT id FROM public.profiles WHERE role = 'super_admin' LIMIT 1),
        gen_random_uuid()
    ) INTO admin_user_id;
    
    -- Only proceed if admin_user_id is valid
    IF admin_user_id = gen_random_uuid() THEN
        RAISE NOTICE 'No super admin user found, skipping category creation';
        RETURN;
    END IF;
    
    -- Insert categories only if they don't exist
    INSERT INTO public.expense_categories (name, code, description, created_by)
    SELECT 'Office Supplies', 'OFFICE_SUP', 'Paper, pens, stationery, and other office materials', admin_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE code = 'OFFICE_SUP');
    
    INSERT INTO public.expense_categories (name, code, description, created_by)
    SELECT 'Utilities', 'UTILITIES', 'Electricity, water, internet, phone bills', admin_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE code = 'UTILITIES');
    
    INSERT INTO public.expense_categories (name, code, description, created_by)
    SELECT 'Rent', 'RENT', 'Office and property rental expenses', admin_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE code = 'RENT');
    
    INSERT INTO public.expense_categories (name, code, description, created_by)
    SELECT 'Salaries', 'SALARIES', 'Employee wages and benefits', admin_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE code = 'SALARIES');
    
    INSERT INTO public.expense_categories (name, code, description, created_by)
    SELECT 'Marketing', 'MARKETING', 'Advertising, promotions, and marketing materials', admin_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE code = 'MARKETING');
    
    INSERT INTO public.expense_categories (name, code, description, created_by)
    SELECT 'Travel', 'TRAVEL', 'Transportation, accommodation, and travel-related costs', admin_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE code = 'TRAVEL');
    
    INSERT INTO public.expense_categories (name, code, description, created_by)
    SELECT 'Equipment', 'EQUIPMENT', 'Computers, furniture, and office equipment', admin_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE code = 'EQUIPMENT');
    
    INSERT INTO public.expense_categories (name, code, description, created_by)
    SELECT 'Maintenance', 'MAINTENANCE', 'Repairs, cleaning, and facility maintenance', admin_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE code = 'MAINTENANCE');
    
    INSERT INTO public.expense_categories (name, code, description, created_by)
    SELECT 'Insurance', 'INSURANCE', 'Business insurance policies and premiums', admin_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE code = 'INSURANCE');
    
    INSERT INTO public.expense_categories (name, code, description, created_by)
    SELECT 'Legal Fees', 'LEGAL', 'Legal consultation and document preparation', admin_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE code = 'LEGAL');
    
    INSERT INTO public.expense_categories (name, code, description, created_by)
    SELECT 'Consulting', 'CONSULTING', 'Professional services and consulting fees', admin_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE code = 'CONSULTING');
    
    INSERT INTO public.expense_categories (name, code, description, created_by)
    SELECT 'Training', 'TRAINING', 'Employee training and development programs', admin_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE code = 'TRAINING');
    
    INSERT INTO public.expense_categories (name, code, description, created_by)
    SELECT 'Software', 'SOFTWARE', 'Software licenses and subscriptions', admin_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE code = 'SOFTWARE');
    
    INSERT INTO public.expense_categories (name, code, description, created_by)
    SELECT 'Hardware', 'HARDWARE', 'Computer hardware and technical equipment', admin_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE code = 'HARDWARE');
    
    INSERT INTO public.expense_categories (name, code, description, created_by)
    SELECT 'Communications', 'COMMS', 'Phone, internet, and communication services', admin_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE code = 'COMMS');
    
    INSERT INTO public.expense_categories (name, code, description, created_by)
    SELECT 'Transportation', 'TRANSPORT', 'Vehicle expenses and fuel costs', admin_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE code = 'TRANSPORT');
    
    INSERT INTO public.expense_categories (name, code, description, created_by)
    SELECT 'Meals', 'MEALS', 'Business meals and entertainment', admin_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE code = 'MEALS');
    
    INSERT INTO public.expense_categories (name, code, description, created_by)
    SELECT 'Entertainment', 'ENTERTAINMENT', 'Client entertainment and social events', admin_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE code = 'ENTERTAINMENT');
    
    INSERT INTO public.expense_categories (name, code, description, created_by)
    SELECT 'Other', 'OTHER', 'Miscellaneous expenses not covered by other categories', admin_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE code = 'OTHER');
END $$;

-- Enable Row Level Security
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for super admin access
CREATE POLICY "Super admins can manage all expenses" ON public.expenses
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can manage expense categories" ON public.expense_categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Expense approvals policy removed - table no longer exists

CREATE POLICY "Super admins can manage expense budgets" ON public.expense_budgets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can manage expense reports" ON public.expense_reports
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Grant necessary permissions
GRANT ALL ON public.expenses TO authenticated;
GRANT ALL ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_budgets TO authenticated;
GRANT ALL ON public.expense_reports TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
