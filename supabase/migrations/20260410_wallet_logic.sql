-- Migration: Wallet Logic Security
-- Purpose: Secure server-side functions for wallet balance transactions

CREATE OR REPLACE FUNCTION deduct_student_wallet(
    p_student_id UUID,
    p_amount NUMERIC(12,2),
    p_description TEXT,
    p_ref TEXT
) RETURNS VOID AS $$
DECLARE
    v_wallet_id UUID;
    v_balance NUMERIC(12,2);
    v_school_id UUID;
BEGIN
    -- 1. Get wallet info
    SELECT id, balance, school_id INTO v_wallet_id, v_balance, v_school_id
    FROM student_wallets
    WHERE student_id = p_student_id;

    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Student does not have a digital wallet.';
    END IF;

    -- 2. Check balance
    IF v_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient wallet balance. Available: UGX %', v_balance;
    END IF;

    -- 3. Deduct balance
    UPDATE student_wallets
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;

    -- 4. Record transaction log
    INSERT INTO wallet_transactions (
        school_id, wallet_id, amount, transaction_type, description, reference_id
    ) VALUES (
        v_school_id, v_wallet_id, -p_amount, 'spend', p_description, p_ref
    );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for Top-ups
CREATE OR REPLACE FUNCTION topup_student_wallet(
    p_student_id UUID,
    p_amount NUMERIC(12,2),
    p_description TEXT,
    p_ref TEXT
) RETURNS VOID AS $$
DECLARE
    v_wallet_id UUID;
    v_school_id UUID;
BEGIN
    -- 1. Get or Create wallet
    SELECT id, school_id INTO v_wallet_id, v_school_id
    FROM student_wallets
    WHERE student_id = p_student_id;

    IF v_wallet_id IS NULL THEN
        -- Get school_id from student
        SELECT school_id INTO v_school_id FROM students WHERE id = p_student_id;
        
        INSERT INTO student_wallets (school_id, student_id, balance)
        VALUES (v_school_id, p_student_id, p_amount)
        RETURNING id INTO v_wallet_id;
    ELSE
        UPDATE student_wallets
        SET balance = balance + p_amount,
            last_topup_at = NOW(),
            updated_at = NOW()
        WHERE id = v_wallet_id;
    END IF;

    -- 2. Record transaction log
    INSERT INTO wallet_transactions (
        school_id, wallet_id, amount, transaction_type, description, reference_id
    ) VALUES (
        v_school_id, v_wallet_id, p_amount, 'topup', p_description, p_ref
    );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
