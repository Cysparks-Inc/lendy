-- Admin RLS and Notifications Setup

-- Ensure notifications table exists
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  related_entity_type TEXT,
  related_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Owner can select/update/delete
DROP POLICY IF EXISTS notifications_owner_select ON public.notifications;
CREATE POLICY notifications_owner_select ON public.notifications
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_owner_update ON public.notifications;
CREATE POLICY notifications_owner_update ON public.notifications
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_owner_delete ON public.notifications;
CREATE POLICY notifications_owner_delete ON public.notifications
FOR DELETE USING (auth.uid() = user_id);

-- Admins and Super Admins can insert system notifications
DROP POLICY IF EXISTS notifications_admin_insert ON public.notifications;
CREATE POLICY notifications_admin_insert ON public.notifications
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')
  )
);

-- BRANCHES: allow admins and super_admins to select
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS branches_admin_select ON public.branches;
CREATE POLICY branches_admin_select ON public.branches
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')
  )
);

-- LOAN PAYMENTS: admins and super_admins can select
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loan_payments_admin_select ON public.loan_payments;
CREATE POLICY loan_payments_admin_select ON public.loan_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')
  )
);

-- EXPENSES: admins and super_admins can select/insert/update/delete
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS expenses_admin_select ON public.expenses;
CREATE POLICY expenses_admin_select ON public.expenses
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin'))
);
DROP POLICY IF EXISTS expenses_admin_insert ON public.expenses;
CREATE POLICY expenses_admin_insert ON public.expenses
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin'))
);
DROP POLICY IF EXISTS expenses_admin_update ON public.expenses;
CREATE POLICY expenses_admin_update ON public.expenses
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin'))
);
DROP POLICY IF EXISTS expenses_admin_delete ON public.expenses;
CREATE POLICY expenses_admin_delete ON public.expenses
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin'))
);

-- INCOME (if exists): allow admins and super_admins to select; create placeholder safely
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='income'
  ) THEN
    ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS income_admin_select ON public.income;
    CREATE POLICY income_admin_select ON public.income
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin'))
    );
  END IF;
END $$;

-- Loan approval notifications: trigger when approval_status changes
CREATE OR REPLACE FUNCTION public.notify_loan_approval_change()
RETURNS TRIGGER AS $$
DECLARE
  _status TEXT;
  _title TEXT;
  _message TEXT;
BEGIN
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    _status := COALESCE(NEW.approval_status::text, 'pending');
    _title := 'Loan ' || UPPER(_status);
    _message := 'Loan application ' || NEW.id::text || ' was ' || _status || '.';

    -- Notify loan officer if set on the loan
    IF NEW.loan_officer_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, title, message, type, related_entity_type, related_entity_id)
      VALUES (NEW.loan_officer_id, _title, _message, CASE WHEN _status='approved' THEN 'success' WHEN _status='rejected' THEN 'warning' ELSE 'info' END, 'loan', NEW.id);
    END IF;

    -- Notify creator if present
    IF NEW.created_by IS NOT NULL AND NEW.created_by IS DISTINCT FROM NEW.loan_officer_id THEN
      INSERT INTO public.notifications(user_id, title, message, type, related_entity_type, related_entity_id)
      VALUES (NEW.created_by, _title, _message, CASE WHEN _status='approved' THEN 'success' WHEN _status='rejected' THEN 'warning' ELSE 'info' END, 'loan', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_loan_approval_change ON public.loans;
CREATE TRIGGER trg_notify_loan_approval_change
AFTER UPDATE OF approval_status ON public.loans
FOR EACH ROW
EXECUTE FUNCTION public.notify_loan_approval_change();


