-- Add skipped tracking columns to setup_checklist (used by SetupChecklist component
-- "Skip" button, which currently updates these columns but they don't exist).
ALTER TABLE IF EXISTS public.setup_checklist
    ADD COLUMN IF NOT EXISTS skipped BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS skipped_at TIMESTAMPTZ;
