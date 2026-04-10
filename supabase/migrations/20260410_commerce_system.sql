-- Migration: Omuto Unified Commerce & Digital Wallet
-- Purpose: Support for School Store/Canteen POS and Student Pocket Money management

-- 1. Canteen Inventory
CREATE TABLE IF NOT EXISTS canteen_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    price NUMERIC(12,2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 5,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Student Digital Wallets
CREATE TABLE IF NOT EXISTS student_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    balance NUMERIC(12,2) DEFAULT 0,
    daily_spend_limit NUMERIC(12,2),
    last_topup_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id)
);

-- 3. Wallet Transactions (Audit Trail)
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES student_wallets(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    transaction_type TEXT CHECK (transaction_type IN ('topup', 'spend', 'refund', 'adjustment')) NOT NULL,
    description TEXT,
    reference_id TEXT, -- e.g., POS sale ID or Mobile Money Ref
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Canteen Sales (Detailed POS Logs)
CREATE TABLE IF NOT EXISTS canteen_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL, -- Can be null for anonymous cash sales
    total_amount NUMERIC(12,2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('wallet', 'cash', 'other')) NOT NULL,
    items JSONB NOT NULL, -- Array of {item_id, name, quantity, price}
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE canteen_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE canteen_sales ENABLE ROW LEVEL SECURITY;

-- Schools can only see/manage their own data
CREATE POLICY "School users manage canteen items" ON canteen_items FOR ALL TO authenticated USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "School users manage student wallets" ON student_wallets FOR ALL TO authenticated USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "School users manage wallet transactions" ON wallet_transactions FOR ALL TO authenticated USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "School users manage canteen sales" ON canteen_sales FOR ALL TO authenticated USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()));

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_canteen_school ON canteen_items(school_id);
CREATE INDEX IF NOT EXISTS idx_wallet_student ON student_wallets(student_id);
CREATE INDEX IF NOT EXISTS idx_trans_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_sales_school ON canteen_sales(school_id);
