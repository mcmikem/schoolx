-- Academic Terms Model
-- Similar to OpenEduCat's op_academic_term model

CREATE TABLE IF NOT EXISTS academic_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    term_number INTEGER NOT NULL CHECK (term_number >= 1 AND term_number <= 4),
    academic_year VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, academic_year, term_number)
);

-- Index for queries
CREATE INDEX IF NOT EXISTS idx_academic_terms_school ON academic_terms(school_id);
CREATE INDEX IF NOT EXISTS idx_academic_terms_year ON academic_terms(academic_year);
CREATE INDEX IF NOT EXISTS idx_academic_terms_current ON academic_terms(school_id, is_current) WHERE is_current = true;

-- Trigger for updated_at
CREATE TRIGGER set_academic_terms_updated
    BEFORE UPDATE ON academic_terms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE academic_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY academic_terms_select ON academic_terms
    FOR SELECT USING (true);

CREATE POLICY academic_terms_insert ON academic_terms
    FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY academic_terms_update ON academic_terms
    FOR UPDATE USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY academic_terms_delete ON academic_terms
    FOR DELETE USING (auth.role() = 'service_role');

-- Function to set current term
CREATE OR REPLACE FUNCTION set_current_term(p_term_id UUID)
RETURNS void AS $$
BEGIN
    -- First, unset all current flags for this school
    UPDATE academic_terms 
    SET is_current = false 
    WHERE school_id = (SELECT school_id FROM academic_terms WHERE id = p_term_id);
    
    -- Then set the specified term as current
    UPDATE academic_terms 
    SET is_current = true 
    WHERE id = p_term_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE academic_terms IS 'Academic terms/semesters within a school year';