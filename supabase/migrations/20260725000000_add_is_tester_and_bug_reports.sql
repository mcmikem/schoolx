-- Add is_tester flag to schools for testing accounts
ALTER TABLE schools ADD COLUMN IF NOT EXISTS is_tester BOOLEAN DEFAULT false;

-- Bug reports table for tester school feedback
CREATE TABLE IF NOT EXISTS bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    page_url TEXT,
    screenshot_url TEXT,
    browser_info TEXT,
    status TEXT CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: allow insert for authenticated users from any school; select only own school's reports
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bug reports insert" ON bug_reports;
CREATE POLICY "Bug reports insert"
ON bug_reports
FOR INSERT
TO authenticated
WITH CHECK (school_id = my_school_id());

DROP POLICY IF EXISTS "Bug reports select" ON bug_reports;
CREATE POLICY "Bug reports select"
ON bug_reports
FOR SELECT
TO authenticated
USING (school_id = my_school_id());

-- supers can see all
DROP POLICY IF EXISTS "Bug reports admin" ON bug_reports;
CREATE POLICY "Bug reports admin"
ON bug_reports
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_id = auth.uid()
    AND users.role = 'super_admin'
  )
);
