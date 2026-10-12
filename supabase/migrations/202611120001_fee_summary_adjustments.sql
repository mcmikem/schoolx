-- Teach fee_summary() about fee adjustments and opening balances.
--
-- Until now the function summed fee_structure x students minus payments and
-- ignored everything else, while the bursar panel (calculateStudentFeePosition
-- in src/lib/operations.ts) counts opening balances, penalties, and credit
-- adjustments (bursary/discount/scholarship/manual_credit/write_off/amnesty).
-- Every bursary therefore showed one figure on the dashboard and a smaller one
-- in the bursar's books. This rewrite mirrors the client maths exactly:
--   expected = GREATEST(0, structure + opening_balance + penalties - credits)
--   balance  = GREATEST(0, expected - paid)
-- so headline money, overdue counts, the high-risk flag, and the defaulter
-- list agree with the panel row-for-row.
--
-- Deliberately unchanged: scope tiers (term/year/all), monthly buckets, the
-- top-20 defaulter window, and the roster itself (all statuses — the client
-- roster in useOfflineStudents is unfiltered, so filtering here would reopen
-- the same disagreement from the other side).
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
    SELECT s.id, s.class_id, COALESCE(s.opening_balance, 0)::NUMERIC AS opening_balance
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
      COALESCE(SUM(ef.amount), 0)::NUMERIC AS struct_total
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
  -- Credit adjustments reduce what is owed (bursary/discount/scholarship and
  -- manual_credit, which is also the stored form of write_off/amnesty). Must
  -- match CREDIT_ADJUSTMENTS in src/lib/operations.ts exactly.
  credits_per_student AS (
    SELECT
      fa.student_id,
      COALESCE(SUM(fa.amount), 0)::NUMERIC AS credits
    FROM public.fee_adjustments fa
    INNER JOIN school_students ss ON ss.id = fa.student_id
    WHERE fa.deleted_at IS NULL
      AND fa.adjustment_type IN ('discount', 'scholarship', 'manual_credit', 'write_off', 'bursary', 'amnesty')
    GROUP BY fa.student_id
  ),
  penalties_per_student AS (
    SELECT
      fa.student_id,
      COALESCE(SUM(fa.amount), 0)::NUMERIC AS penalties
    FROM public.fee_adjustments fa
    INNER JOIN school_students ss ON ss.id = fa.student_id
    WHERE fa.deleted_at IS NULL
      AND fa.adjustment_type = 'penalty'
    GROUP BY fa.student_id
  ),
  per_student AS (
    SELECT
      ep.id AS student_id,
      GREATEST(
        0,
        ep.struct_total
          + ss.opening_balance
          + COALESCE(pen.penalties, 0)
          - COALESCE(cr.credits, 0)
      ) AS expected,
      COALESCE(pp.paid, 0) AS paid
    FROM expected_per_student ep
    INNER JOIN school_students ss ON ss.id = ep.id
    LEFT JOIN paid_per_student pp ON pp.student_id = ep.id
    LEFT JOIN credits_per_student cr ON cr.student_id = ep.id
    LEFT JOIN penalties_per_student pen ON pen.student_id = ep.id
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
