-- App Events — page views, feature usage, and error tracking for super admin analytics
CREATE TABLE IF NOT EXISTS public.app_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'feature_use', 'error', 'api_call')),
    event_name TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    url TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_events_created ON public.app_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_type ON public.app_events (event_type);
CREATE INDEX IF NOT EXISTS idx_app_events_name ON public.app_events (event_name);
CREATE INDEX IF NOT EXISTS idx_app_events_school ON public.app_events (school_id);
CREATE INDEX IF NOT EXISTS idx_app_events_user ON public.app_events (user_id);

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

-- Super admins can read all events
CREATE POLICY app_events_select_super_admin ON public.app_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

-- Service role can insert events (API endpoint uses service role)
CREATE POLICY app_events_insert_service ON public.app_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
