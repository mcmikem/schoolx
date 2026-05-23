-- Enforce exactly one super admin profile at database level.
-- This prevents race conditions across multiple app instances during setup.

CREATE UNIQUE INDEX IF NOT EXISTS users_single_super_admin_idx
  ON public.users ((role))
  WHERE role = 'super_admin';
