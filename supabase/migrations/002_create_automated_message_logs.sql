create table if not exists public.automated_message_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  trigger_id text not null,
  recipient_id text,
  recipient_type text,
  record_id uuid,
  message text,
  status text not null default 'pending',
  error text,
  created_at timestamptz not null default now()
);

create index idx_automated_message_logs_school on public.automated_message_logs(school_id);
create index idx_automated_message_logs_trigger on public.automated_message_logs(trigger_id, created_at);

alter table public.automated_message_logs enable row level security;

create policy "school_scoped_select" on public.automated_message_logs
  for select using (school_id = current_setting('app.current_school_id', true)::uuid);

create policy "service_role_all" on public.automated_message_logs
  for all to service_role using (true) with check (true);

grant all on public.automated_message_logs to service_role;
