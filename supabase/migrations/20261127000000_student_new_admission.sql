-- ============================================================================
-- Per-pupil new-admission flag: registration fee is owed once, on entry
-- ============================================================================
-- A registration fee is charged for joining the school. A pupil who has already
-- been on roll does not join again every term, so billing them one is money the
-- school will not collect -- and because balances are derived from what was
-- billed, it quietly sits there as "owed" and eventually blocks a report card.
--
-- Why this is a flag and not a date.
--
-- admission_date cannot answer this. On a real roll it is wrong in both
-- directions: a pupil admitted in January is still "new" for the whole academic
-- year it spans, and a pupil admitted years ago can be sitting on a stale
-- admission_date that makes them look new forever. Worse, the entire live roll
-- carries the same admission_date year, so any rule of the form
-- "admission_date is in the current year" would mark every single existing
-- pupil as new and put the fee straight back on all of them. That is the exact
-- failure this column exists to prevent, so the decision is recorded instead of
-- inferred.
--
-- Tri-state, for the same reasons as takes_meals:
--
--   true  -- newly admitted. The Registration fee applies.
--   false -- already on roll. The Registration fee does not apply.
--   NULL  -- nobody has decided yet.
--
-- NULL and false bill identically -- neither is charged -- so adding the column
-- does not start billing registration to pupils who are already enrolled.
-- Keeping them distinct earns something: the registry can count how many pupils
-- are still undecided and prompt the bursar, instead of "not yet set" and
-- "confirmed continuing" being one invisible value.
--
-- Set to false rather than true deliberately. Defaulting true would charge
-- every pupil on the roll, on day one, for a fee only new joiners owe.
-- ============================================================================

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS is_new_admission BOOLEAN DEFAULT NULL;

COMMENT ON COLUMN public.students.is_new_admission IS
  'true = newly admitted this year and charged the Registration fee; false = already on roll, not charged; NULL = not yet decided, not charged.';

-- Partial index: it only ever serves the NULL case, which is a small slice.
CREATE INDEX IF NOT EXISTS idx_students_new_admission_undecided
  ON public.students (school_id)
  WHERE is_new_admission IS NULL AND status = 'active';