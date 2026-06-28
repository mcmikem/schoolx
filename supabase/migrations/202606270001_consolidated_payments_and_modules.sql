-- Consolidated migration: payments, modules, and schema fixes
-- Run this on production AFTER all previous migrations to ensure schema.sql parity

-- 1. Add idempotency_key to subscription_payments for webhook dedup
alter table public.subscription_payments add column if not exists idempotency_key text;
create unique index if not exists idx_subscription_payments_idempotency on public.subscription_payments(idempotency_key) where idempotency_key is not null;

-- 2. ensure Webhook event log for debugging
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text not null,
  event_id text,
  raw_body jsonb,
  status text not null default 'received' check (status in ('received', 'processed', 'failed')),
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_webhook_events_provider_status on public.webhook_events(provider, status);
alter table public.webhook_events enable row level security;

-- 3. add updated_at trigger to module_ tables
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger if not exists trg_module_catalog_updated_at
  before update on public.module_catalog
  for each row execute function public.set_updated_at();

create trigger if not exists trg_school_module_entitlements_updated_at
  before update on public.school_module_entitlements
  for each row execute function public.set_updated_at();

-- 4. make sure schools row has updated_at
alter table public.schools add column if not exists updated_at timestamptz default now();
create trigger if not exists trg_schools_updated_at
  before update on public.schools
  for each row execute function public.set_updated_at();

-- 5. add rate limit alerts table
create table if not exists public.rate_limit_alerts (
  id uuid primary key default gen_random_uuid(),
  ip_address text,
  user_id uuid references public.users(id) on delete set null,
  endpoint text not null,
  threshold integer not null,
  actual_count integer not null,
  created_at timestamptz not null default now()
);

alter table public.rate_limit_alerts enable row level security;
create policy "Super admins read rate limit alerts" on public.rate_limit_alerts
  for select using (is_school_admin());

-- 6. ensure all plan-related check constraints allow new plan names
alter table public.subscription_payments
  drop constraint if exists subscription_payments_plan_check;

alter table public.subscription_payments
  add constraint subscription_payments_plan_check
  check (plan in ('free_trial', 'basic', 'premium', 'max', 'starter', 'growth', 'enterprise', 'lifetime'));

-- 7. drop old legacy plan constraint on schools (already updated in earlier migration, ensure consistency)
alter table public.schools
  drop constraint if exists schools_subscription_plan_check;

alter table public.schools
  add constraint schools_subscription_plan_check
  check (subscription_plan in ('free_trial', 'basic', 'premium', 'max', 'starter', 'growth', 'enterprise', 'lifetime'));

-- 8. exchange_rates table for dynamic USD/UGX conversion
create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  from_currency text not null,
  to_currency text not null,
  rate numeric not null,
  source text not null default 'manual',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_exchange_rates_active
  on public.exchange_rates(from_currency, to_currency)
  where valid_until is null;

alter table public.exchange_rates enable row level security;
create policy "Super admins manage exchange rates" on public.exchange_rates
  for all using (is_school_admin());

-- seed default USD/UGX rate
insert into public.exchange_rates (from_currency, to_currency, rate, source)
values ('USD', 'UGX', 3700, 'manual')
on conflict do nothing;

-- 9. unique index on fee_payments.payment_reference to prevent duplicate processing
create unique index if not exists idx_fee_payments_reference
  on public.fee_payments(payment_reference)
  where payment_reference is not null;

-- 10. unique index on school_module_purchases.payment_reference for dedup
create unique index if not exists idx_module_purchases_reference
  on public.school_module_purchases(payment_reference)
  where payment_reference is not null;

-- 11. rate_limit_log cleanup fallback (if pg_cron not available)
delete from public.rate_limit_log where created_at < now() - interval '1 hour';

-- schedule cleanup via pg_cron if available
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'purge-rate-limit-log',
      '*/30 * * * *',
      $$delete from public.rate_limit_log where created_at < now() - interval '1 hour'$$
    );
  end if;
end $$;

-- 12. school_entitlements view — combines entitlements with school details for admin queries
create or replace view public.school_entitlements as
select
  e.id,
  e.school_id,
  s.name as school_name,
  s.school_code,
  s.district,
  s.billing_mode,
  s.school_size_band,
  s.feature_stage,
  e.module_key,
  m.display_name as module_name,
  e.status,
  e.starts_at,
  e.ends_at,
  e.auto_renew,
  e.created_at,
  e.updated_at,
  case
    when e.status in ('active', 'trial') and e.ends_at >= now() then true
    else false
  end as is_active
from public.school_module_entitlements e
  join public.schools s on s.id = e.school_id
  left join public.module_catalog m on m.module_key = e.module_key;

-- 13. reconcile_pending_mobile_payment — atomic idempotent payment completion
create or replace function public.reconcile_pending_mobile_payment(
  p_reference text,
  p_status text,
  p_paid_at timestamptz default now()
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_pending public.pending_mobile_payments;
  v_locked boolean;
begin
  -- advisory lock scoped to this reference to serialize concurrent webhook deliveries
  v_locked := pg_try_advisory_xact_lock(hashtext('reconcile_' || p_reference));
  if not v_locked then
    return false;
  end if;

  -- read and lock the row
  select * into v_pending
  from public.pending_mobile_payments
  where reference = p_reference
    and status = 'pending'
  for update;

  if not found then
    return false;
  end if;

  -- atomically mark as completed
  update public.pending_mobile_payments
  set status = p_status
  where id = v_pending.id
    and status = 'pending';

  if not found then
    return false;
  end if;

  -- record payment
  insert into public.subscription_payments (
    school_id, plan, amount, provider, transaction_id, payment_status, paid_at
  ) values (
    v_pending.school_id,
    v_pending.plan,
    v_pending.amount,
    v_pending.provider,
    p_reference,
    case when p_status = 'completed' then 'completed' else 'failed' end,
    case when p_status = 'completed' then p_paid_at else null end
  );

  -- activate school subscription
  if p_status = 'completed' then
    update public.schools
    set
      subscription_plan = v_pending.plan,
      subscription_status = 'active',
      last_payment_at = p_paid_at
    where id = v_pending.school_id;
  end if;

  return true;
end;
$$;

-- 14. performance indexes on commonly queried school-scoped tables
create index if not exists idx_fee_structure_school on public.fee_structure(school_id);
create index if not exists idx_events_school on public.events(school_id);
create index if not exists idx_notices_school on public.notices(school_id);
create index if not exists idx_staff_school on public.staff(school_id);
create index if not exists idx_messages_school on public.messages(school_id);
create index if not exists idx_messages_sender on public.messages(sender_id);
create index if not exists idx_messages_recipient on public.messages(recipient_id);
create index if not exists idx_parent_students_parent on public.parent_students(parent_id);
create index if not exists idx_parent_students_student on public.parent_students(student_id);
create index if not exists idx_fee_payments_school on public.fee_payments(student_id);
create index if not exists idx_attendance_school on public.attendance(student_id);
create index if not exists idx_report_cards_school on public.report_cards(student_id);
create index if not exists idx_timetable_slots_class on public.timetable_slots(class_id);
create index if not exists idx_sms_logs_school on public.sms_logs(school_id);
create index if not exists idx_library_books_school on public.library_books(school_id);
create index if not exists idx_library_checkouts_school on public.library_checkouts(school_id);
create index if not exists idx_budget_items_school on public.budget_items(school_id);
create index if not exists idx_payroll_history_school on public.payroll_history(school_id);
create index if not exists idx_scheme_of_work_school on public.scheme_of_work(school_id);
create index if not exists idx_canteen_items_school on public.canteen_items(school_id);
create index if not exists idx_canteen_orders_school on public.canteen_orders(school_id);
create index if not exists idx_canteen_sales_school on public.canteen_sales(school_id);
