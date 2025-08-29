-- Migration: Add Loan Program and Enhanced Loan Fields
-- This migration adds loan program field and enhances the loan system

-- Add loan_program field to loans table
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS loan_program TEXT CHECK (loan_program IN ('small_loan', 'big_loan'));

-- Add installment_type field to loans table
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS installment_type TEXT DEFAULT 'weekly' CHECK (installment_type IN ('weekly', 'monthly', 'daily'));

-- Add processing_fee field to loans table
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS processing_fee DECIMAL(15,2) DEFAULT 0;

-- Add total_disbursed field to loans table
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS total_disbursed DECIMAL(15,2) DEFAULT 0;

-- Add interest_disbursed field to loans table
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS interest_disbursed DECIMAL(15,2) DEFAULT 0;

-- Note: branch_id, group_id, loan_officer_id, and issue_date already exist in the loans table

-- Create function to calculate loan details based on program
CREATE OR REPLACE FUNCTION calculate_loan_details(
    p_principal DECIMAL,
    p_loan_program TEXT
)
RETURNS TABLE(
    interest_rate DECIMAL,
    repayment_weeks INTEGER,
    processing_fee DECIMAL,
    interest_amount DECIMAL,
    total_disbursed DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN p_loan_program = 'small_loan' THEN 15.0
            WHEN p_loan_program = 'big_loan' THEN 20.0
            ELSE 15.0
        END as interest_rate,
        CASE 
            WHEN p_loan_program = 'small_loan' THEN 8
            WHEN p_loan_program = 'big_loan' THEN 12
            ELSE 8
        END as repayment_weeks,
        ROUND(p_principal * 0.06, 2) as processing_fee,
        ROUND(p_principal * 
            CASE 
                WHEN p_loan_program = 'small_loan' THEN 0.15
                WHEN p_loan_program = 'big_loan' THEN 0.20
                ELSE 0.15
            END, 2) as interest_amount,
        ROUND(p_principal + 
            (p_principal * 
                CASE 
                    WHEN p_loan_program = 'small_loan' THEN 0.15
                    WHEN p_loan_program = 'big_loan' THEN 0.20
                    ELSE 0.15
                END) + 
            (p_principal * 0.06), 2) as total_disbursed;
END;
$$;

-- Create function to generate installment schedule
CREATE OR REPLACE FUNCTION generate_installment_schedule(
    p_loan_id UUID,
    p_issue_date DATE,
    p_principal DECIMAL,
    p_interest_amount DECIMAL,
    p_repayment_weeks INTEGER,
    p_installment_type TEXT DEFAULT 'weekly'
)
RETURNS TABLE(
    installment_number INTEGER,
    due_date DATE,
    principal_amount DECIMAL,
    interest_amount DECIMAL,
    total_amount DECIMAL
)
LANGUAGE plpgsql
AS $$
DECLARE
    weekly_principal DECIMAL;
    weekly_interest DECIMAL;
    installment_date DATE;
    i INTEGER;
BEGIN
    -- Calculate weekly amounts
    weekly_principal := ROUND(p_principal / p_repayment_weeks, 2);
    weekly_interest := ROUND(p_interest_amount / p_repayment_weeks, 2);
    
    -- Start from issue date
    installment_date := p_issue_date;
    
    -- Generate installments
    FOR i IN 1..p_repayment_weeks LOOP
        -- Add weeks to issue date
        installment_date := p_issue_date + (i * INTERVAL '1 week');
        
        -- Adjust for last installment to handle rounding
        IF i = p_repayment_weeks THEN
            weekly_principal := p_principal - (weekly_principal * (p_repayment_weeks - 1));
            weekly_interest := p_interest_amount - (weekly_interest * (p_repayment_weeks - 1));
        END IF;
        
        RETURN QUERY
        SELECT 
            i as installment_number,
            installment_date as due_date,
            weekly_principal as principal_amount,
            weekly_interest as interest_amount,
            (weekly_principal + weekly_interest) as total_amount;
    END LOOP;
END;
$$;

-- Create view for loan installment schedule
-- This view provides a comprehensive breakdown of all loan installments
-- with loan details and installment information
CREATE OR REPLACE VIEW loan_installment_schedule AS
SELECT 
    l.id as loan_id,
    l.loan_program,
    l.principal_amount,
    l.interest_disbursed,
    l.total_disbursed,
    l.issue_date,
    l.installment_type,
    CASE 
        WHEN l.loan_program = 'small_loan' THEN 8
        WHEN l.loan_program = 'big_loan' THEN 12
        ELSE 8
    END as repayment_weeks,
    i.installment_number,
    i.due_date,
    i.principal_amount as installment_principal,
    i.interest_amount as installment_interest,
    i.total_amount as installment_total
FROM loans l
    -- Use CROSS JOIN LATERAL to expand the function results into rows
    CROSS JOIN LATERAL generate_installment_schedule(
        l.id,
        l.issue_date,
        l.principal_amount,
        l.interest_disbursed,
        CASE 
            WHEN l.loan_program = 'small_loan' THEN 8
            WHEN l.loan_program = 'big_loan' THEN 12
            ELSE 8
        END,
        l.installment_type
    ) i
WHERE l.loan_program IS NOT NULL;

-- Grant access to the view
GRANT SELECT ON loan_installment_schedule TO authenticated;

