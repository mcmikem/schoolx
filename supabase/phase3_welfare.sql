-- ============================================
-- PHASE 3: STUDENT WELFARE (HOSTEL & TRANSPORT)
-- ============================================

-- ============================================
-- DORM ROOMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dorm_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dorm_id UUID REFERENCES dorms(id) ON DELETE CASCADE,
    room_number TEXT NOT NULL,
    capacity INTEGER DEFAULT 4,
    current_occupancy INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update DORM STUDENTS to include room_id
ALTER TABLE dorm_students ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES dorm_rooms(id) ON DELETE SET NULL;

-- ============================================
-- DORM INCIDENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dorm_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    dorm_id UUID REFERENCES dorms(id) ON DELETE CASCADE,
    incident_type TEXT CHECK (incident_type IN ('misbehavior', 'health', 'maintenance', 'other')) NOT NULL,
    description TEXT NOT NULL,
    action_taken TEXT,
    incident_date DATE DEFAULT CURRENT_DATE,
    reported_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRANSPORT VEHICLE LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS transport_vehicle_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    route_id UUID REFERENCES transport_routes(id) ON DELETE CASCADE,
    log_type TEXT CHECK (log_type IN ('fuel', 'maintenance', 'incident', 'mileage')) NOT NULL,
    description TEXT,
    amount NUMERIC(12,2), -- Cost associated
    odometer_reading INTEGER,
    log_date DATE DEFAULT CURRENT_DATE,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRANSPORT ROUTE STOPS
-- ============================================
CREATE TABLE IF NOT EXISTS transport_stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID REFERENCES transport_routes(id) ON DELETE CASCADE,
    stop_name TEXT NOT NULL,
    pickup_time TIME,
    dropoff_time TIME,
    order_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS POLICIES
ALTER TABLE dorm_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE dorm_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_vehicle_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_stops ENABLE ROW LEVEL SECURITY;

-- Admins manage all
CREATE POLICY "Admins manage welfare" ON dorm_rooms FOR ALL USING (dorm_id IN (SELECT id FROM dorms WHERE school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid() AND role IN ('school_admin', 'super_admin'))));
CREATE POLICY "Admins manage dorm incidents" ON dorm_incidents FOR ALL USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid() AND role IN ('school_admin', 'super_admin')));
CREATE POLICY "Admins manage transport logs" ON transport_vehicle_logs FOR ALL USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid() AND role IN ('school_admin', 'super_admin')));

-- General select access
CREATE POLICY "Users view dorm rooms" ON dorm_rooms FOR SELECT USING (true);
CREATE POLICY "Users view transport stops" ON transport_stops FOR SELECT USING (true);
