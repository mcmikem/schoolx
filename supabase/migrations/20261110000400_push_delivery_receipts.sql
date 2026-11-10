-- Minimal, content-free push send diagnostics. A successful provider response
-- means accepted by the push provider, not confirmed delivery to a device.
CREATE TABLE IF NOT EXISTS public.push_delivery_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  sender_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('accepted_by_provider', 'failed', 'expired')),
  provider_status SMALLINT CHECK (provider_status BETWEEN 100 AND 599),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_receipts_school_created
  ON public.push_delivery_receipts (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_receipts_recipient_created
  ON public.push_delivery_receipts (recipient_user_id, created_at DESC);

ALTER TABLE public.push_delivery_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_delivery_receipts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_delivery_receipts TO service_role;
