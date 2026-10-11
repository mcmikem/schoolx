-- Dorm feature repair (end-to-end).
--
-- The dorm UI was built against a schema that never shipped: /dashboard/dorm
-- reads dorm_rooms and inserts dorm_incidents, but neither table exists, so the
-- room map is permanently empty and every "Report Incident" fails. The roll-call
-- page (/dashboard/dorm-attendance) writes check_type, absence_reason and
-- absence_notes columns that dorm_attendance does not have, and upserts on a
-- (student_id,dorm_id,date,check_type) conflict target that matches no
-- constraint — morning and night roll call cannot coexist. On top of that the
-- dorm tables grant school-wide write to every school user (students could
-- assign themselves to any dorm or forge roll call). This migration creates the
-- missing tables, adds the missing columns, and applies the same staff-write /
-- school-read intent used in the 2026-11-11 write-policy pass.

-- ============================================================
-- DORM ROOMS (visual room map on /dashboard/dorm)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dorm_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dorm_id UUID NOT NULL REFERENCES public.dorms(id) ON DELETE CASCADE,
    room_number TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 0,
    current_occupancy INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (dorm_id, room_number)
);

ALTER TABLE public.dorm_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users dorm_rooms select" ON public.dorm_rooms;
CREATE POLICY "School users dorm_rooms select" ON public.dorm_rooms
    FOR SELECT TO authenticated
    USING (dorm_id IN (SELECT id FROM public.dorms WHERE school_id = my_school_id()));
DROP POLICY IF EXISTS "School staff dorm_rooms write" ON public.dorm_rooms;
CREATE POLICY "School staff dorm_rooms write" ON public.dorm_rooms
    FOR ALL TO authenticated
    USING (dorm_id IN (SELECT id FROM public.dorms WHERE school_id = my_school_id())
           AND (is_school_admin() OR is_school_staff(my_school_id())))
    WITH CHECK (dorm_id IN (SELECT id FROM public.dorms WHERE school_id = my_school_id())
                AND (is_school_admin() OR is_school_staff(my_school_id())));

-- ============================================================
-- DORM INCIDENTS (Report Incident on /dashboard/dorm)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dorm_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    dorm_id UUID REFERENCES public.dorms(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    incident_type TEXT NOT NULL DEFAULT 'other'
        CHECK (incident_type IN ('misbehavior', 'health', 'maintenance', 'other')),
    description TEXT NOT NULL,
    incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    reported_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dorm_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users dorm_incidents select" ON public.dorm_incidents;
CREATE POLICY "School users dorm_incidents select" ON public.dorm_incidents
    FOR SELECT TO authenticated
    USING (school_id = my_school_id());
DROP POLICY IF EXISTS "School staff dorm_incidents write" ON public.dorm_incidents;
CREATE POLICY "School staff dorm_incidents write" ON public.dorm_incidents
    FOR ALL TO authenticated
    USING (school_id = my_school_id() AND (is_school_admin() OR is_school_staff(my_school_id())))
    WITH CHECK (school_id = my_school_id() AND (is_school_admin() OR is_school_staff(my_school_id())));

-- ============================================================
-- DORM ATTENDANCE: add the columns the roll-call UI already writes
-- ============================================================
ALTER TABLE public.dorm_attendance
    ADD COLUMN IF NOT EXISTS check_type TEXT NOT NULL DEFAULT 'night';
ALTER TABLE public.dorm_attendance
    ADD COLUMN IF NOT EXISTS absence_reason TEXT;
ALTER TABLE public.dorm_attendance
    ADD COLUMN IF NOT EXISTS absence_notes TEXT;

-- Morning and night roll call must coexist: swap the one-check-per-day unique
-- constraint for a per-check-type one that matches the hook's upsert
-- onConflict ("student_id,dorm_id,date,check_type").
ALTER TABLE public.dorm_attendance
    DROP CONSTRAINT IF EXISTS dorm_attendance_dorm_id_student_id_date_key;
ALTER TABLE public.dorm_attendance
    DROP CONSTRAINT IF EXISTS dorm_attendance_dorm_student_date_check_key;
ALTER TABLE public.dorm_attendance
    ADD CONSTRAINT dorm_attendance_dorm_student_date_check_key
    UNIQUE (dorm_id, student_id, date, check_type);

-- ============================================================
-- Tighten dorm write policies (staff write, school read)
-- ============================================================
DROP POLICY IF EXISTS "School users dorm_students all" ON public.dorm_students;
DROP POLICY IF EXISTS "School users dorm_students" ON public.dorm_students;
DROP POLICY IF EXISTS "School users dorm_students select" ON public.dorm_students;
CREATE POLICY "School users dorm_students select" ON public.dorm_students
    FOR SELECT TO authenticated
    USING (dorm_id IN (SELECT id FROM public.dorms WHERE school_id = my_school_id()));
DROP POLICY IF EXISTS "School staff dorm_students write" ON public.dorm_students;
CREATE POLICY "School staff dorm_students write" ON public.dorm_students
    FOR ALL TO authenticated
    USING (dorm_id IN (SELECT id FROM public.dorms WHERE school_id = my_school_id())
           AND (is_school_admin() OR is_school_staff(my_school_id())))
    WITH CHECK (dorm_id IN (SELECT id FROM public.dorms WHERE school_id = my_school_id())
                AND (is_school_admin() OR is_school_staff(my_school_id())));

DROP POLICY IF EXISTS "School users dorm_attendance all" ON public.dorm_attendance;
DROP POLICY IF EXISTS "dorm_attendance_school" ON public.dorm_attendance;
DROP POLICY IF EXISTS "School users dorm_attendance select" ON public.dorm_attendance;
CREATE POLICY "School users dorm_attendance select" ON public.dorm_attendance
    FOR SELECT TO authenticated
    USING (school_id = my_school_id());
DROP POLICY IF EXISTS "School staff dorm_attendance write" ON public.dorm_attendance;
CREATE POLICY "School staff dorm_attendance write" ON public.dorm_attendance
    FOR ALL TO authenticated
    USING (school_id = my_school_id() AND (is_school_admin() OR is_school_staff(my_school_id())))
    WITH CHECK (school_id = my_school_id() AND (is_school_admin() OR is_school_staff(my_school_id())));

-- dorms write policy drift: live DB has "School admin dorms write" from an old
-- migration while schema.sql documents "School admins dorms write". Leave the
-- tighter of the two alone — both already require admin/staff.
