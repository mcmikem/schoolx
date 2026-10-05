-- Scope the fee figures to the term shown in the dashboard header.
--
-- fee_summary() used to sum every fee_structure row the school had ever
-- configured, so a school with Term 1/2/3 fees for 2026 reported roughly 3x
-- the real "Expected" while the header read "Term 3, 2026".
--
-- But scoping straight to the current term would be worse than the bug: only
-- 2 of 12 schools on production have any term=3 fee row, so the other 10 would
-- render UGX 0 until they configure Term 3. The scope is therefore chosen in
-- tiers and falls all the way back to today's behaviour:
--
--   1. fees for (p_term, p_academic_year)          — the term the header names
--   2. fees for p_academic_year                    — term not configured yet
--   3. every fee row the school has                — year not configured either
--
-- A tier only wins if its fees actually apply to at least one of the school's
-- students. Existence is not enough: a school that configured Term 3 fees
-- against classes nobody is enrolled in would otherwise drop to UGX 0 Expected
-- even though Term 1 fees are still what the students owe. The fallback is
-- therefore never able to produce a smaller total than the tier below it.
--
-- Expected and Collected are always scoped together, so the collection rate
-- stays coherent. A payment counts toward the scoped fee set when it has no
-- fee_id (unattributable — never hide money that was collected) or when its
-- fee_id points at a fee row inside the scope. fee_structure.deleted_at is
-- honoured for Expected but not for payment attribution: deleting a fee must
-- not make the money already collected against it vanish.
--
-- SECURITY INVOKER, unchanged: RLS still decides which rows are visible.
--
-- The new signature is created before the old one is dropped so there is never
-- a window in which fee_summary() does not exist: existing callers of the
-- one-argument form keep working until the drop, and afterwards PostgREST
-- fills the two defaulted parameters itself.

CREATE OR REPLACE FUNCTION public.fee_summary(
  p_school_id UUID,
  p_term INTEGER DEFAULT NULL,
  p_academic_year TEXT DEFAULT NULL
)
RETURNS TABLE (
  students_count BIGINT,
  expected_total NUMERIC,
  collected_total NUMERIC,
  overdue_count BIGINT,
  high_risk_count BIGINT,
  this_month_total NUMERIC,
  last_month_total NUMERIC
)
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  WITH school_students AS (
    SELECT s.id, s.class_id
    FROM public.students s
    WHERE s.school_id = p_school_id
  ),
  scope AS (
    SELECT
      (p_term IS NULL OR p_academic_year IS NULL) AS unscoped,
      EXISTS (
        SELECT 1
        FROM public.fee_structure t
        JOIN school_students ss ON (t.class_id IS NULL OR t.class_id = ss.class_id)
        WHERE t.school_id = p_school_id
          AND t.deleted_at IS NULL
          AND t.term = p_term
          AND t.academic_year = p_academic_year
      ) AS has_term,
      EXISTS (
        SELECT 1
        FROM public.fee_structure y
        JOIN school_students ss ON (y.class_id IS NULL OR y.class_id = ss.class_id)
        WHERE y.school_id = p_school_id
          AND y.deleted_at IS NULL
          AND y.academic_year = p_academic_year
      ) AS has_year
  ),
  tier AS (
    SELECT CASE
      WHEN unscoped THEN 'all'
      WHEN has_term THEN 'term'
      WHEN has_year THEN 'year'
      ELSE 'all'
    END AS name
    FROM scope
  ),
  fee_rows AS (
    SELECT f.id, f.class_id, f.amount, f.deleted_at
    FROM public.fee_structure f
    WHERE f.school_id = p_school_id
      AND (
        (SELECT name FROM tier) = 'all'
        OR ((SELECT name FROM tier) = 'term'
            AND f.term = p_term
            AND f.academic_year = p_academic_year)
        OR ((SELECT name FROM tier) = 'year'
            AND f.academic_year = p_academic_year)
      )
  ),
  expected_fees AS (
    SELECT fr.id, fr.class_id, fr.amount
    FROM fee_rows fr
    WHERE fr.deleted_at IS NULL
  ),
  expected_per_student AS (
    SELECT
      ss.id,
      COALESCE(SUM(ef.amount), 0)::NUMERIC AS expected
    FROM school_students ss
    LEFT JOIN expected_fees ef
      ON (ef.class_id IS NULL OR ef.class_id = ss.class_id)
    GROUP BY ss.id
  ),
  scoped_payments AS (
    SELECT fp.student_id, fp.amount_paid, fp.payment_date
    FROM public.fee_payments fp
    INNER JOIN school_students ss ON ss.id = fp.student_id
    WHERE fp.deleted_at IS NULL
      AND (
        (SELECT name FROM tier) = 'all'
        OR fp.fee_id IS NULL
        OR fp.fee_id IN (SELECT id FROM fee_rows)
      )
  ),
  paid_per_student AS (
    SELECT
      sp.student_id,
      COALESCE(SUM(sp.amount_paid), 0)::NUMERIC AS paid
    FROM scoped_payments sp
    GROUP BY sp.student_id
  ),
  per_student AS (
    SELECT ep.expected, COALESCE(pp.paid, 0) AS paid
    FROM expected_per_student ep
    LEFT JOIN paid_per_student pp ON pp.student_id = ep.id
  ),
  monthly AS (
    SELECT
      COALESCE(
        SUM(sp.amount_paid) FILTER (
          WHERE sp.payment_date >= DATE_TRUNC('month', CURRENT_DATE)::DATE
            AND sp.payment_date < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::DATE
        ),
        0
      )::NUMERIC AS this_month,
      COALESCE(
        SUM(sp.amount_paid) FILTER (
          WHERE sp.payment_date >= (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month')::DATE
            AND sp.payment_date < DATE_TRUNC('month', CURRENT_DATE)::DATE
        ),
        0
      )::NUMERIC AS last_month
    FROM scoped_payments sp
  )
  SELECT
    (SELECT COUNT(*) FROM school_students)::BIGINT,
    (SELECT COALESCE(SUM(expected), 0) FROM per_student),
    (SELECT COALESCE(SUM(paid), 0) FROM per_student),
    (SELECT COUNT(*) FROM per_student WHERE expected > 0 AND paid < expected)::BIGINT,
    (SELECT COUNT(*) FROM per_student WHERE GREATEST(0, expected - paid) >= 300000)::BIGINT,
    (SELECT this_month FROM monthly),
    (SELECT last_month FROM monthly);
$$;

GRANT EXECUTE ON FUNCTION public.fee_summary(UUID, INTEGER, TEXT) TO authenticated;
