-- Parent mobile-money collections. Provider credentials are encrypted by the
-- application and these records are only read/written through service-role APIs.

CREATE TABLE IF NOT EXISTS public.school_payment_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('mtn', 'airtel')),
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')) DEFAULT 'sandbox',
  credentials_ciphertext TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, provider)
);

ALTER TABLE public.school_payment_provider_configs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_payment_provider_configs FROM anon, authenticated;
GRANT ALL ON public.school_payment_provider_configs TO service_role;

CREATE TABLE IF NOT EXISTS public.parent_mobile_money_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL CHECK (purpose IN ('wallet_topup', 'fee_payment')),
  provider TEXT NOT NULL CHECK (provider IN ('mtn', 'airtel')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 500 AND amount <= 100000000),
  currency TEXT NOT NULL DEFAULT 'UGX' CHECK (currency = 'UGX'),
  phone_last4 TEXT NOT NULL CHECK (phone_last4 ~ '^[0-9]{4}$'),
  status TEXT NOT NULL DEFAULT 'initiating' CHECK (
    status IN ('initiating', 'pending', 'initiation_unknown', 'completed', 'failed')
  ),
  provider_reference TEXT NOT NULL,
  provider_transaction_id TEXT,
  provider_status TEXT,
  failure_code TEXT,
  wallet_transaction_id UUID,
  fee_payment_id UUID REFERENCES public.fee_payments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (provider, provider_reference)
);

CREATE INDEX IF NOT EXISTS idx_parent_mobile_money_parent_recent
  ON public.parent_mobile_money_payments(parent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parent_mobile_money_school_recent
  ON public.parent_mobile_money_payments(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parent_mobile_money_provider_pending
  ON public.parent_mobile_money_payments(provider, status, updated_at)
  WHERE status IN ('initiating', 'pending', 'initiation_unknown');

CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_mobile_money_one_active_per_child_purpose
  ON public.parent_mobile_money_payments(parent_id, student_id, purpose)
  WHERE status IN ('initiating', 'pending', 'initiation_unknown');

ALTER TABLE public.parent_mobile_money_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parent_mobile_money_payments FROM anon, authenticated;
GRANT ALL ON public.parent_mobile_money_payments TO service_role;

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS parent_mobile_money_payment_id UUID
    REFERENCES public.parent_mobile_money_payments(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_transactions_parent_mobile_money_payment
  ON public.wallet_transactions(parent_mobile_money_payment_id)
  WHERE parent_mobile_money_payment_id IS NOT NULL;

-- This function is only executable by the server's service-role key, after the
-- provider status endpoint has confirmed the exact amount and UGX currency.
-- The intent row lock plus unique wallet transaction link make retries safe.
CREATE OR REPLACE FUNCTION public.settle_parent_mobile_money_payment(
  p_payment_id UUID,
  p_provider_transaction_id TEXT,
  p_verified_amount NUMERIC,
  p_verified_currency TEXT,
  p_provider_status TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.parent_mobile_money_payments%ROWTYPE;
  v_wallet_id UUID;
  v_wallet_balance NUMERIC(12,2);
  v_fee_payment_id UUID;
  v_fee_reference TEXT;
BEGIN
  SELECT * INTO v_payment
  FROM public.parent_mobile_money_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found';
  END IF;

  IF v_payment.status = 'completed' THEN
    SELECT balance INTO v_wallet_balance
    FROM public.student_wallets
    WHERE student_id = v_payment.student_id;
    RETURN jsonb_build_object(
      'payment_id', v_payment.id,
      'status', 'completed',
      'already_processed', TRUE,
      'wallet_balance', v_wallet_balance,
      'fee_payment_id', v_payment.fee_payment_id
    );
  END IF;

  IF v_payment.status NOT IN ('initiating', 'pending', 'initiation_unknown') THEN
    RETURN jsonb_build_object('payment_id', v_payment.id, 'status', v_payment.status);
  END IF;

  IF ROUND(p_verified_amount, 2) <> v_payment.amount
     OR UPPER(COALESCE(p_verified_currency, '')) <> 'UGX'
     OR UPPER(COALESCE(p_provider_status, '')) NOT IN ('SUCCESSFUL', 'SUCCESS', 'COMPLETED', 'TS') THEN
    RAISE EXCEPTION 'provider_verification_mismatch';
  END IF;

  IF v_payment.purpose = 'wallet_topup' THEN
    INSERT INTO public.student_wallets AS existing_wallet (student_id, school_id, balance, last_topup_at, updated_at)
    VALUES (v_payment.student_id, v_payment.school_id, v_payment.amount, NOW(), NOW())
    ON CONFLICT (student_id) DO UPDATE
      SET balance = COALESCE(existing_wallet.balance, 0) + EXCLUDED.balance,
          last_topup_at = NOW(),
          updated_at = NOW()
    RETURNING id, balance INTO v_wallet_id, v_wallet_balance;

    INSERT INTO public.wallet_transactions (
      school_id, wallet_id, student_id, amount, transaction_type,
      description, reference_id, reference, recorded_by,
      parent_mobile_money_payment_id
    ) VALUES (
      v_payment.school_id, v_wallet_id, v_payment.student_id, v_payment.amount, 'topup',
      'Parent mobile-money wallet top-up', v_payment.id::TEXT,
      'SKM-' || UPPER(LEFT(REPLACE(v_payment.id::TEXT, '-', ''), 12)),
      v_payment.parent_id, v_payment.id
    );
  ELSE
    v_fee_reference := 'SKM-MOMO-' || UPPER(REPLACE(v_payment.id::TEXT, '-', ''));
    INSERT INTO public.fee_payments (
      school_id, student_id, amount_paid, payment_method,
      payment_reference, paid_by, notes, payment_date, recorded_by
    ) VALUES (
      v_payment.school_id, v_payment.student_id, v_payment.amount, 'mobile_money',
      v_fee_reference, 'Parent (SkoolMate mobile money)',
      'Provider-confirmed ' || UPPER(v_payment.provider) || ' payment. Intent ' || v_payment.id::TEXT,
      CURRENT_DATE, v_payment.parent_id
    ) RETURNING id INTO v_fee_payment_id;
  END IF;

  UPDATE public.parent_mobile_money_payments
  SET status = 'completed',
      provider_transaction_id = COALESCE(p_provider_transaction_id, provider_transaction_id),
      provider_status = UPPER(p_provider_status),
      failure_code = NULL,
      wallet_transaction_id = CASE WHEN v_payment.purpose = 'wallet_topup'
        THEN (SELECT id FROM public.wallet_transactions WHERE parent_mobile_money_payment_id = v_payment.id)
        ELSE NULL END,
      fee_payment_id = v_fee_payment_id,
      completed_at = NOW(),
      updated_at = NOW()
  WHERE id = v_payment.id;

  RETURN jsonb_build_object(
    'payment_id', v_payment.id,
    'status', 'completed',
    'wallet_balance', v_wallet_balance,
    'fee_payment_id', v_fee_payment_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_parent_mobile_money_payment(
  p_payment_id UUID,
  p_provider_status TEXT,
  p_failure_code TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.parent_mobile_money_payments%ROWTYPE;
BEGIN
  SELECT * INTO v_payment
  FROM public.parent_mobile_money_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found';
  END IF;

  IF v_payment.status = 'completed' THEN
    RETURN jsonb_build_object('payment_id', v_payment.id, 'status', 'completed');
  END IF;

  UPDATE public.parent_mobile_money_payments
  SET status = 'failed',
      provider_status = LEFT(UPPER(COALESCE(p_provider_status, 'FAILED')), 40),
      failure_code = LEFT(COALESCE(p_failure_code, 'provider_failed'), 80),
      updated_at = NOW()
  WHERE id = v_payment.id
    AND status IN ('initiating', 'pending', 'initiation_unknown');

  RETURN jsonb_build_object('payment_id', v_payment.id, 'status', 'failed');
END;
$$;

REVOKE ALL ON FUNCTION public.settle_parent_mobile_money_payment(UUID, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_parent_mobile_money_payment(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_parent_mobile_money_payment(UUID, TEXT, NUMERIC, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_parent_mobile_money_payment(UUID, TEXT, TEXT) TO service_role;

COMMENT ON TABLE public.school_payment_provider_configs IS
  'School-scoped mobile-money collection credentials encrypted by the application; never returned to browsers.';
COMMENT ON TABLE public.parent_mobile_money_payments IS
  'Parent mobile-money payment intents. Pending intents do not credit a wallet or reduce a fee balance.';
