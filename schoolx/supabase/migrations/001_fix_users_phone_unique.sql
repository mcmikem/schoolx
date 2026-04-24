-- ============================================
-- Fix Auth Security - Migration 1 of 3
-- Add UNIQUE constraint on users.phone
-- ============================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key;
ALTER TABLE users ADD CONSTRAINT users_phone_unique UNIQUE (phone);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);