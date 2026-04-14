-- Courses/Subjects Management
-- Similar to OpenEduCat's course/.subject management

CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    description TEXT,
    category VARCHAR(50),  -- 'core', 'elective', 'optional', 'language', 'science', etc.
    department_id UUID,
    is_active BOOLEAN DEFAULT true,
    is_elective BOOLEAN DEFAULT false,
    is_laboratory BOOLEAN DEFAULT false,
    credit_hours INTEGER DEFAULT 0,
    max_score INTEGER DEFAULT 100,
    passing_score INTEGER DEFAULT 50,
    color VARCHAR(7),  -- Hex color for UI
    icon VARCHAR(50),  -- Material icon name
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, code)
);

-- Course-Class link (which courses are taught in which classes)
CREATE TABLE IF NOT EXISTS course_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    academic_year VARCHAR(10) NOT NULL,
    term_id UUID REFERENCES academic_terms(id),
    teacher_id UUID REFERENCES users(id),
    is_compulsory BOOLEAN DEFAULT true,
    weight DECIMAL(3,2) DEFAULT 1.00,  -- For grade calculation weighting
    max_score INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(course_id, class_id, academic_year)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_courses_school ON courses(school_id);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(school_id, code);
CREATE INDEX IF NOT EXISTS idx_course_classes_course ON course_classes(course_id);
CREATE INDEX IF NOT EXISTS idx_course_classes_class ON course_classes(class_id);
CREATE INDEX IF NOT EXISTS idx_course_classes_year ON course_classes(academic_year);

-- Trigger for updated_at
CREATE TRIGGER set_courses_updated
    BEFORE UPDATE ON courses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_course_classes_updated
    BEFORE UPDATE ON course_classes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY courses_select ON courses FOR SELECT USING (true);
CREATE POLICY courses_insert ON courses FOR INSERT WITH CHECK (school_id IS NOT NULL);
CREATE POLICY courses_update ON courses FOR UPDATE USING (true);
CREATE POLICY courses_delete ON courses FOR DELETE USING (true);

CREATE POLICY course_classes_select ON course_classes FOR SELECT USING (true);
CREATE POLICY course_classes_insert ON course_classes FOR INSERT WITH CHECK (true);
CREATE POLICY course_classes_update ON course_classes FOR UPDATE USING (true);
CREATE POLICY course_classes_delete ON course_classes FOR DELETE USING (true);

COMMENT ON TABLE courses IS 'Courses/subjects taught at the school - similar to OpenEduCat course management';
COMMENT ON TABLE course_classes FOR 'Link between courses and classes - which subjects are taught in which classes';