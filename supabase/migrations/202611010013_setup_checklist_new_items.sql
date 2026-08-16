-- Swap the legacy setup checklist item set for the guided post-onboarding steps.
-- The new /api/setup-progress route auto-completes each item from real data,
-- so any manual completion state on the legacy rows is not worth carrying over.

-- Snapshot the schools that went through onboarding (had checklist rows) BEFORE
-- deleting, since the insert below must target only those schools.
CREATE TEMP TABLE _checklist_schools ON COMMIT DROP AS
SELECT DISTINCT school_id FROM public.setup_checklist;

-- Remove the old 8 items.
DELETE FROM public.setup_checklist
WHERE item_key IN (
    'academic_calendar',
    'class_structure',
    'fee_structure',
    'staff_accounts',
    'student_import',
    'sms_templates',
    'payment_methods',
    'grading_config'
);

-- Add a sort column so the checklist renders in the plan's order.
ALTER TABLE public.setup_checklist
    ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Insert the new guided steps for every school that had checklist rows, keeping
-- the plan's display order via sort_order.
INSERT INTO public.setup_checklist (school_id, item_key, item_label, sort_order)
SELECT
    s.school_id,
    d.item_key,
    d.item_label,
    d.sort_order
FROM _checklist_schools s
CROSS JOIN (
    VALUES
        ('school_details',  'School details',              0),
        ('academic_term',   'Set current academic term',   1),
        ('classes',         'Add classes',                 2),
        ('subjects',        'Add subjects',                3),
        ('teachers',        'Add teachers',                4),
        ('students',        'Add students',                5),
        ('attendance',      'Record first attendance',     6),
        ('first_payment',   'Collect first payment',       7)
) AS d(item_key, item_label, sort_order)
ON CONFLICT (school_id, item_key) DO NOTHING;