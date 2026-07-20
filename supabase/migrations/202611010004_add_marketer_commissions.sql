-- Marketer commission & earnings tracking system

-- 1. Link schools to the marketer who onboarded them
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS onboarded_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_schools_onboarded_by ON public.schools (onboarded_by);

-- 2. Marketer earnings (commissions, bonuses)
CREATE TABLE IF NOT EXISTS marketer_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marketer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    earning_type TEXT NOT NULL CHECK (earning_type IN ('onboarding_bonus', 'subscription_commission', 'performance_bonus', 'adjustment')),
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT DEFAULT 'UGX',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'cancelled', 'paid')),
    notes TEXT,
    period_start DATE,
    period_end DATE,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketer_earnings_marketer ON marketer_earnings (marketer_id);
CREATE INDEX IF NOT EXISTS idx_marketer_earnings_status ON marketer_earnings (status);
CREATE INDEX IF NOT EXISTS idx_marketer_earnings_school ON marketer_earnings (school_id);

ALTER TABLE marketer_earnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "marketer_earnings_super_admin" ON marketer_earnings;
CREATE POLICY "marketer_earnings_super_admin" ON marketer_earnings FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "marketer_earnings_self_read" ON marketer_earnings;
CREATE POLICY "marketer_earnings_self_read" ON marketer_earnings FOR SELECT TO authenticated
  USING (
    marketer_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- 3. Marketer payout batches
CREATE TABLE IF NOT EXISTS marketer_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marketer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT DEFAULT 'UGX',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketer_payouts_marketer ON marketer_payouts (marketer_id);
CREATE INDEX IF NOT EXISTS idx_marketer_payouts_status ON marketer_payouts (status);

ALTER TABLE marketer_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "marketer_payouts_super_admin" ON marketer_payouts;
CREATE POLICY "marketer_payouts_super_admin" ON marketer_payouts FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "marketer_payouts_self_read" ON marketer_payouts;
CREATE POLICY "marketer_payouts_self_read" ON marketer_payouts FOR SELECT TO authenticated
  USING (
    marketer_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );
