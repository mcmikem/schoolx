-- ============================================================================
-- Per-pupil meal opt-in
-- ============================================================================
-- Not every day pupil eats at school. Some go home to eat. Charging a Meals
-- fee to a pupil who never receives a meal is not a rounding error, it is money
-- a parent will rightly refuse -- and because balances are derived from what
-- was billed, it quietly becomes "owed".
--
-- meal_service_rules.eligibility cannot express this. It is 'all' or
-- 'boarding_only', a single school-wide switch per meal type, so it can say
-- "boarding only" but never "these six day pupils eat, those twenty don't".
--
-- Tri-state on purpose:
--
--   true  -- takes meals. The Meals fee applies.
--   false -- goes home. The Meals fee does not apply.
--   NULL  -- nobody has decided yet.
--
-- NULL and false bill identically -- neither is charged -- so an existing
-- school stops billing meals to pupils who do not eat, which is the intent.
-- Keeping them distinct costs nothing and earns something: the fees screen can
-- count how many pupils are still undecided and prompt the bursar, instead of
-- "not yet set" and "explicitly declined" being the same invisible value.
--
-- Set to false rather than true deliberately. Defaulting true would keep the
-- problem forever; defaulting false charges only pupils confirmed to eat.
--
-- Note this drops meal revenue for pupils who were being charged before and
-- never set. That is the intended correction, not a side effect: the bursar
-- needs to see the undecided count to follow up.
-- ============================================================================

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS takes_meals BOOLEAN DEFAULT NULL;

COMMENT ON COLUMN public.students.takes_meals IS
  'true = pupil eats at school and is charged the Meals fee; false = goes home, not charged; NULL = not yet decided, not charged.';

-- The fees screen counts undecided pupils per school to prompt the bursar.
-- Partial index: it only ever serves the NULL case, which is a small slice.
CREATE INDEX IF NOT EXISTS idx_students_takes_meals_undecided
  ON public.students (school_id)
  WHERE takes_meals IS NULL AND status = 'active';