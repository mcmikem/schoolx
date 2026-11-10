-- Remove the legacy school-wide FOR ALL policy. PostgreSQL combines
-- permissive policies with OR, so leaving this policy beside the audience,
-- class, owner, and responsible-staff policies bypasses those narrower checks.
DROP POLICY IF EXISTS "School users events write" ON public.events;
