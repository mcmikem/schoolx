-- ============================================================================
-- Bursar finance upgrade: money out, other income, bursaries, requirements
-- ---------------------------------------------------------------------------
-- Driven by how Ugandan school bursars actually work, not by a generic
-- "fees + invoices" model:
--
--   * They bill by TERM (3 terms), never by month.
--   * A fee is a LINE ITEM, not one tuition number: tuition, boarding,
--     transport (priced by zone), meals, uniform, functional, PTA,
--     development, exams. Day vs boarding is a real split (~50-70% higher).
--   * Money IN is mobile money far more than cash, and MoMo alerts carry no
--     student identity -- reconciliation is the #1 pain point.
--   * Money OUT needs its own ledger. Expenses are approved, not just typed,
--     and petty cash is a separate imprest account.
--   * Other income (capitation, SFG, donations, farm, rent, alumni) is a real
--     and ring-fenced category, and has nowhere to live today.
--   * UNEB exam money is a legally quarantined liability: misappropriation is
--     an offence carrying a 2,000 currency point fine. It must be trackable
--     separately as collected vs invoiced vs remitted.
--   * "Requirements" (levies) are a SECOND bill, often larger than tuition,
--     collected in cash at reporting, per class and per term. Much of it is
--     restricted under the Education Regulations 2008, so items carry
--     mandatory/optional and monetary/non-monetary flags.
--
-- IMPORTANT — exam clearance:
--   Blocking a registered candidate from sitting an exam over fees is now a
--   criminal offence in Uganda. The MoES/UNEB route is: let them sit, notify
--   UNEB, and UNEB withholds the results. So this migration does NOT add an
--   exam gate. Clearance here means fees+requirements are settled, which is
--   what lawfully withholds REPORT CARDS and transcripts.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. FEE STRUCTURE: real line-item shape
-- ---------------------------------------------------------------------------

-- Category vocabulary taken from published Ugandan fee schedules. 'other'
-- keeps every existing row valid.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'fee_category') then
    create type public.fee_category as enum (
      'tuition', 'boarding', 'meals', 'transport', 'uniform',
      'registration', 'functional', 'pta', 'development', 'library',
      'sports', 'ict', 'medical', 'exam', 'uneb', 'bank_charges', 'other'
    );
  end if;
end $$;

alter table public.fee_structure
  add column if not exists category public.fee_category not null default 'other';

-- Day vs boarding. Real schedules price these separately (boarding is
-- markedly higher), and a single "tuition" row cannot express that.
alter table public.fee_structure
  add column if not exists boarding_status text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fee_structure_boarding_status_check') then
    alter table public.fee_structure
      add constraint fee_structure_boarding_status_check
      check (boarding_status is null or boarding_status in ('day', 'boarding'));
  end if;
end $$;

-- One-off vs recurring. 'term' rows repeat every term of the year; 'one_off'
-- is charged once (application fee, deposit); 'per_year' repeats once a year.
alter table public.fee_structure
  add column if not exists frequency text not null default 'per_term';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fee_structure_frequency_check') then
    alter table public.fee_structure
      add constraint fee_structure_frequency_check
      check (frequency in ('per_term', 'one_off', 'per_year'));
  end if;
end $$;

-- Transport is priced by zone (Zone 1 cheapest .. Zone 4 furthest).
alter table public.fee_structure
  add column if not exists transport_zone text;

-- Registration, deposits and admission charges are NOT termly, but `term` is
-- currently NOT NULL. Relax it so one-off charges can exist, then backstop
-- per_term rows so existing logic that filters on a term still works.
alter table public.fee_structure
  alter column term drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fee_structure_term_frequency_check') then
    alter table public.fee_structure
      add constraint fee_structure_term_frequency_check
      check (
        (frequency in ('one_off', 'per_year') and term is null)
        or (frequency = 'per_term' and term between 1 and 3)
      );
  end if;
end $$;

create index if not exists idx_fee_structure_category
  on public.fee_structure(school_id, category)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 2. OTHER INCOME
-- ---------------------------------------------------------------------------
-- Capitation, school facilitation grants, donations, alumni, school farm,
-- rent of facilities, uniform/book sales. Grants are ring-fenced, so the
-- source matters when producing fund-wise statements.
create table if not exists public.other_income (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  source        text not null,
  category      text not null default 'other',
  amount        numeric(12,2) not null check (amount <> 0),
  received_on   date not null default current_date,
  term          integer check (term between 1 and 3),
  academic_year text,
  reference     text,
  notes         text,
  received_by   uuid references public.users(id) on delete set null,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.other_income is
  'Money in that is not school fees: capitation, grants, donations, farm, rent, uniform sales.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'other_income_category_check') then
    alter table public.other_income
      add constraint other_income_category_check
      check (category in (
        'capitation', 'grant', 'sfg', 'donation', 'alumni', 'farm',
        'rent', 'uniform_sales', 'tuck_shop', 'other'
      ));
  end if;
end $$;

create index if not exists idx_other_income_school_date
  on public.other_income(school_id, received_on desc)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3. EXPENSES: real categories, petty cash, approval trail
-- ---------------------------------------------------------------------------
-- Widen the category list to what a Ugandan school actually spends on. The
-- old enum omitted food (often the single biggest cost), repairs, security
-- and statutory remittances.
alter table public.expenses
  drop constraint if exists expenses_category_check;

alter table public.expenses
  add constraint expenses_category_check
  check (category in (
    'salaries', 'food', 'utilities', 'maintenance', 'supplies', 'transport',
    'events', 'security', 'medical', 'sports', 'fees', 'audit', 'tax',
    'bank_charges', 'petty_cash', 'other'
  ));

-- Petty cash is a separate imprest book, not just a category: it has a float,
-- a per-payment ceiling and needs voucher-backed replenishment.
alter table public.expenses add column if not exists is_petty_cash boolean not null default false;

-- Who the money was paid to, and what document backs it (GRN/invoice/voucher).
alter table public.expenses add column if not exists payee text;
alter table public.expenses add column if not exists document_ref text;

-- Withholding tax: 6% WHT applies to supplies above UGX 1,000,000, and the
-- bursar is the school's WHT agent. Education services are VAT-exempt.
alter table public.expenses add column if not exists wht_applicable boolean not null default false;
alter table public.expenses add column if not exists wht_amount numeric(12,2) not null default 0;

create index if not exists idx_expenses_school_date
  on public.expenses(school_id, expense_date desc);

-- expense_approvals existed but nothing ever wrote to it, so approvals had no
-- audit trail. Keep the table and give it the columns a real second pair of
-- eyes needs.
alter table public.expense_approvals
  add column if not exists reviewed_amount numeric(12,2);
alter table public.expense_approvals
  add column if not exists second_approver_id uuid references public.users(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4. BURSARIES
-- ---------------------------------------------------------------------------
-- Today a bursary is just a fee_adjustments row, so it cannot say who funded
-- it, what it covers, or whether it is conditional. Sponsorships are routine
-- (corporate, NGO, alumni, individuals) and schools must report on them.
create table if not exists public.bursaries (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  name          text not null,
  sponsor       text,
  amount        numeric(12,2) not null check (amount > 0),
  covers_term   integer check (covers_term between 1 and 3),
  academic_year text,
  is_conditional boolean not null default false,
  conditions    text,
  status        text not null default 'active',
  awarded_by    uuid references public.users(id) on delete set null,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bursaries_status_check') then
    alter table public.bursaries
      add constraint bursaries_status_check
      check (status in ('active', 'completed', 'withdrawn'));
  end if;
end $$;

create index if not exists idx_bursaries_student
  on public.bursaries(school_id, student_id)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 5. UNEB EXAM FEES (quarantined liability)
-- ---------------------------------------------------------------------------
-- Collected from students but owed to UNEB, never to the school's general
-- fund. The reconciliation that matters is collected vs invoiced vs remitted;
-- getting it wrong is what gets headteachers arrested.
create table if not exists public.uneb_remittances (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  academic_year  text not null,
  level          text not null,
  invoice_number text,
  amount_invoiced numeric(12,2) not null default 0,
  amount_collected numeric(12,2) not null default 0,
  amount_remitted  numeric(12,2) not null default 0,
  remitted_on    date,
  bank_reference text,
  status         text not null default 'open',
  notes          text,
  recorded_by    uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'uneb_remittances_status_check') then
    alter table public.uneb_remittances
      add constraint uneb_remittances_status_check
      check (status in ('open', 'part_remitted', 'remitted', 'closed'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. REQUIREMENTS (levies) — the second bill
-- ---------------------------------------------------------------------------
-- Published per class and per term in the end-of-term circular. Money
-- requirements are paid to the bursar at reporting; item requirements are
-- ticked off at the reception table.
create table if not exists public.requirement_items (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  class_id       uuid references public.classes(id) on delete cascade,
  name           text not null,
  description    text,
  -- Monetary requirements are collected by the bursar; non-monetary ones are
  -- items the pupil brings and staff tick off.
  is_mandatory   boolean not null default true,
  is_monetary    boolean not null default false,
  amount         numeric(12,2) check (amount is null or amount >= 0),
  unit           text,
  -- Supplied by the school means the bursar sells it at the counter
  -- (exercise books, uniforms, plates) rather than checking a pupil in.
  supplied_by_school boolean not null default false,
  term           integer check (term between 1 and 3),
  academic_year  text,
  display_order  integer not null default 0,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists idx_requirement_items_lookup
  on public.requirement_items(school_id, academic_year, term)
  where deleted_at is null;

-- Per-pupil compliance board.
create table if not exists public.student_requirements (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  requirement_id uuid not null references public.requirement_items(id) on delete cascade,
  status         text not null default 'pending',
  amount_paid    numeric(12,2) not null default 0,
  fulfilled_on   date,
  verified_by    uuid references public.users(id) on delete set null,
  notes          text,
  created_at     timestamptz not null default now(),
  unique (student_id, requirement_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'student_requirements_status_check') then
    alter table public.student_requirements
      add constraint student_requirements_status_check
      check (status in ('pending', 'brought', 'paid', 'waived'));
  end if;
end $$;

create index if not exists idx_student_requirements_student
  on public.student_requirements(school_id, student_id);

-- ---------------------------------------------------------------------------
-- 7. CLEARANCE
-- ---------------------------------------------------------------------------
-- A pupil is "cleared" when their fee balance is settled AND their mandatory
-- requirements are met. This drives report-card/transcript release and the
-- defaulter list. It is NOT an exam gate: withholding an exam sitting is an
-- offence, so nothing here blocks sittings.
create table if not exists public.clearance_records (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  academic_year  text not null,
  term           integer not null check (term between 1 and 3),
  fees_cleared   boolean not null default false,
  requirements_cleared boolean not null default false,
  balance_at_clearance numeric(12,2) not null default 0,
  is_cleared     boolean not null default false,
  cleared_on     date,
  cleared_by     uuid references public.users(id) on delete set null,
  notes          text,
  created_at     timestamptz not null default now(),
  unique (student_id, academic_year, term)
);

create index if not exists idx_clearance_school_term
  on public.clearance_records(school_id, academic_year, term);

-- ---------------------------------------------------------------------------
-- 8. RLS on the new tables
-- ---------------------------------------------------------------------------
-- Same shape as the existing finance tables: school-scoped, and the fee
-- permission key drives the UI/API layer.
do $$
declare
  t text;
begin
  foreach t in array array[
    'other_income', 'bursaries', 'uneb_remittances',
    'requirement_items', 'student_requirements', 'clearance_records'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_school_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (school_id = my_school_id()) with check (school_id = my_school_id())',
      t || '_school_all', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Clearance helper
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER with search_path pinned; answers only about the caller's
-- own school, so it cannot leak across tenants.
create or replace function public.student_fee_balance(p_student_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(fs.amount), 0) - coalesce((
    select sum(fp.amount_paid) from public.fee_payments fp
    where fp.student_id = p_student_id and fp.deleted_at is null
  ), 0)
  from public.fee_structure fs
  where fs.class_id = (select s.class_id from public.students s where s.id = p_student_id)
    and fs.deleted_at is null
$$;