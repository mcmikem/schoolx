-- ============================================
-- PARENT PORTAL & PUSH NOTIFICATIONS
-- Migration: Add parent_profiles and push_subscriptions tables
-- ============================================

-- ============================================
-- PARENT PROFILES TABLE
-- Links parents to their children (students)
-- ============================================
CREATE TABLE IF NOT EXISTS parent_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    parent_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    phone2 TEXT,
    email TEXT,
    relationship TEXT CHECK (relationship IN ('mother', 'father', 'guardian', 'other')) DEFAULT 'guardian',
    is_primary BOOLEAN DEFAULT true,
    notifications_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, school_id)
);

-- ============================================
-- PARENT STUDENT LINKS
-- Links parent to their children
-- ============================================
CREATE TABLE IF NOT EXISTS parent_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES parent_profiles(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parent_id, student_id)
);

-- ============================================
-- PUSH SUBSCRIPTIONS TABLE
-- Stores Web Push notification subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    endpoint TEXT NOT NULL,
    keys JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_parent_profiles_user ON parent_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_parent_profiles_school ON parent_profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_parent ON parent_students(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_student ON parent_students(student_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- ============================================
-- RLS POLICIES (if not already enforced)
-- ============================================
ALTER TABLE parent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Parent can read their own profile
CREATE POLICY "Parents can view own profile" ON parent_profiles
    FOR SELECT USING (auth.uid() = user_id);

-- Parent can update their own profile
CREATE POLICY "Parents can update own profile" ON parent_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- School admin can view all parent profiles for their school
CREATE POLICY "School admin can view parent profiles" ON parent_profiles
    FOR SELECT USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid()
        )
    );

-- Parent can view their linked students
CREATE POLICY "Parents can view linked students" ON parent_students
    FOR SELECT USING (
        parent_id IN (
            SELECT id FROM parent_profiles WHERE user_id = auth.uid()
        )
    );

-- Push subscriptions - user can manage own
CREATE POLICY "Users can manage own push subscription" ON push_subscriptions
    FOR ALL USING (auth.uid() = user_id);