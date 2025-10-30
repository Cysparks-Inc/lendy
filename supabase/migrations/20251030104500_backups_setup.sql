-- Backups setup: storage bucket, policies, and metadata table

-- Create backups bucket if not exists
INSERT INTO storage.buckets (id, name, public)
SELECT 'backups', 'backups', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'backups');

-- Allow admins/super_admins to manage backups objects
DROP POLICY IF EXISTS "backups_admin_read" ON storage.objects;
CREATE POLICY "backups_admin_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'backups' AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')
  )
);

DROP POLICY IF EXISTS "backups_admin_insert" ON storage.objects;
CREATE POLICY "backups_admin_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'backups' AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')
  )
);

DROP POLICY IF EXISTS "backups_admin_delete" ON storage.objects;
CREATE POLICY "backups_admin_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'backups' AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')
  )
);

-- Metadata table to track backups
CREATE TABLE IF NOT EXISTS public.backup_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  path TEXT NOT NULL,
  object_count INTEGER NOT NULL,
  total_size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'success',
  details TEXT
);

ALTER TABLE public.backup_metadata ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS backup_metadata_admin ON public.backup_metadata;
CREATE POLICY backup_metadata_admin ON public.backup_metadata
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin'))
);


