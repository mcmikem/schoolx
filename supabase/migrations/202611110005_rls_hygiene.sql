-- RLS hygiene pass over the anomalies found by a live policy audit.
--
-- - setup_checklist and refund_requests had RLS disabled entirely: with
--   Supabase's default grants, any authenticated user (or anon, depending on
--   grants) could read and rewrite every school's onboarding checklist and
--   refund queue directly through PostgREST.
-- - receipt_counters has RLS on with zero policies ON PURPOSE: it is touched
--   only by the SECURITY DEFINER receipt-counter function in
--   202609170001_receipt_counters.sql, which bypasses RLS. Left as-is.
-- - webhook_events has RLS on with zero policies, also on purpose: it is a
--   service-role-only payment-webhook ledger. The cookie-based client that
--   used to touch it was the bug (fixed in src/lib/payments/idempotency.ts
--   to use the service role); zero policies keeps user clients locked out.

ALTER TABLE public.setup_checklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users setup_checklist select" ON public.setup_checklist;
CREATE POLICY "School users setup_checklist select" ON public.setup_checklist
    FOR SELECT TO authenticated
    USING (school_id = my_school_id());
DROP POLICY IF EXISTS "School staff setup_checklist write" ON public.setup_checklist;
CREATE POLICY "School staff setup_checklist write" ON public.setup_checklist
    FOR ALL TO authenticated
    USING (school_id = my_school_id() AND (is_school_admin() OR is_school_staff(my_school_id())))
    WITH CHECK (school_id = my_school_id() AND (is_school_admin() OR is_school_staff(my_school_id())));

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users refund_requests select" ON public.refund_requests;
CREATE POLICY "School users refund_requests select" ON public.refund_requests
    FOR SELECT TO authenticated
    USING (school_id = my_school_id());
DROP POLICY IF EXISTS "School staff refund_requests write" ON public.refund_requests;
CREATE POLICY "School staff refund_requests write" ON public.refund_requests
    FOR ALL TO authenticated
    USING (school_id = my_school_id() AND (is_school_admin() OR is_school_staff(my_school_id())))
    WITH CHECK (school_id = my_school_id() AND (is_school_admin() OR is_school_staff(my_school_id())));
