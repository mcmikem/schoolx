-- Close three privilege escalations: any authenticated user of a school could
-- rewrite that school's settings, create classes, and create courses.
--
-- Found by probing the live database as each role, not by reading the SQL.
--
-- Cause: permissive policies are OR'd together, so a wide-open policy silently
-- defeats a correctly restrictive one sitting next to it. Each of these tables
-- had BOTH:
--
--   school_settings
--     "School admin settings write"      ALL   is_school_admin(school_id)   <- intended
--     "School users manage school settings" ALL school_id = my_school_id()  <- defeats it
--
--   classes
--     "School users access own school classes" ALL school_id = my_school_id()
--     "School users classes write"             ALL school_id = my_school_id()
--
--   courses
--     courses_insert INSERT school_id = my_school_id()   (no role check)
--
-- Measured before this change, per role, over one school:
--
--   role          courses  classes  subjects  events  settings
--   school_admin  yes      yes      yes        yes     yes
--   bursar        yes      yes      no         no      yes
--   teacher       yes      yes      no         yes     yes
--   secretary     yes      yes      no         no      yes
--   parent        yes      yes      no         no      yes
--
-- A parent of a school could change its settings. Reads are unaffected: every
-- table keeps its own-school SELECT policies.

-- ─── school_settings ─────────────────────────────────────────────────────────
-- Writes become administrator-only. "School admin settings write" already
-- grants exactly that, so the broad policy is simply removed.
DROP POLICY IF EXISTS "School users manage school settings" ON public.school_settings;

-- ─── classes ─────────────────────────────────────────────────────────────────
-- The two broad ALL policies are replaced by the per-command policies added on
-- 2026-09-27: staff may add a class, administrators may rename or remove one,
-- and any member of the school may read them.
DROP POLICY IF EXISTS "School users access own school classes" ON public.classes;
DROP POLICY IF EXISTS "School users classes write" ON public.classes;

-- ─── courses ─────────────────────────────────────────────────────────────────
-- The insert policy added on 2026-09-27 kept the original's lack of a role
-- check, which left course creation open to every role in the school. Match the
-- update and delete policies, which already require an administrator.
DROP POLICY IF EXISTS "courses_insert" ON public.courses;
CREATE POLICY "courses_insert" ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (school_id = my_school_id() AND is_school_admin(my_school_id()));