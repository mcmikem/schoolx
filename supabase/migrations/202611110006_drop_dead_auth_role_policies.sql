-- Drop the dead auth.role() policy generation.
--
-- These policies gate on auth.role() = '<school role>', but auth.role() is the
-- JWT role claim, which Supabase issues as 'authenticated' for every signed-in
-- user and 'anon' for visitors — never 'bursar', 'headmaster', 'admin', etc.
-- Every one of them is therefore always-false and granted nothing; real access
-- comes from the my_school_id()/is_school_admin() policies alongside them. The
-- one exception, "Service role can manage OTPs" on otps, is redundant for the
-- same reason: the service role bypasses RLS entirely. Dropping them changes
-- no effective access — it removes a misleading generation of policy that
-- reads as if school roles are enforced at the database when they are not.

DROP POLICY IF EXISTS "academic_terms_delete" ON public.academic_terms;
DROP POLICY IF EXISTS "activity_comments_insert" ON public.activity_comments;
DROP POLICY IF EXISTS "activity_comments_select" ON public.activity_comments;
DROP POLICY IF EXISTS "activity_comments_update" ON public.activity_comments;
DROP POLICY IF EXISTS "co_curricular_delete" ON public.co_curricular_activities;
DROP POLICY IF EXISTS "co_curricular_insert" ON public.co_curricular_activities;
DROP POLICY IF EXISTS "co_curricular_select" ON public.co_curricular_activities;
DROP POLICY IF EXISTS "co_curricular_update" ON public.co_curricular_activities;
DROP POLICY IF EXISTS "course_classes_delete" ON public.course_classes;
DROP POLICY IF EXISTS "course_classes_update" ON public.course_classes;
DROP POLICY IF EXISTS "fee_term_lines_insert" ON public.fee_term_lines;
DROP POLICY IF EXISTS "fee_term_lines_update" ON public.fee_term_lines;
DROP POLICY IF EXISTS "fee_terms_delete" ON public.fee_terms;
DROP POLICY IF EXISTS "fee_terms_insert" ON public.fee_terms;
DROP POLICY IF EXISTS "fee_terms_update" ON public.fee_terms;
DROP POLICY IF EXISTS "module_catalog_read" ON public.module_catalog;
DROP POLICY IF EXISTS "Service role can manage OTPs" ON public.otps;
DROP POLICY IF EXISTS "refund_insert" ON public.refund_requests;
DROP POLICY IF EXISTS "refund_select" ON public.refund_requests;
DROP POLICY IF EXISTS "refund_update" ON public.refund_requests;
DROP POLICY IF EXISTS "student_enrollments_select" ON public.student_enrollments;
DROP POLICY IF EXISTS "student_fee_terms_insert" ON public.student_fee_terms;
DROP POLICY IF EXISTS "student_fee_terms_update" ON public.student_fee_terms;
