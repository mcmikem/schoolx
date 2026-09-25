-- Split out of 202606270001_consolidated_payments_and_modules.sql (section 14).
-- Separated so the schema-fix piece and this index piece can be applied and
-- verified independently.
--
-- IMPORTANT: every index below is wrapped in a column-existence guard.
-- Two of the original statements referenced columns that do not exist in
-- production (messages.sender_id and timetable_slots.class_id), which aborted
-- the whole migration with SQLSTATE 42703. The guard skips any index whose
-- table or column is absent, so this file can never break a deploy on a schema
-- that lags behind the repository.
--
-- idx_parent_students_student is intentionally omitted: it is created by
-- 202609110001_wave1_perf_indexes.sql.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fee_structure' and column_name in ('school_id')
  ) then
    execute 'create index if not exists idx_fee_structure_school on public.fee_structure(school_id)';
  else
    raise notice 'skipped idx_fee_structure_school: fee_structure(school_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name in ('school_id')
  ) then
    execute 'create index if not exists idx_events_school on public.events(school_id)';
  else
    raise notice 'skipped idx_events_school: events(school_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notices' and column_name in ('school_id')
  ) then
    execute 'create index if not exists idx_notices_school on public.notices(school_id)';
  else
    raise notice 'skipped idx_notices_school: notices(school_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'staff' and column_name in ('school_id')
  ) then
    execute 'create index if not exists idx_staff_school on public.staff(school_id)';
  else
    raise notice 'skipped idx_staff_school: staff(school_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'messages' and column_name in ('school_id')
  ) then
    execute 'create index if not exists idx_messages_school on public.messages(school_id)';
  else
    raise notice 'skipped idx_messages_school: messages(school_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'messages' and column_name in ('sender_id')
  ) then
    execute 'create index if not exists idx_messages_sender on public.messages(sender_id)';
  else
    raise notice 'skipped idx_messages_sender: messages(sender_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'messages' and column_name in ('recipient_id')
  ) then
    execute 'create index if not exists idx_messages_recipient on public.messages(recipient_id)';
  else
    raise notice 'skipped idx_messages_recipient: messages(recipient_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'parent_students' and column_name in ('parent_id')
  ) then
    execute 'create index if not exists idx_parent_students_parent on public.parent_students(parent_id)';
  else
    raise notice 'skipped idx_parent_students_parent: parent_students(parent_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fee_payments' and column_name in ('student_id')
  ) then
    execute 'create index if not exists idx_fee_payments_school on public.fee_payments(student_id)';
  else
    raise notice 'skipped idx_fee_payments_school: fee_payments(student_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'attendance' and column_name in ('student_id')
  ) then
    execute 'create index if not exists idx_attendance_school on public.attendance(student_id)';
  else
    raise notice 'skipped idx_attendance_school: attendance(student_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'report_cards' and column_name in ('student_id')
  ) then
    execute 'create index if not exists idx_report_cards_school on public.report_cards(student_id)';
  else
    raise notice 'skipped idx_report_cards_school: report_cards(student_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'timetable_slots' and column_name in ('class_id')
  ) then
    execute 'create index if not exists idx_timetable_slots_class on public.timetable_slots(class_id)';
  else
    raise notice 'skipped idx_timetable_slots_class: timetable_slots(class_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sms_logs' and column_name in ('school_id')
  ) then
    execute 'create index if not exists idx_sms_logs_school on public.sms_logs(school_id)';
  else
    raise notice 'skipped idx_sms_logs_school: sms_logs(school_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'library_books' and column_name in ('school_id')
  ) then
    execute 'create index if not exists idx_library_books_school on public.library_books(school_id)';
  else
    raise notice 'skipped idx_library_books_school: library_books(school_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'library_checkouts' and column_name in ('school_id')
  ) then
    execute 'create index if not exists idx_library_checkouts_school on public.library_checkouts(school_id)';
  else
    raise notice 'skipped idx_library_checkouts_school: library_checkouts(school_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'budget_items' and column_name in ('school_id')
  ) then
    execute 'create index if not exists idx_budget_items_school on public.budget_items(school_id)';
  else
    raise notice 'skipped idx_budget_items_school: budget_items(school_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payroll_history' and column_name in ('school_id')
  ) then
    execute 'create index if not exists idx_payroll_history_school on public.payroll_history(school_id)';
  else
    raise notice 'skipped idx_payroll_history_school: payroll_history(school_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'scheme_of_work' and column_name in ('school_id')
  ) then
    execute 'create index if not exists idx_scheme_of_work_school on public.scheme_of_work(school_id)';
  else
    raise notice 'skipped idx_scheme_of_work_school: scheme_of_work(school_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'canteen_items' and column_name in ('school_id')
  ) then
    execute 'create index if not exists idx_canteen_items_school on public.canteen_items(school_id)';
  else
    raise notice 'skipped idx_canteen_items_school: canteen_items(school_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'canteen_orders' and column_name in ('school_id')
  ) then
    execute 'create index if not exists idx_canteen_orders_school on public.canteen_orders(school_id)';
  else
    raise notice 'skipped idx_canteen_orders_school: canteen_orders(school_id) not present in this schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'canteen_sales' and column_name in ('school_id')
  ) then
    execute 'create index if not exists idx_canteen_sales_school on public.canteen_sales(school_id)';
  else
    raise notice 'skipped idx_canteen_sales_school: canteen_sales(school_id) not present in this schema';
  end if;
end $$;
