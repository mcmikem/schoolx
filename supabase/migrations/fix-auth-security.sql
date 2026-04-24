-- ============================================
-- Fix Auth Security Issues - Apply via CLI
-- ============================================

-- 1. Add UNIQUE constraint on users.phone
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key;
ALTER TABLE users ADD CONSTRAINT users_phone_unique UNIQUE (phone);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- 2. Create password_reset_tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at) WHERE used_at IS NULL;

-- 3. Create security_events table
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

-- 4. RLS for new tables
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Policies for password_reset_tokens (read by owner, insert by authenticated)
DROP POLICY IF EXISTS "password_reset_tokens_owner" ON password_reset_tokens;
CREATE POLICY "password_reset_tokens_owner" ON password_reset_tokens
    FOR SELECT TO authenticated
    USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "password_reset_tokens_insert" ON password_reset_tokens;
CREATE POLICY "password_reset_tokens_insert" ON password_reset_tokens
    FOR INSERT TO authenticated WITH CHECK (true);

-- Policies for security_events (super_admin sees all, users see own)
DROP POLICY IF EXISTS "security_events_all" ON security_events;
CREATE POLICY "security_events_all" ON security_events
    FOR SELECT TO authenticated
    USING (auth.uid() IN (SELECT auth_id FROM users WHERE role = 'super_admin')
        OR user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "security_events_insert" ON security_events;
CREATE POLICY "security_events_insert" ON security_events
    FOR INSERT TO authenticated WITH CHECK (true);