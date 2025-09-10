-- Fix missing columns that the code expects
-- This migration adds columns that are referenced in the code but might not exist in the database

-- Add code column to groups table if it doesn't exist
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS code TEXT;

-- Add member_no column to members table if it doesn't exist (it should exist based on migration but let's be safe)
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS member_no TEXT;

-- Add meeting_time column to groups table if it doesn't exist
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS meeting_time TIME;

-- Add location column to groups table if it doesn't exist
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS location TEXT;

-- Add status column to groups table if it doesn't exist
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add loan_officer_id column to groups table if it doesn't exist
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS loan_officer_id UUID REFERENCES public.profiles(id);

-- Update existing groups to have a code if they don't have one
UPDATE public.groups 
SET code = 'GRP-' || LPAD(id::text, 4, '0')
WHERE code IS NULL OR code = '';

-- Create unique index on code if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_code ON public.groups(code);

-- Add comments to explain the columns
COMMENT ON COLUMN public.groups.code IS 'Unique group code identifier';
COMMENT ON COLUMN public.groups.meeting_time IS 'Time when the group meets';
COMMENT ON COLUMN public.groups.location IS 'Location where the group meets';
COMMENT ON COLUMN public.groups.status IS 'Current status of the group (active, inactive, etc.)';
COMMENT ON COLUMN public.groups.loan_officer_id IS 'ID of the loan officer assigned to this group';
