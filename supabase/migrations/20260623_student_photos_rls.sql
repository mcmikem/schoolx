-- Migration: Add RLS policies for student-photos storage bucket
-- The bucket is created at runtime by src/lib/student-photos.ts, but RLS policies
-- on storage.objects are required to allow uploads/updates by authenticated users.

-- Create the storage bucket if it doesn't exist yet
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-photos',
    'student-photos',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload student photos
DROP POLICY IF EXISTS "Allow authenticated users to upload student photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload student photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'student-photos');

-- Allow authenticated users to update student photos (upsert)
DROP POLICY IF EXISTS "Allow authenticated users to update student photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to update student photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'student-photos');

-- Allow anyone to view student photos (public bucket)
DROP POLICY IF EXISTS "Allow public to view student photos" ON storage.objects;
CREATE POLICY "Allow public to view student photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'student-photos');

-- Allow authenticated users to delete student photos
DROP POLICY IF EXISTS "Authenticated can delete student photos" ON storage.objects;
CREATE POLICY "Authenticated can delete student photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'student-photos');
