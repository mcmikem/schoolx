-- Academic Locking Upgrade (Omuto School Management System)
-- This migration adds term locking capabilities to prevent academic data tampering after a term has concluded.
-- Because there is no dedicated "terms" table, we will use the `school_settings` table to store locked states.

-- To lock a term, a record should be added to `school_settings`:
-- school_id: <school_id>
-- key: 'term_locked_2024_1' (format: term_locked_<year>_<term>)
-- value: 'true'

-- We also add a view for easy querying if needed.
CREATE OR REPLACE VIEW locked_terms AS
SELECT 
    school_id,
    SPLIT_PART(key, '_', 3) AS academic_year,
    SPLIT_PART(key, '_', 4) AS term
FROM school_settings
WHERE key LIKE 'term_locked_%' AND value = 'true';

-- End of migration
