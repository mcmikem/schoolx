-- Give fee_summary() the numbers "Top defaulters" needs, so that list is no
-- longer built from the first page of students (100 rows) and payments (50
-- rows).
--
-- TopDefaulters ranked per-student balances client-side, which meant a school
-- past those limits showed the wrong debtors and a wrong total, directly under
-- headline figures that are now summed in the database. The component only
-- renders five rows, so the function returns the top 20 along with
-- overdue_count (how many debtors there are in total) and overdue_balance
-- (what they owe in total) — the list is a window onto figures that are
-- already correct for the whole school.
--
-- The scope tiers are unchanged: this term, else this academic year, else
-- every fee — and a tier only wins when its fees apply to at least one of the
-- school's students.
--
-- Overdue balance uses the same predicate as overdue_count (expected > 0 and
-- paid < expected), so the two can never disagree.
--
-- The Supabase Management API runs only the final statement of a request, so
-- this file is applied as two calls: the DROP, then the CREATE.

DROP FUNCTION IF EXISTS public.fee_summary(UUID, INTEGER, TEXT);

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
  last_month_total NUMERIC,
  overdue_balance NUMERIC,
  defaulters JSONB
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
    SELECT
      ep.id AS student_id,
      ep.expected,
      COALESCE(pp.paid, 0) AS paid
    FROM expected_per_student ep
    LEFT JOIN paid_per_student pp ON pp.student_id = ep.id
  ),
  debtors AS (
    SELECT
      ps.student_id,
      (ps.expected - ps.paid) AS balance,
      s.first_name,
      s.last_name,
      s.parent_name,
      s.parent_phone,
      c.name AS class_name
    FROM per_student ps
    INNER JOIN public.students s ON s.id = ps.student_id
    LEFT JOIN public.classes c ON c.id = s.class_id
    WHERE ps.expected > 0 AND ps.paid < ps.expected
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
    (SELECT last_month FROM monthly),
    (SELECT COALESCE(SUM(balance), 0) FROM debtors),
    -- Head of the ranked list; overdue_count/overdue_balance cover the rest.
    -- The dashboard renders five rows, so 20 leaves room to widen the panel
    -- without another migration.
    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(d) ORDER BY d.balance DESC)
        FROM (
          SELECT student_id, first_name, last_name, parent_name, parent_phone, class_name, balance
          FROM debtors
          ORDER BY balance DESC
          LIMIT 20
        ) d
      ),
      '[]'::jsonb
    );
$$;

GRANT EXECUTE ON FUNCTION public.fee_summary(UUID, INTEGER, TEXT) TO authenticated;
