-- Aggregate fee figures for a school in one round trip.
--
-- The Bursar dashboard used to derive Expected / Collected / Arrears / overdue
-- counts by downloading the roster (capped at 100 rows) and the payment
-- history (capped at 50 rows) and summing them in the browser. Any school past
-- those limits reported wrong money. This function sums the same numbers in
-- the database and returns a single small row.
--
-- Semantics mirror src/app/dashboard/dashboards/BursarDashboard.tsx exactly so
-- the only behaviour change is removing the row caps:
--   * expected = every non-deleted fee_structure row (class-scoped rows only
--     for students in that class, NULL class_id = school-wide) x students
--   * collected = every non-deleted payment against a student of the school
--   * overdue = students with expected > 0 and paid < expected
--   * high risk = students whose shortfall is >= 300,000
--   * monthly totals = payments in the current / previous calendar month
--
-- SECURITY INVOKER: RLS still applies, so a caller can only ever sum their own
-- school's rows — the same rows the existing dashboard queries already see.

CREATE OR REPLACE FUNCTION public.fee_summary(p_school_id UUID)
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
  expected_per_student AS (
    SELECT
      ss.id,
      COALESCE(SUM(fs.amount), 0)::NUMERIC AS expected
    FROM school_students ss
    LEFT JOIN public.fee_structure fs
      ON fs.school_id = p_school_id
     AND fs.deleted_at IS NULL
     AND (fs.class_id IS NULL OR fs.class_id = ss.class_id)
    GROUP BY ss.id
  ),
  paid_per_student AS (
    SELECT
      fp.student_id,
      COALESCE(SUM(fp.amount_paid), 0)::NUMERIC AS paid
    FROM public.fee_payments fp
    INNER JOIN school_students ss ON ss.id = fp.student_id
    WHERE fp.deleted_at IS NULL
    GROUP BY fp.student_id
  ),
  per_student AS (
    SELECT
      ep.expected,
      COALESCE(pp.paid, 0) AS paid
    FROM expected_per_student ep
    LEFT JOIN paid_per_student pp ON pp.student_id = ep.id
  ),
  monthly AS (
    SELECT
      COALESCE(
        SUM(fp.amount_paid) FILTER (
          WHERE fp.payment_date >= DATE_TRUNC('month', CURRENT_DATE)::DATE
            AND fp.payment_date < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::DATE
        ),
        0
      )::NUMERIC AS this_month,
      COALESCE(
        SUM(fp.amount_paid) FILTER (
          WHERE fp.payment_date >= (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month')::DATE
            AND fp.payment_date < DATE_TRUNC('month', CURRENT_DATE)::DATE
        ),
        0
      )::NUMERIC AS last_month
    FROM public.fee_payments fp
    INNER JOIN school_students ss ON ss.id = fp.student_id
    WHERE fp.deleted_at IS NULL
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

GRANT EXECUTE ON FUNCTION public.fee_summary(UUID) TO authenticated;
