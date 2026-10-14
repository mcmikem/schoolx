-- ============================================================================
-- Multi-role support
-- ---------------------------------------------------------------------------
-- Why: in most rural Ugandan schools one person wears several hats. The
-- headmaster frequently also teaches, the bursar is often also a teacher, and
-- both commonly have their own child enrolled in the same school.
--
-- The problem: `users.role` is a single scalar, so the app could only ever
-- honour one hat. A bursar who also teaches had `grades = false` and no
-- `/dashboard/grades` link in navigation at all, so teaching was impossible
-- through the UI. Simply granting `grades` to the `bursar` role would hand
-- marks-entry to every bursar everywhere, including fee clerks who must never
-- see it.
--
-- The fix: keep `users.role` as the PRIMARY role (so every existing query and
-- policy keeps working unchanged) and add `user_roles` which holds the full
-- set. Permission checks become "does ANY of my roles grant it".
--
-- Parent access is deliberately unaffected: parent RLS keys on
-- `parent_students` -> auth_id and never on role, so staff who are also
-- parents already reach their own children's records correctly.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The role vocabulary, single source of truth for the CHECK constraint.
--    Must stay in sync with UserRole in src/lib/roles.ts.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum (
      'teacher',
      'dean_of_studies',
      'bursar',
      'headmaster',
      'board',
      'parent',
      'admin',
      'school_admin',
      'super_admin',
      'secretary',
      'dorm_master',
      'marketer'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. user_roles: every role a person holds, including their primary one.
-- ---------------------------------------------------------------------------
create table if not exists public.user_roles (
  user_id     uuid        not null references public.users(id) on delete cascade,
  role        app_role    not null,
  is_primary  boolean     not null default false,
  created_at  timestamptz not null default now(),
  primary key (user_id, role)
);

comment on table public.user_roles is
  'All roles a user holds. users.role remains the primary role for backwards compatibility.';

create index if not exists idx_user_roles_role on public.user_roles(role);

-- ---------------------------------------------------------------------------
-- 3. Backfill from users.role so existing staff keep working immediately.
--    Values outside the enum (legacy typos) are skipped rather than aborting
--    the whole migration.
-- ---------------------------------------------------------------------------
insert into public.user_roles (user_id, role, is_primary)
select u.id, u.role::public.app_role, true
from public.users u
where u.role is not null
  and u.role::text in (
    'teacher','dean_of_studies','bursar','headmaster','board','parent',
    'admin','school_admin','super_admin','secretary','dorm_master','marketer'
  )
on conflict (user_id, role) do nothing;

-- Only one row per user may be flagged primary.
update public.user_roles ur
set is_primary = false
where ur.is_primary
  and ur.user_id in (
    select user_id from public.user_roles
    where is_primary
    group by user_id
    having count(*) > 1
  )
  and exists (
    select 1 from public.user_roles x
    where x.user_id = ur.user_id and x.is_primary and x.created_at < ur.created_at
  );

-- ---------------------------------------------------------------------------
-- 4. Preferred dashboard, so an HM who also teaches can choose which one they
--    land on and have it remembered.
-- ---------------------------------------------------------------------------
alter table public.users
  add column if not exists preferred_dashboard text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_preferred_dashboard_check'
  ) then
    alter table public.users
      add constraint users_preferred_dashboard_check
      check (preferred_dashboard is null or preferred_dashboard in (
        'headmaster','dean_of_studies','bursar','teacher',
        'secretary','dorm_master','super_admin','marketer'
      ));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. RLS on user_roles.
--    A user reads their own roles. School admins read/manage the roles of
--    staff in their own school. Nobody can read another school's roles.
-- ---------------------------------------------------------------------------
alter table public.user_roles enable row level security;

drop policy if exists "Users read own roles" on public.user_roles;
create policy "Users read own roles"
on public.user_roles
for select
to authenticated
using (
  user_id in (select u.id from public.users u where u.auth_id = auth.uid())
);

drop policy if exists "School admins read user_roles" on public.user_roles;
create policy "School admins read user_roles"
on public.user_roles
for select
to authenticated
using (
  user_id in (
    select u.id from public.users u
    where u.school_id = my_school_id() and is_school_admin()
  )
);

drop policy if exists "School admins manage user_roles" on public.user_roles;
create policy "School admins manage user_roles"
on public.user_roles
for all
to authenticated
using (
  user_id in (
    select u.id from public.users u
    where u.school_id = my_school_id() and is_school_admin()
  )
)
with check (
  user_id in (
    select u.id from public.users u
    where u.school_id = my_school_id() and is_school_admin()
  )
);

-- ---------------------------------------------------------------------------
-- 6. Helpers. SECURITY DEFINER is required because a plain caller cannot read
--    other users' rows, and RLS on user_roles would otherwise make
--    has_role() self-defeating. Each function is pinned to search_path and
--    filters on auth.uid() inside the body, so it only ever answers questions
--    about the caller.
-- ---------------------------------------------------------------------------

-- All roles held by the caller.
create or replace function public.my_roles()
returns setof public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select ur.role
  from public.user_roles ur
  join public.users u on u.id = ur.user_id
  where u.auth_id = auth.uid()
    and u.is_active is not false
$$;

-- True when the caller holds the given role.
create or replace function public.has_role(required public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.my_roles() r where r = required
  )
$$;

-- True when the caller holds ANY of the given roles. This is the check the
-- app needs for "bursar who is also a teacher".
create or replace function public.has_any_role(required public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.my_roles() r where r = any(required)
  )
$$;

comment on function public.my_roles() is
  'Every role held by the calling user. SECURITY DEFINER + search_path pinned; body filters on auth.uid().';