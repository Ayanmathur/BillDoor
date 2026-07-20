-- ============================================================
-- BillDoor Core Schema — Migration 00003
-- Create storage buckets and RLS policies
-- ============================================================

-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('public-assets', 'public-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if running this again to avoid conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Client Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Client Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Client Delete Access" ON storage.objects;

-- 1. Public can read any object in this bucket
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'public-assets');

-- 2. Authenticated users can insert files to logos/<their-uid>/
CREATE POLICY "Client Upload Access" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'public-assets' 
  AND (storage.foldername(name))[1] = 'logos' 
  AND (storage.foldername(name))[2] = (select auth.uid())::text
);

-- 3. Authenticated users can update files in logos/<their-uid>/
CREATE POLICY "Client Update Access" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
  bucket_id = 'public-assets' 
  AND (storage.foldername(name))[1] = 'logos' 
  AND (storage.foldername(name))[2] = (select auth.uid())::text
);

-- 4. Authenticated users can delete files in logos/<their-uid>/
CREATE POLICY "Client Delete Access" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'public-assets' 
  AND (storage.foldername(name))[1] = 'logos' 
  AND (storage.foldername(name))[2] = (select auth.uid())::text
);
