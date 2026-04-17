-- Align parent messaging and wallet schema with portal/admin UI expectations

CREATE TABLE IF NOT EXISTS parent_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('parent', 'school')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parent_messages_school ON parent_messages(school_id);
CREATE INDEX IF NOT EXISTS idx_parent_messages_parent ON parent_messages(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_messages_student ON parent_messages(student_id);

ALTER TABLE parent_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parent_messages_parent_select ON parent_messages;
CREATE POLICY parent_messages_parent_select ON parent_messages
    FOR SELECT USING (
        parent_id IN (
            SELECT id FROM users WHERE auth_id = auth.uid()
        )
        OR school_id IN (
            SELECT school_id FROM users WHERE auth_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS parent_messages_parent_insert ON parent_messages;
CREATE POLICY parent_messages_parent_insert ON parent_messages
    FOR INSERT WITH CHECK (
        parent_id IN (
            SELECT id FROM users WHERE auth_id = auth.uid()
        )
        OR school_id IN (
            SELECT school_id FROM users WHERE auth_id = auth.uid()
        )
    );

ALTER TABLE student_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parent_linked_wallets_select ON student_wallets;
CREATE POLICY parent_linked_wallets_select ON student_wallets
    FOR SELECT USING (
        student_id IN (
            SELECT student_id
            FROM parent_students
            WHERE parent_id IN (
                SELECT id FROM users WHERE auth_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS parent_linked_wallets_insert ON student_wallets;
CREATE POLICY parent_linked_wallets_insert ON student_wallets
    FOR INSERT WITH CHECK (
        student_id IN (
            SELECT student_id
            FROM parent_students
            WHERE parent_id IN (
                SELECT id FROM users WHERE auth_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS parent_linked_wallets_update ON student_wallets;
CREATE POLICY parent_linked_wallets_update ON student_wallets
    FOR UPDATE USING (
        student_id IN (
            SELECT student_id
            FROM parent_students
            WHERE parent_id IN (
                SELECT id FROM users WHERE auth_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        student_id IN (
            SELECT student_id
            FROM parent_students
            WHERE parent_id IN (
                SELECT id FROM users WHERE auth_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS parent_linked_wallet_transactions_select ON wallet_transactions;
CREATE POLICY parent_linked_wallet_transactions_select ON wallet_transactions
    FOR SELECT USING (
        wallet_id IN (
            SELECT id
            FROM student_wallets
            WHERE student_id IN (
                SELECT student_id
                FROM parent_students
                WHERE parent_id IN (
                    SELECT id FROM users WHERE auth_id = auth.uid()
                )
            )
        )
    );

DROP POLICY IF EXISTS parent_linked_wallet_transactions_insert ON wallet_transactions;
CREATE POLICY parent_linked_wallet_transactions_insert ON wallet_transactions
    FOR INSERT WITH CHECK (
        wallet_id IN (
            SELECT id
            FROM student_wallets
            WHERE student_id IN (
                SELECT student_id
                FROM parent_students
                WHERE parent_id IN (
                    SELECT id FROM users WHERE auth_id = auth.uid()
                )
            )
        )
    );

ALTER TABLE student_wallets
    ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS daily_spend_limit NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS last_topup_at TIMESTAMPTZ;

UPDATE student_wallets sw
SET school_id = students.school_id
FROM students
WHERE sw.student_id = students.id
  AND sw.school_id IS NULL
  AND students.school_id IS NOT NULL;

ALTER TABLE wallet_transactions
    ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES student_wallets(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS transaction_type TEXT CHECK (transaction_type IN ('topup', 'spend', 'refund', 'adjustment')),
    ADD COLUMN IF NOT EXISTS reference_id TEXT;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'wallet_transactions'
          AND column_name = 'student_id'
    ) THEN
        EXECUTE $sql$
            UPDATE wallet_transactions wt
            SET wallet_id = sw.id,
                school_id = COALESCE(wt.school_id, sw.school_id)
            FROM student_wallets sw
            WHERE wt.wallet_id IS NULL
              AND wt.student_id = sw.student_id
        $sql$;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'wallet_transactions'
          AND column_name = 'type'
    ) THEN
        EXECUTE $sql$
            UPDATE wallet_transactions
            SET transaction_type = COALESCE(transaction_type, type)
            WHERE transaction_type IS NULL
        $sql$;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'wallet_transactions'
          AND column_name = 'reference'
    ) THEN
        EXECUTE $sql$
            UPDATE wallet_transactions
            SET reference_id = COALESCE(reference_id, reference)
            WHERE reference_id IS NULL
        $sql$;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_student_wallets_school ON student_wallets(school_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_school ON wallet_transactions(school_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);

CREATE OR REPLACE FUNCTION topup_student_wallet(
    p_student_id UUID,
    p_amount NUMERIC,
    p_description TEXT,
    p_ref TEXT
) RETURNS VOID AS $$
DECLARE
    v_wallet_id UUID;
    v_school_id UUID;
BEGIN
    SELECT school_id INTO v_school_id
    FROM students
    WHERE id = p_student_id;

    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Cannot top up wallet: student % does not belong to any school', p_student_id;
    END IF;

    INSERT INTO student_wallets (student_id, school_id, balance, last_topup_at)
    VALUES (p_student_id, v_school_id, p_amount, NOW())
    ON CONFLICT (student_id) DO UPDATE
    SET school_id = EXCLUDED.school_id,
        balance = student_wallets.balance + p_amount,
        last_topup_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_wallet_id;

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
        'topup',
        p_description,
        p_ref
    );
END;
$$ LANGUAGE plpgsql;
