-- One round trip for everything the dashboards show alongside the roster.
--
-- useDashboardExtraData used to fire eight parallel PostgREST requests on
-- every dashboard load (attendance today, grades this term, messages today,
-- payments since the term window, staff attendance, 14 days of attendance,
-- pending expenses, pending leave). On 3G that is eight TLS handshakes plus
-- eight queue round trips before the first widget paints, and two of them
-- (grades, 14-day attendance) silently cap at PostgREST's 1000-row maximum —
-- so a school past that limit computed dropout risk from a truncated sample.
--
-- This function does all eight in one SQL statement and returns aggregates
-- rather than rows: the browser never needs the raw attendance or grade rows,
-- only the numbers it was deriving from them. The row caps disappear with
-- them.
--
-- Date windows are passed in by the client as LOCAL dates (getLocalDateString)
-- and as a local-midnight timestamp for messages.created_at, because Uganda is
-- UTC+3 and a UTC-midnight boundary used to drop the first three hours of the
-- day. Every figure mirrors the client's current arithmetic exactly:
--   * class attendance prefers attendance.class_id, falling back to the
--     roster's class_id for legacy rows that predate it, and skips rows with
--     no class at all
--   * a class is "low attendance" when present/total < 0.7 and total > 0
--   * at-risk = two or more scores below 50 this term, top 5
--   * dropout risk = active students whose rows in the window are ALL absent
--     and number 14 or more
--   * fees split the same payment set into today / this week / this term
--   * overdue = a student whose payments in the term window are under 50% of
--     the fee_structure rows that apply to them (all non-deleted rows for the
--     school, class-scoped ones only for their own class) — the exact rule
--     useDashboardExtraData applies today, including that it sums every term's
--     fee rows together and only counts payments from the last 180 days
--   * fee_payments.deleted_at is deliberately NOT filtered here: the client
--     query it replaces does not filter it either (fee_summary does, and that
--     stays the source of truth for the headline money figures)
--
-- SECURITY INVOKER (the default): RLS still applies to every table, so a
-- caller can only ever aggregate their own school's rows — exactly what the
-- eight queries it replaces already did.

CREATE OR REPLACE FUNCTION public.dashboard_extra(
  p_school_id UUID,
  p_academic_year TEXT,
  p_term TEXT,
  p_today DATE,
  p_week_start DATE,
  p_term_start DATE,
  p_dropout_start DATE,
  p_today_ts TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  WITH attendance_today AS (
    SELECT t.class_id, t.total, t.present
    FROM (
      SELECT
        COALESCE(a.class_id, s.class_id) AS class_id,
        COUNT(*)::INT AS total,
        COUNT(*) FILTER (WHERE a.status = 'present')::INT AS present
      FROM public.attendance a
      INNER JOIN public.students s ON s.id = a.student_id
      WHERE s.school_id = p_school_id
        AND a.date = p_today
      GROUP BY 1
    ) t
    WHERE t.class_id IS NOT NULL
  ),
  at_risk AS (
    SELECT
      g.student_id,
      COUNT(*) FILTER (WHERE g.score < 50) AS fails
    FROM public.grades g
    INNER JOIN public.students s ON s.id = g.student_id
    WHERE s.school_id = p_school_id
      AND g.academic_year = p_academic_year
      AND g.term = CASE
        WHEN p_term ~ '^[0-9]+$' THEN p_term::INT
        ELSE 1
      END
    GROUP BY g.student_id
    HAVING COUNT(*) FILTER (WHERE g.score < 50) >= 2
    ORDER BY fails DESC, g.student_id
    LIMIT 5
  ),
  fee_totals AS (
    SELECT
      COALESCE(SUM(fp.amount_paid) FILTER (WHERE fp.payment_date >= p_today), 0) AS today_total,
      COALESCE(SUM(fp.amount_paid) FILTER (WHERE fp.payment_date >= p_week_start), 0) AS week_total,
      COALESCE(SUM(fp.amount_paid), 0) AS term_total
    FROM public.fee_payments fp
    INNER JOIN public.students s ON s.id = fp.student_id
    WHERE s.school_id = p_school_id
      AND fp.payment_date >= p_term_start
  ),
  sms AS (
    SELECT
      COUNT(*)::INT AS sent,
      COUNT(*) FILTER (WHERE m.status = 'delivered')::INT AS delivered
    FROM public.messages m
    WHERE m.school_id = p_school_id
      AND m.created_at >= COALESCE(p_today_ts, p_today::TIMESTAMPTZ)
  ),
  student_expected AS (
    SELECT
      s.id,
      COALESCE(SUM(fs.amount), 0)::NUMERIC AS expected
    FROM public.students s
    LEFT JOIN public.fee_structure fs
      ON fs.school_id = p_school_id
     AND fs.deleted_at IS NULL
     AND (fs.class_id IS NULL OR fs.class_id = s.class_id)
    WHERE s.school_id = p_school_id
    GROUP BY s.id
  ),
  student_paid AS (
    SELECT
      fp.student_id,
      COALESCE(SUM(fp.amount_paid), 0)::NUMERIC AS paid
    FROM public.fee_payments fp
    INNER JOIN public.students s ON s.id = fp.student_id
    WHERE s.school_id = p_school_id
      AND fp.payment_date >= p_term_start
    GROUP BY fp.student_id
  ),
  overdue AS (
    SELECT COUNT(*)::INT AS n
    FROM student_expected se
    LEFT JOIN student_paid sp ON sp.student_id = se.id
    WHERE se.expected > 0
      AND COALESCE(sp.paid, 0) < se.expected * 0.5
  ),
  staff_on_duty AS (
    SELECT COUNT(*)::INT AS n
    FROM public.staff_attendance sa
    INNER JOIN public.users u ON u.id = sa.staff_id
    WHERE u.school_id = p_school_id
      AND sa.date = p_today
      AND sa.status IN ('present', 'late')
  ),
  dropout AS (
    SELECT COUNT(*)::INT AS n
    FROM (
      SELECT a.student_id
      FROM public.attendance a
      INNER JOIN public.students s ON s.id = a.student_id
      WHERE s.school_id = p_school_id
        AND s.status = 'active'
        AND a.date >= p_dropout_start
        AND a.date <= p_today
      GROUP BY a.student_id
      HAVING COUNT(*) FILTER (WHERE a.status = 'absent') >= 14
         AND COUNT(*) FILTER (WHERE a.status IS DISTINCT FROM 'absent') = 0
    ) d
  )
  SELECT jsonb_build_object(
    'class_attendance', COALESCE((
      SELECT jsonb_object_agg(
        a.class_id::TEXT,
        jsonb_build_object('present', a.present, 'total', a.total)
      )
      FROM attendance_today a
    ), '{}'::JSONB),
    'low_attendance_classes', (
      SELECT COUNT(*)
      FROM attendance_today a
      WHERE a.total > 0 AND a.present::FLOAT / a.total < 0.7
    ),
    'at_risk_students', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'first_name', s.first_name,
          'last_name', s.last_name,
          'classes', CASE WHEN c.name IS NULL THEN NULL ELSE jsonb_build_object('name', c.name) END
        )
      )
      FROM at_risk r
      INNER JOIN public.students s ON s.id = r.student_id
      LEFT JOIN public.classes c ON c.id = s.class_id
    ), '[]'::JSONB),
    'sms_sent_today', (SELECT sms.sent FROM sms),
    'sms_delivered_today', (SELECT sms.delivered FROM sms),
    'fees_today', (SELECT fee_totals.today_total FROM fee_totals),
    'fees_week', (SELECT fee_totals.week_total FROM fee_totals),
    'fees_term', (SELECT fee_totals.term_total FROM fee_totals),
    'staff_on_duty', (SELECT staff_on_duty.n FROM staff_on_duty),
    'pending_expenses', (
      SELECT COUNT(*)
      FROM public.expenses e
      WHERE e.school_id = p_school_id AND e.status = 'pending'
    ),
    'pending_leave', (
      SELECT COUNT(*)
      FROM public.leave_requests lr
      WHERE lr.school_id = p_school_id AND lr.status = 'pending'
    ),
    'dropout_risk_count', (SELECT dropout.n FROM dropout),
    'overdue_count', (SELECT overdue.n FROM overdue)
  );
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_extra(UUID, TEXT, TEXT, DATE, DATE, DATE, DATE, TIMESTAMPTZ) TO authenticated;
