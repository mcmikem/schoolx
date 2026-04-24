-- ============================================
-- Fix Auth Security - Migration 3 of 3
-- Create security_events table
-- ============================================

CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    event_type TEXT NOT NULL CHECK (event_type IN (
        'login_failed', 'login_success', 'logout', 
        'password_reset_requested', 'password_reset_completed',
        'account_locked', 'account_unlocked', 'password_reset_failed',
        'password_reset_reused', 'password_reset_failed_expired'
    )),
    ip_address TEXT,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "security_events_all" ON security_events;
CREATE POLICY "security_events_all" ON security_events
    FOR SELECT TO authenticated
    USING (auth.uid() IN (SELECT auth_id FROM users WHERE role = 'super_admin')
        OR user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "security_events_insert" ON security_events;
CREATE POLICY "security_events_insert" ON security_events
    FOR INSERT TO authenticated WITH CHECK (true);