-- Create storage bucket for member profile pictures (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('member-avatars', 'member-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for member-avatars storage (if they don't exist)
DROP POLICY IF EXISTS "Anyone can view member profile pictures" ON storage.objects;
CREATE POLICY "Anyone can view member profile pictures" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'member-avatars');

DROP POLICY IF EXISTS "Authenticated users can upload member profile pictures" ON storage.objects;
CREATE POLICY "Authenticated users can upload member profile pictures" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'member-avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update member profile pictures" ON storage.objects;
CREATE POLICY "Authenticated users can update member profile pictures" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'member-avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete member profile pictures" ON storage.objects;
CREATE POLICY "Authenticated users can delete member profile pictures" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'member-avatars' AND auth.role() = 'authenticated');

-- The members table already has photo_url field, so we'll use that
-- No need to add a new column
