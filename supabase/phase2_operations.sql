-- ============================================
-- PHASE 2: OPERATIONS & INVENTORY
-- ============================================

-- Enhance ASSETS table for Consumables
ALTER TABLE assets ADD COLUMN IF NOT EXISTS is_consumable BOOLEAN DEFAULT false;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS min_stock_level INTEGER DEFAULT 0;
ALTER TABLE assets RENAME COLUMN quantity TO current_stock;

-- ============================================
-- INVENTORY TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    transaction_type TEXT CHECK (transaction_type IN ('in', 'out', 'adjustment', 'return')) NOT NULL,
    quantity INTEGER NOT NULL,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    transaction_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TIMETABLE SLOTS (Defining the school day)
-- ============================================
CREATE TABLE IF NOT EXISTS timetable_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., "Period 1", "Break", "Lunch"
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_lesson BOOLEAN DEFAULT true, -- false for Break/Lunch
    order_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TIMETABLE CONSTRAINTS (For conflict detection)
-- ============================================
CREATE TABLE IF NOT EXISTS timetable_constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7),
    slot_id UUID REFERENCES timetable_slots(id) ON DELETE CASCADE,
    constraint_type TEXT CHECK (constraint_type IN ('unavailable', 'preferred')) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS POLICIES for new tables
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_constraints ENABLE ROW LEVEL SECURITY;

-- Admins can manage everything
CREATE POLICY "Admins can manage inventory transactions" ON inventory_transactions
    FOR ALL USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid() AND role IN ('school_admin', 'super_admin')));

CREATE POLICY "Admins can manage timetable slots" ON timetable_slots
    FOR ALL USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid() AND role IN ('school_admin', 'super_admin')));

CREATE POLICY "Admins can manage timetable constraints" ON timetable_constraints
    FOR ALL USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid() AND role IN ('school_admin', 'super_admin')));

-- Select access for all school users
CREATE POLICY "School users can view inventory transactions" ON inventory_transactions
    FOR SELECT USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "School users can view timetable slots" ON timetable_slots
    FOR SELECT USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()));
