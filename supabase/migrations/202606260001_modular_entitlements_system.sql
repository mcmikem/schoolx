-- Modular entitlement system
-- Supports hybrid billing: full suite (existing) + modular feature licensing.

alter table if exists public.schools
  add column if not exists billing_mode text not null default 'full_suite'
    check (billing_mode in ('full_suite', 'modular')),
  add column if not exists school_size_band text not null default 'small'
    check (school_size_band in ('small', 'medium', 'large'));

create table if not exists public.module_catalog (
  module_key text primary key,
  display_name text not null,
  description text,
  annual_price_small numeric(12,2) not null default 0,
  annual_price_medium numeric(12,2) not null default 0,
  annual_price_large numeric(12,2) not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_module_entitlements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  module_key text not null references public.module_catalog(module_key) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'trial', 'expired', 'canceled', 'pending')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  auto_renew boolean not null default true,
  source text not null default 'purchase',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, module_key)
);

create table if not exists public.school_module_purchases (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  module_key text not null references public.module_catalog(module_key) on delete restrict,
  amount_ugx numeric(12,2) not null default 0,
  billing_period text not null default 'annual'
    check (billing_period in ('annual')),
  purchase_status text not null default 'pending'
    check (purchase_status in ('pending', 'paid', 'failed', 'canceled', 'refunded')),
  payment_provider text,
  payment_reference text,
  purchased_by uuid references public.users(id) on delete set null,
  purchased_at timestamptz not null default now(),
  valid_until timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_school_module_entitlements_school_status
  on public.school_module_entitlements (school_id, status);

create index if not exists idx_school_module_entitlements_module
  on public.school_module_entitlements (module_key);

create index if not exists idx_school_module_purchases_school_status
  on public.school_module_purchases (school_id, purchase_status);

create index if not exists idx_school_module_purchases_module
  on public.school_module_purchases (module_key);

alter table public.module_catalog enable row level security;
alter table public.school_module_entitlements enable row level security;
alter table public.school_module_purchases enable row level security;

drop policy if exists module_catalog_read on public.module_catalog;
create policy module_catalog_read
on public.module_catalog
for select
using (auth.role() = 'authenticated');

drop policy if exists school_module_entitlements_select on public.school_module_entitlements;
create policy school_module_entitlements_select
on public.school_module_entitlements
for select
using (school_id = my_school_id() or is_school_admin());

drop policy if exists school_module_entitlements_write on public.school_module_entitlements;
create policy school_module_entitlements_write
on public.school_module_entitlements
for all
using (school_id = my_school_id() and is_school_admin())
with check (school_id = my_school_id() and is_school_admin());

drop policy if exists school_module_purchases_select on public.school_module_purchases;
create policy school_module_purchases_select
on public.school_module_purchases
for select
using (school_id = my_school_id() or is_school_admin());

drop policy if exists school_module_purchases_write on public.school_module_purchases;
create policy school_module_purchases_write
on public.school_module_purchases
for all
using (school_id = my_school_id() and is_school_admin())
with check (school_id = my_school_id() and is_school_admin());

create or replace function public.get_module_price_ugx(
  p_module_key text,
  p_size_band text
)
returns numeric
language sql
stable
as $$
  select case p_size_band
    when 'large' then annual_price_large
    when 'medium' then annual_price_medium
    else annual_price_small
  end
  from public.module_catalog
  where module_key = p_module_key
  limit 1;
$$;

create or replace function public.is_module_access_active(
  p_school_id uuid,
  p_module_key text
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.school_module_entitlements e
    where e.school_id = p_school_id
      and e.module_key = p_module_key
      and e.status in ('active', 'trial')
      and e.ends_at >= now()
  );
$$;

insert into public.module_catalog (
  module_key,
  display_name,
  description,
  annual_price_small,
  annual_price_medium,
  annual_price_large,
  sort_order
)
values
  ('reports', 'Report Cards & Exams', 'Generate report cards, exam summaries, and academic performance exports.', 250000, 500000, 900000, 10),
  ('student_id', 'Student ID & Profiles', 'Student profiles, photo records, and printable ID cards.', 180000, 360000, 700000, 20),
  ('canteen', 'Canteen & POS', 'Canteen POS, wallet deductions, and daily meal reporting.', 220000, 420000, 800000, 30),
  ('fees', 'Fees & Receipts', 'Fee structures, receipts, balances, and billing operations.', 320000, 620000, 1100000, 40),
  ('attendance', 'Attendance Tracking', 'Class, period, and dorm attendance with summaries.', 200000, 400000, 750000, 50),
  ('messages', 'Messaging & Notices', 'School notices, parent messaging, and communication logs.', 160000, 320000, 650000, 60)
on conflict (module_key)
do update set
  display_name = excluded.display_name,
  description = excluded.description,
  annual_price_small = excluded.annual_price_small,
  annual_price_medium = excluded.annual_price_medium,
  annual_price_large = excluded.annual_price_large,
  sort_order = excluded.sort_order,
  updated_at = now();
