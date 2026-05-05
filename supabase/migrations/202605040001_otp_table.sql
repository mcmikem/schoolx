-- OTP storage for parent/phone-based OTP login
CREATE TABLE IF NOT EXISTS public.otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- One active OTP per phone at a time
  CONSTRAINT otps_unique_phone UNIQUE (phone)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_otps_phone ON public.otps (phone);
CREATE INDEX IF NOT EXISTS idx_otps_expires ON public.otps (expires_at);

-- RLS: anyone can insert (request OTP), but only service role can read
ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY  "Anyone can request OTP"
  ON public.otps FOR INSERT
  WITH CHECK (true);

CREATE POLICY  "Service role can manage OTPs"
  ON public.otps FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-cleanup: delete expired OTPs older than 1 hour
-- (run via pg_cron or Supabase scheduled function if available)