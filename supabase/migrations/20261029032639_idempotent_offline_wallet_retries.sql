-- Offline sale replay may reach this function again if Postgres committed the
-- first deduction but the device lost the response before clearing its queue.
-- Locking the wallet serializes concurrent attempts for the same student.
CREATE OR REPLACE FUNCTION deduct_student_wallet(
    p_student_id UUID,
    p_amount NUMERIC,
    p_description TEXT,
    p_ref TEXT
) RETURNS VOID AS $$
DECLARE
    v_wallet_id UUID;
    v_school_id UUID;
    v_current_balance NUMERIC;
BEGIN
    SELECT sw.id, sw.school_id, sw.balance
    INTO v_wallet_id, v_school_id, v_current_balance
    FROM student_wallets sw
    WHERE sw.student_id = p_student_id
    FOR UPDATE;

    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Student wallet not found';
    END IF;

    -- A non-null reference identifies a single sale. Check only spend entries
    -- so a top-up or adjustment using the same reference cannot suppress a sale.
    IF p_ref IS NOT NULL AND EXISTS (
        SELECT 1
        FROM wallet_transactions wt
        WHERE wt.wallet_id = v_wallet_id
          AND wt.transaction_type = 'spend'
          AND wt.reference_id = p_ref
    ) THEN
        RETURN;
    END IF;

    IF v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient wallet balance: UGX % available, UGX % required', v_current_balance, p_amount;
    END IF;

    UPDATE student_wallets
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;

    INSERT INTO wallet_transactions (
        school_id,
        wallet_id,
        amount,
        transaction_type,
        description,
        reference_id
    )
    VALUES (
        v_school_id,
        v_wallet_id,
        p_amount,
        'spend',
        p_description,
        p_ref
    );
END;
$$ LANGUAGE plpgsql;
