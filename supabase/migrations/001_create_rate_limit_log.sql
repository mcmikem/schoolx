-- Rate limiting table for API endpoints
create table if not exists public.rate_limit_log (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  created_at timestamptz not null default now()
);

create index idx_rate_limit_log_key_created on public.rate_limit_log(key, created_at);

-- Auto-cleanup: delete entries older than 1 hour
create or replace function cleanup_old_rate_limits()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.rate_limit_log where created_at < now() - interval '1 hour';
end;
$$;

-- RLS
alter table public.rate_limit_log enable row level security;

-- Only service role can insert/read
create policy "service_role_can_insert" on public.rate_limit_log
  for insert to service_role with check (true);

create policy "service_role_can_read" on public.rate_limit_log
  for select to service_role using (true);

-- Grant service role access
grant insert, select on public.rate_limit_log to service_role;
