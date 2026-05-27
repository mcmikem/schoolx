-- Meal scan control for canteen service windows and one-plate-per-meal enforcement.
-- Keep only today's scan data to avoid storage growth in high-volume schools.

CREATE TABLE IF NOT EXISTS meal_service_rules (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
	meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'supper')),
	is_enabled BOOLEAN NOT NULL DEFAULT false,
	eligibility TEXT NOT NULL DEFAULT 'all' CHECK (eligibility IN ('all', 'boarding_only')),
	start_time TIME,
	end_time TIME,
	max_servings_per_day SMALLINT NOT NULL DEFAULT 1 CHECK (max_servings_per_day >= 1 AND max_servings_per_day <= 3),
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (school_id, meal_type)
);

CREATE TABLE IF NOT EXISTS meal_scan_logs (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
	student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
	meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'supper')),
	service_date DATE NOT NULL DEFAULT (timezone('Africa/Kampala', now()))::date,
	served_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	served_by UUID REFERENCES users(id) ON DELETE SET NULL,
	source TEXT NOT NULL DEFAULT 'scanner',
	notes TEXT,
	UNIQUE (school_id, student_id, meal_type, service_date)
);

CREATE INDEX IF NOT EXISTS idx_meal_scan_logs_school_date ON meal_scan_logs (school_id, service_date DESC);
CREATE INDEX IF NOT EXISTS idx_meal_scan_logs_student_date ON meal_scan_logs (student_id, service_date DESC);

CREATE OR REPLACE FUNCTION touch_meal_service_rules_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	NEW.updated_at = now();
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_meal_service_rules_updated_at ON meal_service_rules;
CREATE TRIGGER trg_touch_meal_service_rules_updated_at
BEFORE UPDATE ON meal_service_rules
FOR EACH ROW
EXECUTE FUNCTION touch_meal_service_rules_updated_at();

ALTER TABLE meal_service_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_scan_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school users can read meal_service_rules" ON meal_service_rules;
CREATE POLICY "school users can read meal_service_rules"
ON meal_service_rules
FOR SELECT
TO authenticated
USING (school_id = my_school_id());

DROP POLICY IF EXISTS "school admins can write meal_service_rules" ON meal_service_rules;
CREATE POLICY "school admins can write meal_service_rules"
ON meal_service_rules
FOR ALL
TO authenticated
USING (school_id = my_school_id() AND is_school_admin())
WITH CHECK (school_id = my_school_id() AND is_school_admin());

DROP POLICY IF EXISTS "school users can read meal_scan_logs" ON meal_scan_logs;
CREATE POLICY "school users can read meal_scan_logs"
ON meal_scan_logs
FOR SELECT
TO authenticated
USING (school_id = my_school_id());

DROP POLICY IF EXISTS "school users can insert meal_scan_logs" ON meal_scan_logs;
CREATE POLICY "school users can insert meal_scan_logs"
ON meal_scan_logs
FOR INSERT
TO authenticated
WITH CHECK (school_id = my_school_id());

DROP POLICY IF EXISTS "school admins can delete meal_scan_logs" ON meal_scan_logs;
CREATE POLICY "school admins can delete meal_scan_logs"
ON meal_scan_logs
FOR DELETE
TO authenticated
USING (school_id = my_school_id() AND is_school_admin());

CREATE OR REPLACE FUNCTION cleanup_old_meal_scan_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
	DELETE FROM meal_scan_logs
	WHERE service_date < (timezone('Africa/Kampala', now()))::date;
END;
$$;

DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
		BEGIN
			PERFORM cron.unschedule('purge-meal-scan-logs');
		EXCEPTION WHEN OTHERS THEN
			NULL;
		END;

		PERFORM cron.schedule(
			'purge-meal-scan-logs',
			'10 * * * *',
			$$SELECT cleanup_old_meal_scan_logs();$$
		);
	END IF;
END $$;
