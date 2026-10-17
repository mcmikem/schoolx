-- ============================================================================
-- Fee payments: let the fee managers actually record and correct payments
-- ---------------------------------------------------------------------------
-- Symptom: recording a payment from the bursar/money UI comes back as
--     new row violates row-level security policy for table "fee_payments"
-- on a phone, with the amount already typed in and no way forward.
--
-- Cause: the only INSERT policy still standing is the fee-terms-era one from
-- 202604200002_role_based_rls.sql, "School users fee_payments insert". Its
-- WITH CHECK requires
--     EXISTS (student_fee_terms sft JOIN students s ON s.id = sft.student_id
--             WHERE sft.id = fee_payments.student_fee_term_id
--               AND s.school_id = my_school_id()
--               AND is_school_staff(s.school_id))
-- The modern app never writes student_fee_term_id. src/lib/hooks/fees.ts
-- createPayment() inserts student_id + fee_id + school_id, so the EXISTS
-- subquery matches nothing and every insert is rejected. src/lib/hooks/fees.ts
-- deletePayment() soft-deletes via UPDATE, and that policy is gated the same
-- way, so voiding a payment fails too.
--
-- The write-policy intent pass (202611110002) meant to remove the wide
-- school-wide policy and leave a specific staff policy, but its DROP names
-- ("fee_payments_insert" etc.) never matched the capitalised policy names that
-- are actually deployed, so the legacy policies survived. This migration drops
-- the real names and replaces them with school-scoped policies whose predicate
-- matches what the app writes.
--
-- The gate is can_manage_fees() (20261115000000), the DB mirror of
-- /api/fees/route.ts FEE_MGMT_ROLES = super_admin, school_admin, admin,
-- headmaster, secretary, bursar, plus is_school_admin(). It stays school
-- scoped, so a bursar in one school cannot touch another school's payments.
-- Reads keep the staff-or-linked-parent shape. DELETE is admin-only: the
-- client voids through UPDATE, so only a deliberate admin action hard-deletes.
-- ============================================================================

-- ─── Reads: school staff, or a linked parent/guardian ────────────────────────

DROP POLICY IF EXISTS "School users fee_payments select" ON public.fee_payments;
DROP POLICY IF EXISTS "School staff and linked parents read fee_payments" ON public.fee_payments;

CREATE POLICY "School staff and linked parents read fee_payments"
ON public.fee_payments
FOR SELECT
TO authenticated
USING (
  (
    student_id IN (SELECT id FROM public.students WHERE school_id = public.my_school_id())
    AND public.is_staff_role()
  )
  OR student_id IN (SELECT public.my_student_ids())
);

-- ─── Inserts: fee managers for the student's school ──────────────────────────

DROP POLICY IF EXISTS "School users fee_payments insert" ON public.fee_payments;
DROP POLICY IF EXISTS "fee_payments_insert" ON public.fee_payments;
DROP POLICY IF EXISTS "Fee managers insert fee_payments" ON public.fee_payments;

CREATE POLICY "Fee managers insert fee_payments"
ON public.fee_payments
FOR INSERT
TO authenticated
WITH CHECK (
  student_id IN (SELECT id FROM public.students WHERE school_id = public.my_school_id())
  AND public.can_manage_fees(public.my_school_id())
);

-- ─── Updates: fee managers (void / correct a payment) ────────────────────────

DROP POLICY IF EXISTS "School users fee_payments update" ON public.fee_payments;
DROP POLICY IF EXISTS "fee_payments_update" ON public.fee_payments;
DROP POLICY IF EXISTS "Fee managers update fee_payments" ON public.fee_payments;

CREATE POLICY "Fee managers update fee_payments"
ON public.fee_payments
FOR UPDATE
TO authenticated
USING (
  student_id IN (SELECT id FROM public.students WHERE school_id = public.my_school_id())
  AND public.can_manage_fees(public.my_school_id())
)
WITH CHECK (
  student_id IN (SELECT id FROM public.students WHERE school_id = public.my_school_id())
  AND public.can_manage_fees(public.my_school_id())
);

-- ─── Deletes: admins only ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "School users fee_payments delete" ON public.fee_payments;
DROP POLICY IF EXISTS "fee_payments_delete" ON public.fee_payments;
DROP POLICY IF EXISTS "School admins delete fee_payments" ON public.fee_payments;

CREATE POLICY "School admins delete fee_payments"
ON public.fee_payments
FOR DELETE
TO authenticated
USING (
  student_id IN (SELECT id FROM public.students WHERE school_id = public.my_school_id())
  AND public.is_school_admin(public.my_school_id())
);

-- Safety net for any environment that did run the intent pass's DROP under the
-- alternative name.
DROP POLICY IF EXISTS "fee_payments_select" ON public.fee_payments;
