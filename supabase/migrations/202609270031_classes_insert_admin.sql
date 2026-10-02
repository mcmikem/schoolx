-- classes_insert allowed is_staff_role(), which includes bursar, teacher and
-- secretary. Classes are created from Settings, which is administrator-only, and
-- the sibling update and delete policies already require an administrator.
-- Measured: with staff_role, a bursar could create a class.
DROP POLICY IF EXISTS "classes_insert" ON public.classes;
CREATE POLICY "classes_insert" ON public.classes
  FOR INSERT TO authenticated
  WITH CHECK (school_id = my_school_id() AND is_school_admin(my_school_id()));
