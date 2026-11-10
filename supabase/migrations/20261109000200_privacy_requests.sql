-- Private queue for data-subject requests. Access is mediated by server routes
-- using the service role; no direct authenticated-table policy is granted.
CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL UNIQUE DEFAULT (
    'SM-PR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  ),
  requester_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (
    request_type IN ('access', 'correction', 'objection', 'deletion', 'other')
  ),
  details TEXT NOT NULL DEFAULT '' CHECK (char_length(details) <= 2000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'in_review', 'needs_information', 'completed', 'declined')
  ),
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  follow_up_at TIMESTAMPTZ,
  resolution_note TEXT CHECK (char_length(resolution_note) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_privacy_requests_status_created
  ON public.privacy_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_requester_created
  ON public.privacy_requests (requester_user_id, created_at DESC);

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.privacy_requests TO service_role;
