-- Fix loan_status enum to include all needed values
-- This migration updates the existing enum to include the missing values

-- First, add the missing enum values
ALTER TYPE public.loan_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.loan_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE public.loan_status ADD VALUE IF NOT EXISTS 'disbursed';
ALTER TYPE public.loan_status ADD VALUE IF NOT EXISTS 'completed';
