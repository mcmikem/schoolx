
-- Create houses table (sports/competition houses)
-- The table was only in schema.sql, never created via migration.
-- This fixes "relation houses does not exist" errors when saving houses.

CREATE TABLE IF NOT EXISTS houses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    motto TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE houses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users houses select" ON "houses";
CREATE POLICY "School users houses select"
ON "houses"
FOR SELECT
TO authenticated
USING (
  school_id = my_school_id()
);

DROP POLICY IF EXISTS "School users houses write" ON "houses";
CREATE POLICY "School users houses write"
ON "houses"
FOR ALL
TO authenticated
USING (
  school_id = my_school_id()
)
WITH CHECK (
  school_id = my_school_id()
);
