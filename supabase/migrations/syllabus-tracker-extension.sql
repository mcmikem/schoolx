-- Syllabus Tracker & Auto Lesson Planner Extensions
-- Adds comprehensive tracking, analytics, and AI-powered features

-- ============================================
-- 1. SYLLABUS TIMELINE
-- ============================================
CREATE TABLE IF NOT EXISTS syllabus_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    syllabus_id UUID NOT NULL REFERENCES syllabus(id) ON DELETE CASCADE,
    term INTEGER NOT NULL CHECK (term IN (1, 2, 3)),
    academic_year TEXT NOT NULL,
    
    -- Timeline specifics
    week_number INTEGER NOT NULL,
    planned_start_date DATE NOT NULL,
    planned_end_date DATE NOT NULL,
    actual_start_date DATE,
    actual_end_date DATE,
    
    -- Progress tracking
    status TEXT CHECK (status IN ('not_started', 'in_progress', 'completed', 'postponed', 'accelerated')) DEFAULT 'not_started',
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    
    -- Teaching metrics
    lessons_planned INTEGER DEFAULT 0,
    lessons_completed INTEGER DEFAULT 0,
    student_comprehension_rating INTEGER CHECK (student_comprehension_rating >= 1 AND student_comprehension_rating <= 5),
    
    -- Notes
    teacher_notes TEXT,
    challenges TEXT,
    adaptations_made TEXT,
    
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(school_id, class_id, subject_id, syllabus_id, term, academic_year, week_number)
);

-- ============================================
-- 2. TOPIC PERFORMANCE ANALYTICS
-- ============================================
CREATE TABLE IF NOT EXISTS topic_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    syllabus_id UUID NOT NULL REFERENCES syllabus(id) ON DELETE CASCADE,
    syllabus_timeline_id UUID REFERENCES syllabus_timeline(id) ON DELETE SET NULL,
    
    term INTEGER NOT NULL,
    academic_year TEXT NOT NULL,
    topic TEXT NOT NULL,
    
    -- Performance metrics
    average_score DECIMAL(5, 2),
    student_count INTEGER,
    students_above_75 INTEGER DEFAULT 0,
    students_50_to_75 INTEGER DEFAULT 0,
    students_below_50 INTEGER DEFAULT 0,
    
    -- Mastery levels
    mastery_level TEXT CHECK (mastery_level IN ('beginner', 'developing', 'proficient', 'advanced')) DEFAULT 'developing',
    
    -- Revision needed
    revision_required BOOLEAN DEFAULT false,
    revision_priority TEXT CHECK (revision_priority IN ('low', 'medium', 'high')) DEFAULT 'low',
    
    -- Feedback
    common_misconceptions TEXT,
    differentiation_needed TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. EXTENDED LESSON PLANS FOR AUTO-GENERATED CONTENT
-- ============================================
CREATE TABLE IF NOT EXISTS lesson_plan_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    
    name TEXT NOT NULL,
    description TEXT,
    
    -- Template structure (JSON)
    introduction_template TEXT,
    main_content_template TEXT,
    consolidation_template TEXT,
    assessment_template TEXT,
    
    -- Default resources
    default_materials TEXT, -- JSON array
    suggested_duration INTEGER DEFAULT 40, -- minutes
    
    -- AI config
    use_ai_generation BOOLEAN DEFAULT true,
    ai_model TEXT DEFAULT 'openai', -- 'openai', 'claude', 'rules_based'
    
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. AUTO PLANNER CONFIGURATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS auto_planner_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Enable/disable features
    enable_ai_generation BOOLEAN DEFAULT true,
    enable_weekly_distribution BOOLEAN DEFAULT true,
    enable_smart_scheduling BOOLEAN DEFAULT true,
    
    -- Scheduling rules
    lessons_per_week_target INTEGER DEFAULT 2,
    account_for_holidays BOOLEAN DEFAULT true,
    account_for_exams BOOLEAN DEFAULT true,
    
    -- AI preferences
    ai_provider TEXT CHECK (ai_provider IN ('openai', 'claude', 'rules_based')) DEFAULT 'rules_based',
    ai_temperature DECIMAL(3, 2) DEFAULT 0.7, -- 0.0 to 1.0
    
    -- Default lesson structure
    default_lesson_duration INTEGER DEFAULT 40, -- minutes
    include_homework BOOLEAN DEFAULT true,
    include_assessment BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(school_id)
);

-- ============================================
-- 5. GENERATED LESSON PLAN HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS lesson_plan_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    syllabus_id UUID REFERENCES syllabus(id) ON DELETE SET NULL,
    
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    term INTEGER NOT NULL,
    academic_year TEXT NOT NULL,
    
    -- Generation details
    topic_count INTEGER DEFAULT 0,
    lessons_generated INTEGER DEFAULT 0,
    
    -- Metadata
    generation_source TEXT CHECK (generation_source IN ('auto', 'ai_enhanced', 'manual_with_suggestions')) DEFAULT 'auto',
    ai_used BOOLEAN DEFAULT false,
    ai_model_used TEXT,
    
    -- Generated lesson plan IDs (JSON array of UUIDs)
    generated_lesson_ids TEXT,
    
    -- Status
    status TEXT CHECK (status IN ('pending', 'completed', 'cancelled')) DEFAULT 'pending',
    error_message TEXT,
    
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================
-- 6. LEARNING OBJECTIVES LIBRARY
-- ============================================
CREATE TABLE IF NOT EXISTS learning_objectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    
    topic TEXT NOT NULL,
    objective TEXT NOT NULL,
    
    -- Bloom's taxonomy level
    bloom_level TEXT CHECK (bloom_level IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')) DEFAULT 'understand',
    
    -- Competencies
    competency TEXT,
    cross_cutting_theme TEXT,
    
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. TEACHING RESOURCE REPOSITORY
-- ============================================
CREATE TABLE IF NOT EXISTS teaching_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    
    topic TEXT NOT NULL,
    resource_name TEXT NOT NULL,
    resource_type TEXT CHECK (resource_type IN ('video', 'image', 'document', 'link', 'file', 'simulation')) NOT NULL,
    
    -- URL or file reference
    resource_url TEXT,
    resource_file_path TEXT,
    
    -- Metadata
    description TEXT,
    difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    duration_minutes INTEGER,
    
    -- Quality rating
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    used_count INTEGER DEFAULT 0,
    
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. RLS POLICIES
-- ============================================
ALTER TABLE syllabus_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_planner_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_plan_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE teaching_resources ENABLE ROW LEVEL SECURITY;

-- School staff can manage own school's data
CREATE POLICY "School staff manage syllabus_timeline" ON syllabus_timeline
  FOR ALL USING (school_id IN (SELECT my_school_id()));

CREATE POLICY "School staff view topic_performance" ON topic_performance
  FOR SELECT USING (school_id IN (SELECT my_school_id()));

CREATE POLICY "School staff manage templates" ON lesson_plan_templates
  FOR ALL USING (school_id IN (SELECT my_school_id()));

CREATE POLICY "School staff manage planner_config" ON auto_planner_config
  FOR ALL USING (school_id IN (SELECT my_school_id()));

CREATE POLICY "School staff manage generations" ON lesson_plan_generations
  FOR ALL USING (school_id IN (SELECT my_school_id()));

CREATE POLICY "School staff manage objectives" ON learning_objectives
  FOR ALL USING (school_id IN (SELECT my_school_id()));

CREATE POLICY "School staff manage resources" ON teaching_resources
  FOR ALL USING (school_id IN (SELECT my_school_id()));
