-- Activity Comments Trail
-- Similar to Odoo's mail.thread - allows comments on any entity

CREATE TABLE IF NOT EXISTS activity_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,  -- 'student', 'attendance', 'fee_payment', etc.
    entity_id UUID NOT NULL,
    author_id UUID REFERENCES users(id),
    author_name VARCHAR(100),
    content TEXT NOT NULL,
    comment_type VARCHAR(20) DEFAULT 'note' CHECK (comment_type IN ('note', 'system', 'action_required', 'resolved')),
    is_internal BOOLEAN DEFAULT false,  -- Only visible to staff
    parent_id UUID REFERENCES activity_comments(id),  -- For threading
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_activity_comments_entity 
    ON activity_comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_comments_author 
    ON activity_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_activity_comments_parent 
    ON activity_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_activity_comments_type 
    ON activity_comments(comment_type);

-- Trigger for updated_at
CREATE TRIGGER set_activity_comments_updated
    BEFORE UPDATE ON activity_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE activity_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_comments_select ON activity_comments
    FOR SELECT USING (
        is_internal = false 
        OR auth.role() IN ('authenticated', 'service_role')
    );

CREATE POLICY activity_comments_insert ON activity_comments
    FOR INSERT WITH CHECK (
        author_id IS NOT NULL 
        OR auth.role() = 'service_role'
    );

CREATE POLICY activity_comments_update ON activity_comments
    FOR UPDATE USING (
        author_id = auth.uid() 
        OR auth.role() IN ('service_role', 'school_admin', 'headmaster')
    );

-- Function to get comments for an entity
CREATE OR REPLACE FUNCTION get_entity_comments(
    p_entity_type VARCHAR,
    p_entity_id UUID,
    p_include_internal BOOLEAN DEFAULT false
)
RETURNS TABLE (
    id UUID,
    author_name VARCHAR,
    content TEXT,
    comment_type VARCHAR,
    is_internal BOOLEAN,
    created_at TIMESTAMPTZ,
    replies JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.author_name,
        c.content,
        c.comment_type,
        c.is_internal,
        c.created_at,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', r.id,
                    'author_name', r.author_name,
                    'content', r.content,
                    'created_at', r.created_at
                )
            ) FILTER (WHERE r.id IS NOT NULL),
            '[]'::jsonb
        ) as replies
    FROM activity_comments c
    LEFT JOIN activity_comments r ON r.parent_id = c.id
    WHERE c.entity_type = p_entity_type
        AND c.entity_id = p_entity_id
        AND (p_include_internal OR c.is_internal = false)
        AND c.parent_id IS NULL
    GROUP BY c.id, c.author_name, c.content, c.comment_type, c.is_internal, c.created_at
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to add a comment (for use in API)
CREATE OR REPLACE FUNCTION add_entity_comment(
    p_entity_type VARCHAR,
    p_entity_id UUID,
    p_content TEXT,
    p_comment_type VARCHAR DEFAULT 'note',
    p_is_internal BOOLEAN DEFAULT false,
    p_parent_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR;
    v_comment_id UUID;
BEGIN
    -- Get current user info
    SELECT id, full_name INTO v_user_id, v_user_name
    FROM users
    WHERE auth_id = auth.uid()
    LIMIT 1;
    
    -- If no user found, use system
    IF v_user_id IS NULL THEN
        v_user_name := 'System';
    END IF;
    
    INSERT INTO activity_comments (
        entity_type,
        entity_id,
        author_id,
        author_name,
        content,
        comment_type,
        is_internal,
        parent_id
    )
    VALUES (
        p_entity_type,
        p_entity_id,
        v_user_id,
        v_user_name,
        p_content,
        p_comment_type,
        p_is_internal,
        p_parent_id
    )
    RETURNING id INTO v_comment_id;
    
    RETURN v_comment_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE activity_comments IS 'Activity/timeline comments on any entity - similar to Odoo mail.thread';