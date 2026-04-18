-- Fix authenticated access for user profiles and school settings.
-- These policies support runtime profile lookup and academic settings persistence.

ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.school_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
TO authenticated
USING (auth_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (auth_id = auth.uid())
WITH CHECK (auth_id = auth.uid());

DROP POLICY IF EXISTS "School users view school settings" ON public.school_settings;
CREATE POLICY "School users view school settings"
ON public.school_settings
FOR SELECT
TO authenticated
USING (
  school_id IN (
    SELECT school_id
    FROM public.users
    WHERE auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "School users manage school settings" ON public.school_settings;
CREATE POLICY "School users manage school settings"
ON public.school_settings
FOR ALL
TO authenticated
USING (
  school_id IN (
    SELECT school_id
    FROM public.users
    WHERE auth_id = auth.uid()
  )
)
WITH CHECK (
  school_id IN (
    SELECT school_id
    FROM public.users
    WHERE auth_id = auth.uid()
  )
);
