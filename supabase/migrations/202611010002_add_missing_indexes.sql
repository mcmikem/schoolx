-- Add missing performance indexes for common query patterns

-- 1. Events are queried by school_id and ordered by start_date
CREATE INDEX IF NOT EXISTS idx_events_school_start_date
  ON public.events (school_id, start_date DESC);

-- 2. Messages (announcements) queried by school_id and ordered by created_at
CREATE INDEX IF NOT EXISTS idx_messages_school_created
  ON public.messages (school_id, created_at DESC);

-- 3. Students frequently filtered by school_id AND status (active/inactive)
CREATE INDEX IF NOT EXISTS idx_students_school_status
  ON public.students (school_id, status);
