-- users.phone has no uniqueness, and the app's phone lookups all search the
-- normalized 256xxxxxxxxxx form. Two rows with the same school+phone make
-- maybeSingle() error (the caller reads data=null and treats it as "no
-- account"), so create-parent-portal silently issued a second auth account
-- for a number that already had one. Normalise the seeded local-format rows
-- to the form login already searches, then let the database enforce the
-- invariant for every writer.
--
-- Only the standard local form (0 + 9 digits) is rewritten, mirroring
-- normalizeAuthPhone(). The four 11-digit seed rows (077701000xx) are left
-- untouched: normalizeAuthPhone() would truncate them to the same 12 digits,
-- which would both collide with each other and still not match on login.
--
-- Pre-flight (must return zero rows before the index is created):
--   select school_id, phone, count(*) from users where phone is not null
--   group by school_id, phone having count(*) > 1;

UPDATE users
SET phone = '256' || substr(phone, 2)
WHERE phone ~ '^0[0-9]{9}$';

CREATE UNIQUE INDEX IF NOT EXISTS users_school_id_phone_key
  ON users (school_id, phone)
  WHERE phone IS NOT NULL;
