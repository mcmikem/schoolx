-- Student Course Junction Table
-- Tracks which courses/batches a student is enrolled in
-- Similar to OpenEduCat's op_student_course model

CREATE TABLE IF NOT EXISTS student_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    academic_year VARCHAR(20) NOT NULL,
    roll_number VARCHAR(50),
    enrollment_date TIMESTAMPTZ DEFAULT NOW(),
    state VARCHAR(20) DEFAULT 'running' CHECK (state IN ('draft', 'running', 'completed', 'transferred', 'dropped')),
    completion_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(student_id, class_id, academic_year)
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_enrollment_student ON student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_class ON student_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_year ON student_enrollments(academic_year);
CREATE INDEX IF NOT EXISTS idx_enrollment_state ON student_enrollments(state);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON student_enrollments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_enrollments_select ON student_enrollments
    FOR SELECT USING (true);

CREATE POLICY student_enrollments_insert ON student_enrollments
    FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY student_enrollments_update ON student_enrollments
    FOR UPDATE USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY student_enrollments_delete ON student_enrollments
    FOR DELETE USING (auth.role() IN ('authenticated', 'service_role'));

COMMENT ON TABLE student_enrollments IS 'Junction table linking students to courses/batches - tracks enrollment status and roll numbers';