-- Migration: refund_requests
-- Creates table for refund requests with status tracking and RLS policies

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_status') THEN
    CREATE TYPE refund_status AS ENUM ('pending','approved','rejected');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS refund_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  fee_payment_id UUID NOT NULL REFERENCES fee_payments(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  reason TEXT,
  status refund_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS: Bursar can create (insert) requests, Headmaster can approve/reject (update), both can select
DROP POLICY IF EXISTS refund_select ON refund_requests;
CREATE POLICY refund_select ON refund_requests
  FOR SELECT USING (auth.role() = 'headmaster' OR auth.role() = 'admin' OR auth.role() = 'bursar');

DROP POLICY IF EXISTS refund_insert ON refund_requests;
CREATE POLICY refund_insert ON refund_requests
  FOR INSERT WITH CHECK (auth.role() = 'bursar');

DROP POLICY IF EXISTS refund_update ON refund_requests;
CREATE POLICY refund_update ON refund_requests
  FOR UPDATE USING (auth.role() = 'headmaster' OR auth.role() = 'admin');


