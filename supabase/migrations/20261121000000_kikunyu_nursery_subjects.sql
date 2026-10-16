-- ============================================================================
-- Nursery subjects for Kikunyu Infant Primary School
-- ============================================================================
-- Why
-- ---
-- The teachers sent this by hand:
--
--     Baby, middle, top
--     SST, Eng, Sci, Math, Reading and Writing, Literacy II,
--     Literacy I(a), Literacy I(b)
--
-- ...and asked for the subjects to be put everywhere they are needed.
--
-- What was actually broken
-- -----------------------
-- Baby Class had no subjects at all, so a teacher assigned to it could not
-- record a single mark: the marks page filters a teacher's subject list down to
-- the subjects in `teacher_subjects` for the selected class, and Baby had none.
--
-- Four of the eight already exist at this school (Social Studies, English,
-- Science, Mathematics). The other four -- Reading and Writing, Literacy II,
-- Literacy I(a), Literacy I(b) -- do not exist anywhere in the database and are
-- created here.
--
-- Scope decisions
-- ---------------
-- All three nursery classes get the same eight. The note lists one set of
-- subjects against "Baby, middle, top" rather than a different set per class,
-- and "put everywhere" is the request as written.
--
-- Assigned to every teacher at the school, not a named one: in a nursery a class
-- teacher commonly takes several subjects, and naming one would have been a
-- guess. Narrowing it afterwards is a single DELETE per teacher.
--
-- Idempotent: re-running inserts nothing extra.
-- ============================================================================

-- 1. The four subjects that do not exist yet.
--    level is NOT NULL in practice for these rows: 'primary' is the closest
--    valid value to nursery, which the CHECK constraint does not model.
INSERT INTO subjects (school_id, name, code, level, is_compulsory)
SELECT s.id, v.name, v.code, 'primary', true
FROM schools s
CROSS JOIN (VALUES
    ('Reading and Writing', 'RW'),
    ('Literacy II',         'LIT2'),
    ('Literacy I(a)',       'LIT1A'),
    ('Literacy I(b)',       'LIT1B')
  ) AS v(name, code)
WHERE s.name = 'Kikunyu Infant Primary School'
  AND NOT EXISTS (
    SELECT 1 FROM subjects x
    WHERE x.school_id = s.id
      AND lower(x.name) = lower(v.name)
      AND x.level = 'primary'
  );

-- 2. Attach all eight to Baby, Middle and Top.
--
--    Cross join of (class x subject x teacher) with NOT EXISTS, so this fills in
--    whichever combinations are missing and leaves existing assignments alone.
--    If a school legitimately has two classes both named "Baby Class", the name
--    match is deliberately narrow -- this targets Kikunyu's three nursery classes
--    and nothing else.
INSERT INTO teacher_subjects (teacher_id, subject_id, class_id)
SELECT t.id, sub.id, c.id
FROM classes c
CROSS JOIN subjects sub
CROSS JOIN users t
WHERE c.school_id = (SELECT id FROM schools WHERE name = 'Kikunyu Infant Primary School')
  AND c.name IN ('Baby Class', 'Middle Class', 'Top Class')
  AND sub.school_id = c.school_id
  AND sub.level = 'primary'
  AND lower(sub.name) IN (
        'social studies', 'english', 'science', 'mathematics',
        'reading and writing', 'literacy ii', 'literacy i(a)', 'literacy i(b)'
      )
  AND t.school_id = c.school_id
  AND t.role = 'teacher'
  AND NOT EXISTS (
    SELECT 1 FROM teacher_subjects ts
    WHERE ts.teacher_id = t.id
      AND ts.subject_id = sub.id
      AND ts.class_id = c.id
  );