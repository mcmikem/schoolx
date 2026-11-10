-- Records the versions of the school terms and privacy notice accepted during
-- school registration. No IP address or unnecessary device data is collected.
CREATE TABLE IF NOT EXISTS public.school_agreement_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  accepted_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  privacy_notice_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_agreement_acceptances_school
  ON public.school_agreement_acceptances (school_id, accepted_at DESC);

ALTER TABLE public.school_agreement_acceptances ENABLE ROW LEVEL SECURITY;
-- Trusted registration routes use the service role for writes and reads.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_agreement_acceptances TO service_role;
