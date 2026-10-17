-- ============================================================================
-- Kikunyu: keep "R.E (Religious Education)", drop "Religious Education"
-- ============================================================================
-- Why this is a separate migration
-- -------------------------------
-- 20261120000000 deliberately does NOT merge abbreviations. Collapsing
-- "R.E (Religious Education)" onto "Religious Education" needs a hardcoded
-- abbreviation map, and a migration should not decide which of two labels a
-- school recognises. That migration reports the pair instead.
--
-- The school has now decided: R.E (Religious Education) is the label that stays.
-- So this records that decision for the one school that has both.
--
-- The state on Kikunyu Infant Primary School:
--
--   "R.E (Religious Education)"   created 2026-07-23   12 teacher_timetable rows
--   "Religious Education"         created 2026-10-05    0 rows
--
-- Choosing the older label means the row holding the timetable survives, so in
-- practice nothing has to move. References are still repointed defensively --
-- if a school has since added marks against the other row, they follow the
-- subject rather than being orphaned.
--
-- Idempotent, and scoped to schools that hold BOTH labels at the same level, so
-- a school with only one of them is untouched.
-- ============================================================================

-- 1. Move any references from the dropped label onto the kept one.
DO $$
DECLARE
  d record;
  moved integer := 0;
BEGIN
  FOR d IN
    SELECT du.id AS dupe_id, ki.id AS keep_id, sc.name AS school
    FROM subjects du
    JOIN subjects ki
      ON ki.school_id = du.school_id
     AND ki.level IS NOT DISTINCT FROM du.level
    JOIN schools sc ON sc.id = du.school_id
    WHERE du.name = 'Religious Education'
      AND ki.name = 'R.E (Religious Education)'
      AND du.id <> ki.id
  LOOP
    UPDATE teacher_timetable SET subject_id = d.keep_id WHERE subject_id = d.dupe_id;
    GET DIAGNOSTICS moved = ROW_COUNT;
    RAISE NOTICE 'teacher_timetable at %: % rows moved', d.school, moved;
  END LOOP;
END $$;

-- 2. Same for the other tables that can point at a subject.
DO $$
DECLARE
  d record;
BEGIN
  FOR d IN
    SELECT du.id AS dupe_id, ki.id AS keep_id, sc.name AS school
    FROM subjects du
    JOIN subjects ki
      ON ki.school_id = du.school_id
     AND ki.level IS NOT DISTINCT FROM du.level
    JOIN schools sc ON sc.id = du.school_id
    WHERE du.name = 'Religious Education'
      AND ki.name = 'R.E (Religious Education)'
      AND du.id <> ki.id
  LOOP
    UPDATE grades       SET subject_id = d.keep_id WHERE subject_id = d.dupe_id;
    UPDATE exam_scores  SET subject_id = d.keep_id WHERE subject_id = d.dupe_id;
    UPDATE exams        SET subject_id = d.keep_id WHERE subject_id = d.dupe_id;
    UPDATE lesson_plans SET subject_id = d.keep_id WHERE subject_id = d.dupe_id;
    UPDATE homework     SET subject_id = d.keep_id WHERE subject_id = d.dupe_id;
    RAISE NOTICE 'references moved at %', d.school;
  END LOOP;
END $$;

-- 3. Remove the dropped label, now unreferenced.
DO $$
DECLARE removed integer := 0;
BEGIN
  DELETE FROM subjects du
  USING subjects ki
  WHERE ki.school_id = du.school_id
    AND ki.level IS NOT DISTINCT FROM du.level
    AND du.name = 'Religious Education'
    AND ki.name = 'R.E (Religious Education)'
    AND du.id <> ki.id;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RAISE NOTICE '"Religious Education" rows removed: %', removed;
END $$;