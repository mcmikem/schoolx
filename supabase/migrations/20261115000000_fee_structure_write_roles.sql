-- ============================================================================
-- Fee structure writes: let the people who actually manage fees manage fees
-- ---------------------------------------------------------------------------
-- Symptom: the fees page renders "Set New Fees" for anyone who can reach it,
-- the form validates, the draft autosaves, and then the insert comes back as
--     new row violates row-level security policy for table "fee_structure"
-- leaving the user staring at a raw Postgres message on a phone.
--
-- Cause: the only write policy on fee_structure is the 2026-04-20 one, gated
-- on is_school_admin(school_id), which resolves to
--     users.role IN ('school_admin', 'headmaster', 'super_admin')
-- That ignores (a) the roles the app itself already treats as fee managers
-- and (b) user_roles, which has been the source of truth for "every hat this
-- person wears" since the multi-role migration.
--
-- The server route has always disagreed with the policy: /api/fees/route.ts
-- gates on FEE_MGMT_ROLES = super_admin, school_admin, admin, headmaster,
-- secretary, bursar. So the bursar could create fees over the API but never
-- from the UI, which is the exact inversion you do not want.
--
-- Fix: a single helper, can_manage_fees(), used by the write policy, that
-- unions both sources of truth. Narrowing is deliberate -- it stays school
-- scoped, and parents/teachers/dorm staff are still excluded. Per the AGENTS
-- guidance we do NOT widen `is_school_admin` itself: that function gates
-- users, staff records and grades, and loosening it to chase a fees problem
-- would hand those permissions to every clerk in the country.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The helper. SECURITY DEFINER + pinned search_path because the caller
--    cannot read users/user_roles directly under RLS, and we filter on
--    auth.uid() inside the body so it only ever answers about the caller.
--
--    This is the first (and only) migration that uses can_manage_fees(), so
--    per the migration-ordering rule it is defined right here.
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_fees(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Platform-wide admins, and the three roles is_school_admin already
    -- recognises, both of which scope themselves to p_school_id.
    public.is_school_admin(p_school_id)
    -- A super_admin with no school_id still has to manage fees.
    or public.is_super_admin()
    -- has_any_role() is NOT school scoped, so the school match is applied
    -- here. Dropping this line would let any bursar in any school edit any
    -- other school's fee structure.
    --
    -- headmaster/school_admin are listed as well as being covered by
    -- is_school_admin, because that helper only reads the PRIMARY users.role.
    -- Without them a headmaster who primarily teaches -- the most common
    -- arrangement in a rural school -- would be locked out of fees while a
    -- teacher who also types "headmaster" into user_roles got in.
    or (
      p_school_id = public.my_school_id()
      and public.has_any_role(
        array['bursar', 'secretary', 'admin', 'headmaster', 'school_admin']::public.app_role[]
      )
    );
$$;

comment on function public.can_manage_fees(uuid) is
  'True when the caller may create or edit fee_structure rows for p_school_id. '
  'Union of is_school_admin(p_school_id), is_super_admin(), and a school-scoped '
  'bursar/secretary/admin/headmaster/school_admin check over user_roles. Keeps '
  '/api/fees/route.ts FEE_MGMT_ROLES and the RLS policy in agreement, and honours '
  'multi-role staff rather than just the primary users.role.';

grant execute on function public.can_manage_fees(uuid) to authenticated;
grant execute on function public.can_manage_fees(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Re-point the write policy at the helper.
--
--    FOR ALL is kept so UPDATE keeps using USING and INSERT uses WITH CHECK;
--    both now resolve to the same predicate. Recreated rather than ALTERed
--    because WITH CHECK cannot be altered in place.
-- ---------------------------------------------------------------------------
drop policy if exists "School users fee_structure write" on public.fee_structure;

create policy "School users fee_structure write"
on public.fee_structure
for all
to authenticated
using (public.can_manage_fees(school_id))
with check (public.can_manage_fees(school_id));