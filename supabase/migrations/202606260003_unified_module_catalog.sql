-- Unified module catalog migration
-- Replaces the 6-entry module_catalog with the full 21-module unified catalog.
-- Maps old legacy keys (fees, messages, student_id) to new unified keys (finance, communications, students).

-- 1. Insert new unified catalog entries (ignore conflicts for entries already present)
insert into public.module_catalog (module_key, display_name, description, annual_price_small, annual_price_medium, annual_price_large, is_active, sort_order)
values
  ('dashboard', 'Dashboard', 'Home dashboard, calendar, and overview widgets.', 0, 0, 0, true, 1),
  ('settings', 'Settings & Admin', 'School settings, permissions, audit logs, and user management.', 0, 0, 0, true, 2),
  ('students', 'Student Records', 'Student registry, enrollments, transfers, promotions, ID cards, and alumni.', 0, 0, 0, true, 3),
  ('staff', 'Staff Management', 'Staff records, attendance, performance reviews, leave management, and workload.', 0, 50000, 100000, true, 4),
  ('attendance', 'Attendance', 'Daily class attendance, period attendance, and staff attendance scanning.', 0, 0, 0, true, 5),
  ('communications', 'Communications', 'In-app messaging, bulk SMS, auto-SMS, notices, feedback, and announcements.', 0, 0, 0, true, 6),
  ('operations', 'Operations', 'Timetable, academic terms, rollover, automation, import/export, sync, and workflows.', 100000, 200000, 350000, true, 7),
  ('marks', 'Grades & Marks', 'Grade entry, marks completion tracking, homework, lesson plans, syllabus, and courses.', 100000, 200000, 350000, true, 8),
  ('exams', 'Exams & UNEB', 'Exam management, exam timetables, UNEB registration and results analysis.', 100000, 200000, 350000, true, 9),
  ('reports', 'Reports', 'Report cards, batch reports, custom reports, board reports, MOEs reports, and trends.', 100000, 200000, 350000, true, 10),
  ('finance', 'Finance & Fees', 'Fee collection, invoicing, cashbook, budget, expense approvals, payment plans, and billing.', 200000, 400000, 700000, true, 11),
  ('payroll', 'Payroll', 'Staff payroll management and payment processing.', 100000, 200000, 350000, true, 12),
  ('canteen', 'Canteen & Store', 'Canteen POS, meal scanning, student wallets, and store inventory.', 200000, 400000, 700000, true, 13),
  ('discipline', 'Discipline', 'Discipline records, behavior tracking, warnings, and comments.', 50000, 100000, 200000, true, 14),
  ('dorm', 'Dormitory', 'Boarding management, dorm attendance, and dorm supplies.', 100000, 200000, 350000, true, 15),
  ('health', 'Health & Sick Bay', 'Health records, sick bay visits, and health log tracking.', 50000, 100000, 200000, true, 16),
  ('analytics', 'Analytics', 'Performance analytics, class comparisons, teacher performance, and trends.', 100000, 200000, 350000, true, 17),
  ('parent_portal', 'Parent Portal', 'Parent-facing views for attendance, results, fees, and school communication.', 200000, 400000, 700000, true, 18),
  ('library', 'Library', 'Library management and book tracking.', 50000, 100000, 200000, true, 19),
  ('transport', 'Transport', 'School transport management and route tracking.', 50000, 100000, 200000, true, 20),
  ('assets', 'Assets & Inventory', 'School asset tracking and general inventory management.', 50000, 100000, 200000, true, 21)
on conflict (module_key) do nothing;

-- 2. Migrate legacy module keys in school_module_entitlements to new unified keys
update public.school_module_entitlements set module_key = 'finance' where module_key = 'fees';
update public.school_module_entitlements set module_key = 'communications' where module_key = 'messages';
update public.school_module_entitlements set module_key = 'students' where module_key = 'student_id';

-- 3. Migrate legacy module keys in school_module_purchases
update public.school_module_purchases set module_key = 'finance' where module_key = 'fees';
update public.school_module_purchases set module_key = 'communications' where module_key = 'messages';
update public.school_module_purchases set module_key = 'students' where module_key = 'student_id';

-- 4. Deactivate old legacy rows that are now superseded
--    (keep them for audit trail but hide from the UI)
update public.module_catalog set is_active = false, sort_order = 100 where module_key in ('fees', 'messages', 'student_id');
-- reports, attendance, canteen keep their existing keys (no change needed)

-- 5. Set the schools table billing_mode default
alter table public.schools alter column billing_mode set default 'full_suite';
