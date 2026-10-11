-- Missing-tables sweep (same defect class as the dorm repair: code queries
-- tables that were never created or never applied to production).
--
-- Live audit of every supabase.from("...") reference against prod found seven
-- tables missing:
--   discipline             — whole /dashboard/discipline section dead
--   inventory_transactions — inventory stock ledger dead
--   transport_vehicle_logs — fetch in unused useTransportManager (code fix)
--   leads                  — CSV import wrote to "leads" while the rest of the
--                            marketer flow uses "marketer_leads" (code fix)
--   push_subscriptions     — documented in schema.sql, never applied
--   inventory_alerts       — documented in schema.sql, never applied
--   password_reset_tokens  — documented in schema.sql, never applied
-- This migration creates the five that belong in the database; the other two
-- are code fixes (import table name, dead fetch removed).

-- ============================================================
-- DISCIPLINE (/dashboard/discipline)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.discipline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    exam_id UUID REFERENCES public.exams(id) ON DELETE SET NULL,
    incident_type TEXT NOT NULL,
    description TEXT NOT NULL,
    action_taken TEXT,
    follow_up_date DATE,
    resolved BOOLEAN NOT NULL DEFAULT false,
    reported_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.discipline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users discipline select" ON public.discipline;
CREATE POLICY "School users discipline select" ON public.discipline
    FOR SELECT TO authenticated
    USING (school_id = my_school_id());
DROP POLICY IF EXISTS "School staff discipline write" ON public.discipline;
CREATE POLICY "School staff discipline write" ON public.discipline
    FOR ALL TO authenticated
    USING (school_id = my_school_id() AND (is_school_admin() OR is_school_staff(my_school_id())))
    WITH CHECK (school_id = my_school_id() AND (is_school_admin() OR is_school_staff(my_school_id())));

-- ============================================================
-- INVENTORY TRANSACTIONS (stock ledger behind the assets page)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('in', 'out', 'adjustment', 'return')),
    quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
    recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    notes TEXT,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users inventory_transactions select" ON public.inventory_transactions;
CREATE POLICY "School users inventory_transactions select" ON public.inventory_transactions
    FOR SELECT TO authenticated
    USING (school_id = my_school_id());
DROP POLICY IF EXISTS "School staff inventory_transactions write" ON public.inventory_transactions;
CREATE POLICY "School staff inventory_transactions write" ON public.inventory_transactions
    FOR ALL TO authenticated
    USING (school_id = my_school_id() AND (is_school_admin() OR is_school_staff(my_school_id())))
    WITH CHECK (school_id = my_school_id() AND (is_school_admin() OR is_school_staff(my_school_id())));

-- ============================================================
-- PUSH SUBSCRIPTIONS (schema.sql §39, never applied to prod)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    keys JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_subscriptions_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own" ON public.push_subscriptions
    FOR ALL TO authenticated
    USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()))
    WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- ============================================================
-- INVENTORY ALERTS (schema.sql, never applied to prod; the automation
-- route writes through the service role, which bypasses RLS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    asset_id UUID,
    alert_type TEXT NOT NULL,
    current_stock NUMERIC(12,2),
    reorder_level NUMERIC(12,2),
    deficit NUMERIC(12,2),
    notified_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users inventory_alerts all" ON public.inventory_alerts;
CREATE POLICY "School users inventory_alerts all" ON public.inventory_alerts
    FOR ALL TO authenticated
    USING (school_id = my_school_id())
    WITH CHECK (school_id = my_school_id());

-- ============================================================
-- PASSWORD RESET TOKENS (schema.sql, never applied to prod; the reset
-- route reads/updates rows but nothing in the app inserts them yet —
-- the token-creating half of the flow is still to be built, so this
-- only un-breaks the read path and keeps schema parity)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON public.password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON public.password_reset_tokens(expires_at) WHERE used_at IS NULL;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "password_reset_tokens_owner" ON public.password_reset_tokens;
CREATE POLICY "password_reset_tokens_owner" ON public.password_reset_tokens
    FOR SELECT TO authenticated
    USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));
DROP POLICY IF EXISTS "password_reset_tokens_insert" ON public.password_reset_tokens;
CREATE POLICY "password_reset_tokens_insert" ON public.password_reset_tokens
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- transport_vehicle_logs and the "leads" typo are code fixes, not DDL:
-- see useTransportManager (dead fetch removed) and the marketer CSV import
-- route (now writes to marketer_leads, the table the rest of the flow uses).
