-- Security hardening for existing installations.
-- Apply after the existing schema/migration history.

-- The canonical schema now creates this relation after both tables exist.
DO $$
BEGIN
  IF to_regclass('public.schools') IS NOT NULL AND to_regclass('public.users') IS NOT NULL THEN
    ALTER TABLE public.schools DROP CONSTRAINT IF EXISTS schools_onboarded_by_fkey;
    ALTER TABLE public.schools
      ADD CONSTRAINT schools_onboarded_by_fkey
      FOREIGN KEY (onboarded_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Student images are personal data. Existing public buckets must be made
-- private before the public SELECT policy is removed.
UPDATE storage.buckets SET public = false WHERE id = 'student-photos';

DROP POLICY IF EXISTS "Allow public to view student photos" ON storage.objects;
DROP POLICY IF EXISTS "School users view student photos" ON storage.objects;
CREATE POLICY "School users view student photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = public.my_school_id()::text
  );

DROP POLICY IF EXISTS "Allow authenticated users to upload student photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload student photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = public.my_school_id()::text
  );

DROP POLICY IF EXISTS "Allow authenticated users to update student photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to update student photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = public.my_school_id()::text
  )
  WITH CHECK (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = public.my_school_id()::text
  );

DROP POLICY IF EXISTS "Authenticated can delete student photos" ON storage.objects;
CREATE POLICY "Authenticated can delete student photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = public.my_school_id()::text
  );

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_provider_event_id_key
  ON public.webhook_events(provider, event_id)
  WHERE event_id IS NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.subscription_payments
    DROP CONSTRAINT IF EXISTS subscription_payments_payment_status_check;
  ALTER TABLE public.subscription_payments
    ADD CONSTRAINT subscription_payments_payment_status_check
    CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded'));
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;
