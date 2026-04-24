-- ============================================
-- Fix Auth Security - Migration 2 of 3
-- Create password_reset_tokens table
-- ============================================

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

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "password_reset_tokens_owner" ON password_reset_tokens;
CREATE POLICY "password_reset_tokens_owner" ON password_reset_tokens
    FOR SELECT TO authenticated
    USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "password_reset_tokens_insert" ON password_reset_tokens;
CREATE POLICY "password_reset_tokens_insert" ON password_reset_tokens
    FOR INSERT TO authenticated WITH CHECK (true);