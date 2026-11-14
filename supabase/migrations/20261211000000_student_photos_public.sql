-- Restore student-photos to a public bucket so stored public URLs load.
-- The private/signed-URL experiment broke existing rows and expired after 1h.
UPDATE storage.buckets SET public = true WHERE id = 'student-photos';
