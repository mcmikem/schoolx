-- ============================================================================
-- Merge duplicate subject rows, and stop them recurring
-- ============================================================================
-- Why this exists
-- ---------------
-- A school's subject list is what a teacher picks from to mark work, so a
-- subject appearing twice is not cosmetic: it splits their marks across two
-- records and makes the register look unfinished.
--
-- Found on Kikunyu Infant Primary School, which carried both
--
--   "R.E (Religious Education)"  created 2026-07-23   12 teacher_timetable rows
--   "Religious Education"        created 2026-10-05    0 rows
--
-- same school, same level, same code. Three other schools carry only the
-- "R.E (...)" label, so this is a naming drift rather than a deliberate split.
--
-- What this deliberately does NOT do
-- ----------------------------------
-- Subjects named the same at different levels are NOT duplicates. The global
-- catalogue and several schools carry "Mathematics" once as primary and once as
-- secondary on purpose, and collapsing those would merge two genuinely different
-- courses. Everything below is therefore scoped to same school AND same level.
--
-- Safety
-- ------
-- References are moved before anything is deleted, so no timetable slot, grade,
-- exam or lesson plan is lost. The oldest row wins, because that is the one that
-- accumulated history. Idempotent: safe to run twice.
-- ============================================================================

-- 1. Move every reference from a duplicate onto the survivor.
--
--    "canonical" is the oldest row in each duplicate group; "duplicate" is the
--    newer one. Built as a CTE so the mapping is computed once and reused.
DO $$
DECLARE
  moved integer := 0;
BEGIN
  WITH canon AS (
    SELECT DISTINCT ON (school_id, level, canon_name)
           id AS keep_id,
           school_id,
           level,
           canon_name
    FROM (
      SELECT
        id,
        school_id,
        level,
        -- Case and punctuation are noise; abbreviations are NOT treated as
        -- equivalent. See the note at the top of this file: collapsing
        -- "R.E (Religious Education)" onto "Religious Education" needs a
        -- hardcoded exception, and that exception would also silently pick which
        -- of the two labels survives on a real school.
        regexp_replace(lower(name), '[^a-z0-9]+', ' ', 'g') AS canon_name,
        created_at
      FROM subjects
      WHERE school_id IS NOT NULL
    ) n
    ORDER BY school_id, level, canon_name, created_at ASC, id ASC
  ),
  dupes AS (
    SELECT s.id AS dupe_id, c.keep_id
    FROM subjects s
    JOIN canon c
      ON c.school_id = s.school_id
     AND c.level IS NOT DISTINCT FROM s.level
     AND c.canon_name = regexp_replace(lower(s.name), '[^a-z0-9]+', ' ', 'g')
    WHERE s.id <> c.keep_id
  ),
  mapped AS (SELECT keep_id, dupe_id FROM dupes)
  UPDATE teacher_timetable t SET subject_id = m.keep_id FROM mapped m WHERE t.subject_id = m.dupe_id;
  GET DIAGNOSTICS moved = ROW_COUNT;
  RAISE NOTICE 'teacher_timetable: % rows repointed', moved;
END $$;

-- 2. Do the same for every other table that points at subjects.
--    Separate DO blocks so one failure cannot roll the whole thing back and
--    leave a half-merged state.
DO $$ BEGIN
  WITH canon AS (
    SELECT DISTINCT ON (school_id, level, canon_name) id AS keep_id, school_id, level, canon_name
    FROM (SELECT id, school_id, level,
                 regexp_replace(lower(name), '[^a-z]', '', 'g') AS canon_name, created_at
          FROM subjects WHERE school_id IS NOT NULL) n
    ORDER BY school_id, level, canon_name, created_at ASC, id ASC
  ), d AS (
    SELECT s.id AS dupe_id, c.keep_id FROM subjects s JOIN canon c
      ON c.school_id = s.school_id AND c.level IS NOT DISTINCT FROM s.level
     AND c.canon_name = regexp_replace(lower(s.name), '[^a-z0-9]+', ' ', 'g')
    WHERE s.id <> c.keep_id
  ) UPDATE grades g SET subject_id = d.keep_id FROM d WHERE g.subject_id = d.dupe_id;
  RAISE NOTICE 'grades repointed';
END $$;

DO $$ BEGIN
  WITH canon AS (
    SELECT DISTINCT ON (school_id, level, canon_name) id AS keep_id, school_id, level, canon_name
    FROM (SELECT id, school_id, level,
                 regexp_replace(lower(name), '[^a-z]', '', 'g') AS canon_name, created_at
          FROM subjects WHERE school_id IS NOT NULL) n
    ORDER BY school_id, level, canon_name, created_at ASC, id ASC
  ), d AS (
    SELECT s.id AS dupe_id, c.keep_id FROM subjects s JOIN canon c
      ON c.school_id = s.school_id AND c.level IS NOT DISTINCT FROM s.level
     AND c.canon_name = regexp_replace(lower(s.name), '[^a-z0-9]+', ' ', 'g')
    WHERE s.id <> c.keep_id
  ) UPDATE exam_scores e SET subject_id = d.keep_id FROM d WHERE e.subject_id = d.dupe_id;
  RAISE NOTICE 'exam_scores repointed';
END $$;

DO $$ BEGIN
  WITH canon AS (
    SELECT DISTINCT ON (school_id, level, canon_name) id AS keep_id, school_id, level, canon_name
    FROM (SELECT id, school_id, level,
                 regexp_replace(lower(name), '[^a-z]', '', 'g') AS canon_name, created_at
          FROM subjects WHERE school_id IS NOT NULL) n
    ORDER BY school_id, level, canon_name, created_at ASC, id ASC
  ), d AS (
    SELECT s.id AS dupe_id, c.keep_id FROM subjects s JOIN canon c
      ON c.school_id = s.school_id AND c.level IS NOT DISTINCT FROM s.level
     AND c.canon_name = regexp_replace(lower(s.name), '[^a-z0-9]+', ' ', 'g')
    WHERE s.id <> c.keep_id
  ) UPDATE exams e SET subject_id = d.keep_id FROM d WHERE e.subject_id = d.dupe_id;
  RAISE NOTICE 'exams repointed';
END $$;

DO $$ BEGIN
  WITH canon AS (
    SELECT DISTINCT ON (school_id, level, canon_name) id AS keep_id, school_id, level, canon_name
    FROM (SELECT id, school_id, level,
                 regexp_replace(lower(name), '[^a-z]', '', 'g') AS canon_name, created_at
          FROM subjects WHERE school_id IS NOT NULL) n
    ORDER BY school_id, level, canon_name, created_at ASC, id ASC
  ), d AS (
    SELECT s.id AS dupe_id, c.keep_id FROM subjects s JOIN canon c
      ON c.school_id = s.school_id AND c.level IS NOT DISTINCT FROM s.level
     AND c.canon_name = regexp_replace(lower(s.name), '[^a-z0-9]+', ' ', 'g')
    WHERE s.id <> c.keep_id
  ) UPDATE lesson_plans l SET subject_id = d.keep_id FROM d WHERE l.subject_id = d.dupe_id;
  RAISE NOTICE 'lesson_plans repointed';
END $$;

DO $$ BEGIN
  WITH canon AS (
    SELECT DISTINCT ON (school_id, level, canon_name) id AS keep_id, school_id, level, canon_name
    FROM (SELECT id, school_id, level,
                 regexp_replace(lower(name), '[^a-z]', '', 'g') AS canon_name, created_at
          FROM subjects WHERE school_id IS NOT NULL) n
    ORDER BY school_id, level, canon_name, created_at ASC, id ASC
  ), d AS (
    SELECT s.id AS dupe_id, c.keep_id FROM subjects s JOIN canon c
      ON c.school_id = s.school_id AND c.level IS NOT DISTINCT FROM s.level
     AND c.canon_name = regexp_replace(lower(s.name), '[^a-z0-9]+', ' ', 'g')
    WHERE s.id <> c.keep_id
  ) UPDATE homework h SET subject_id = d.keep_id FROM d WHERE h.subject_id = d.dupe_id;
  RAISE NOTICE 'homework repointed';
END $$;

-- 3. Now, and only now, remove the emptied duplicates.
DO $$
DECLARE removed integer := 0;
BEGIN
  WITH canon AS (
    SELECT DISTINCT ON (school_id, level, canon_name) id AS keep_id, school_id, level, canon_name
    FROM (SELECT id, school_id, level,
                 regexp_replace(lower(name), '[^a-z]', '', 'g') AS canon_name, created_at
          FROM subjects WHERE school_id IS NOT NULL) n
    ORDER BY school_id, level, canon_name, created_at ASC, id ASC
  )
  DELETE FROM subjects s
  USING canon c
  WHERE c.school_id = s.school_id
    AND c.level IS NOT DISTINCT FROM s.level
    AND c.canon_name = regexp_replace(lower(s.name), '[^a-z0-9]+', ' ', 'g')
    AND s.id <> c.keep_id;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RAISE NOTICE 'duplicate subjects removed: %', removed;
END $$;

-- 4. Stop it happening again.
--
--    Unique over school + level + normalised name. COALESCE on school_id because
--    Postgres treats NULLs as distinct in a unique index, and the global
--    catalogue is exactly the rows with a NULL school -- without COALESCE that
--    half of the table would stay unguarded.
CREATE UNIQUE INDEX IF NOT EXISTS subjects_school_level_name_uniq
  ON subjects (
    COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(level, ''),
    regexp_replace(lower(name), '[^a-z0-9]+', ' ', 'g')
  );

-- 5. Report, do not resolve, the abbreviations.
--
--    These are the same subject written two ways. They are deliberately NOT
--    merged above: doing so means hardcoding an abbreviation map, and the
--    choice of which label survives is a decision for whoever runs the school,
--    not for a migration. This lists them so the choice can be made with the
--    facts in hand.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT a.name AS label_a, d.name AS label_b,
           sc.name AS school, a.school_id AS school_id,
           (SELECT count(*) FROM teacher_timetable t WHERE t.subject_id IN (a.id, d.id)) AS timetable_rows
    FROM subjects a
    JOIN subjects d
      ON d.school_id = a.school_id
     AND a.id < d.id
     AND a.level IS NOT DISTINCT FROM d.level
    JOIN schools sc ON sc.id = a.school_id
    WHERE a.school_id IS NOT NULL
      -- One name is a suffix of the other once punctuation and spaces are gone:
      -- "R.E (Religious Education)" -> rereligiouseducation, which ends with
      -- "religiouseducation". Narrow on purpose -- a loose similarity match
      -- produced pairs like "Demo School" vs "CAPE (Arts & Technology)".
      AND regexp_replace(lower(a.name), '[^a-z0-9]', '', 'g')
          LIKE '%' || regexp_replace(lower(d.name), '[^a-z0-9]', '', 'g')
      AND length(regexp_replace(lower(a.name), '[^a-z0-9]', '', 'g'))
          > length(regexp_replace(lower(d.name), '[^a-z0-9]', '', 'g'))
  LOOP
    RAISE NOTICE 'possible same subject, different label: "%" vs "%" at % (%) -- review, not merged',
      r.label_a, r.label_b, r.school, r.school_id;
  END LOOP;
END $$;
