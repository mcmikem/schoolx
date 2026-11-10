-- Record a canteen wallet sale and debit the student's wallet in one
-- transaction. The client generated sale UUID is the idempotency key, so an
-- offline replay or a lost HTTP response cannot duplicate the sale/debit.
CREATE OR REPLACE FUNCTION public.record_canteen_wallet_sale(
    p_sale_id UUID,
    p_school_id UUID,
    p_student_id UUID,
    p_amount NUMERIC,
    p_items JSONB,
    p_created_at TIMESTAMPTZ DEFAULT NOW()
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_wallet_id UUID;
    v_wallet_school_id UUID;
    v_balance NUMERIC;
    v_sale public.canteen_sales%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL
       OR public.my_school_id() IS DISTINCT FROM p_school_id
       OR NOT public.is_staff_role() THEN
        RAISE EXCEPTION 'Not authorised to record this school sale' USING ERRCODE = '42501';
    END IF;

    IF p_sale_id IS NULL OR p_student_id IS NULL OR p_amount IS NULL OR p_amount <= 0
       OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'Invalid canteen wallet sale';
    END IF;

    SELECT u.id INTO v_actor_id
    FROM public.users u
    WHERE u.auth_id = auth.uid() AND u.school_id = p_school_id;
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Staff profile not found for this school' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = p_student_id AND s.school_id = p_school_id
    ) THEN
        RAISE EXCEPTION 'Student does not belong to this school' USING ERRCODE = '42501';
    END IF;

    SELECT sw.id, sw.school_id, sw.balance
    INTO v_wallet_id, v_wallet_school_id, v_balance
    FROM public.student_wallets sw
    WHERE sw.student_id = p_student_id
    FOR UPDATE;

    IF v_wallet_id IS NULL OR v_wallet_school_id IS DISTINCT FROM p_school_id THEN
        RAISE EXCEPTION 'Student wallet not found for this school';
    END IF;

    SELECT * INTO v_sale
    FROM public.canteen_sales cs
    WHERE cs.id = p_sale_id
    FOR UPDATE;

    IF FOUND THEN
        IF v_sale.school_id IS DISTINCT FROM p_school_id
           OR v_sale.student_id IS DISTINCT FROM p_student_id
           OR v_sale.total_amount IS DISTINCT FROM p_amount
           OR v_sale.payment_method IS DISTINCT FROM 'wallet'
           OR v_sale.items IS DISTINCT FROM p_items THEN
            RAISE EXCEPTION 'Sale idempotency key was reused with different sale data';
        END IF;
    ELSE
        INSERT INTO public.canteen_sales (
            id, school_id, student_id, total_amount, payment_method, items, recorded_by, created_at
        ) VALUES (
            p_sale_id, p_school_id, p_student_id, p_amount, 'wallet', p_items, v_actor_id,
            COALESCE(p_created_at, NOW())
        );
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.wallet_transactions wt
        WHERE wt.wallet_id = v_wallet_id
          AND wt.transaction_type = 'spend'
          AND wt.reference_id = p_sale_id::TEXT
    ) THEN
        RETURN p_sale_id;
    END IF;

    IF v_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient wallet balance: UGX % available, UGX % required', v_balance, p_amount;
    END IF;

    UPDATE public.student_wallets
    SET balance = balance - p_amount, updated_at = NOW()
    WHERE id = v_wallet_id;

    INSERT INTO public.wallet_transactions (
        school_id, wallet_id, student_id, amount, transaction_type,
        description, reference_id, recorded_by
    ) VALUES (
        p_school_id, v_wallet_id, p_student_id, p_amount, 'spend',
        'Purchase at Canteen', p_sale_id::TEXT, v_actor_id
    );

    RETURN p_sale_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_canteen_wallet_sale(UUID, UUID, UUID, NUMERIC, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_canteen_wallet_sale(UUID, UUID, UUID, NUMERIC, JSONB, TIMESTAMPTZ) TO authenticated;
