# schema.sql has drifted from the production database

`supabase/schema.sql` is treated as the source of truth, but it no longer
describes the running database. This was found on 2026-09-27 by dumping
`information_schema` from production and diffing it against the file.

Two bugs fixed during the same audit came directly from this: policies were
written against `activity_comments.school_id` and `fee_term_lines.school_id`,
columns the live tables do not have.

## Summary

| | count |
|---|---|
| tables in production | 140 |
| tables declared in schema.sql | 139 |
| tables only in production | 9 |
| tables only in schema.sql | 8 |
| tables with columns schema.sql invented | 21 |
| tables with columns schema.sql omits | 35 |

## Regenerating the file

The canonical fix is to dump the live database, not to hand-edit:

```bash
supabase db pull --linked        # requires Docker for the shadow database
```

That was not possible here: `db pull` builds a shadow database and Docker was
not running. Hand-writing a replacement was rejected because it would drop the
foreign keys and CHECK constraints the current file carries.

## Columns schema.sql declares that do not exist in production

Anything written against these will fail at runtime.

| table | phantom columns |
|---|---|
| `activity_comments` | `school_id` |
| `automated_message_logs` | `record_id` |
| `behavior_logs` | `disrespect`, `helping`, `homework` |
| `classes` | `arts`, `b`, `science` |
| `co_curricular_activities` | `period`, `school_id`, `updated_at` |
| `course_classes` | `school_id` |
| `dorm_students` | `assigned_date`, `created_at` |
| `dorms` | `warden_id` |
| `fee_payments` | `deleted_by` |
| `fee_structure` | `deleted_by` |
| `fee_term_lines` | `school_id` |
| `homework_submissions` | `created_at`, `marks`, `school_id`, `status` |
| `lesson_plans` | `homework`, `teaching_method` |
| `library_books` | `total_copies` |
| `messages` | `delivery_status`, `recipient_count` |
| `module_catalog` | `icon` |
| `schools` | `has_boarding`, `has_houses`, `has_student_council`, `location_type`, `student_id_format` |
| `student_enrollments` | `school_id` |
| `student_fee_terms` | `school_id` |
| `suggestions` | `created_by` |
| `syllabus` | `week` |

## Columns production has that schema.sql omits

| table | missing columns |
|---|---|
| `academic_years` | `is_current` |
| `attendance` | `status` |
| `auto_planner_config` | `ai_provider`, `default_lesson_duration`, `enable_ai_generation`, `include_homework`, `lessons_per_week_target` |
| `behavior_logs` | `description`, `recorded_by`, `school_id` |
| `budgets` | `academic_year` |
| `classes` | `class_teacher_id`, `level`, `stream` |
| `co_curricular_activities` | `achievements`, `created_by`, `date`, `description` |
| `courses` | `department_id`, `metadata`, `updated_at` |
| `dorm_attendance` | `checked_at`, `checked_by` |
| `dorm_students` | `assigned_at` |
| `fee_adjustments` | `deleted_at` |
| `fee_payments` | `payment_mode` |
| `fee_structure` | `category` |
| `grades` | `approved_at`, `approved_by`, `competency_notes`, `deleted_at`, `deleted_by`, `published_at`, `published_by`, `status`, `submitted_at`, `submitted_by` |
| `homework_submissions` | `marks_obtained` |
| `lesson_plan_generations` | `generated_lesson_ids`, `generation_source`, `status`, `topic_count` |
| `lesson_plans` | `created_by`, `date`, `lesson_date`, `lesson_number`, `lesson_title`, `materials`, `notes`, `objectives`, `week_number` |
| `library_books` | `copies` |
| `library_checkouts` | `checkout_date` |
| `notices` | `image_url` |
| `payroll_history` | `gross_pay` |
| `scheme_of_work` | `objectives` |
| `schools` | `accent_color`, `admin_users_allowed`, `custom_features`, `lifetime_license`, `notes`, `on_premise`, `onboarding_complete`, `onboarding_completed`, `onboarding_completed_at`, `onboarding_notes`, `payment_frequency`, `price_per_student`, `primary_color`, `receipt_footer_text`, `report_footer_text`, `report_header_text`, `report_template`, `school_motto`, `selected_subjects`, `setup_progress`, `show_attendance_in_report`, `show_conduct_in_report`, `show_position_in_report`, `show_remarks_in_report`, `sms_quota_monthly`, `source_code_license`, `student_count`, `subscription_ends_at`, `uneab_center_number`, `updated_at`, `white_label` |
| `sms_triggers` | `message_template` |
| `students` | `allergies`, `blood_type`, `boarding_status`, `consecutive_absent_days`, `district_origin`, `dropout_date`, `dropout_reason`, `games_house`, `house_id`, `is_class_monitor`, `last_attendance_date`, `medical_conditions`, `nationality`, `nin`, `opening_balance`, `parish`, `passport_photo_url`, `photo_url`, `prefect_role`, `previous_school`, `religion`, `repeating`, `status`, `student_council_role`, `sub_county`, `transfer_from`, `transfer_reason`, `transfer_to`, `uneab_number`, `village` |
| `subjects` | `competency_focus`, `is_thematic`, `uses_aoi` |
| `subscription_payments` | `idempotency_key` |
| `suggestions` | `resolution_notes`, `user_id` |
| `syllabus` | `objectives`, `resources` |
| `syllabus_timeline` | `lessons_planned`, `status`, `teacher_notes`, `week_number` |
| `teacher_timetable` | `period_number` |
| `timetable_constraints` | `constraint_type` |
| `topic_coverage` | `academic_year`, `adaptations_made`, `challenges`, `completion_percentage`, `lessons_completed`, `lessons_planned`, `student_comprehension_rating`, `subject_id`, `teacher_notes`, `term`, `topic_name`, `updated_at`, `week_number` |
| `transport_routes` | `monthly_fee` |
| `users` | `password_reset_required` |

## Tables in production with no declaration in schema.sql

`exchange_rates`, `fee_payment_claims`, `library_issues`, `marketer_leads`, `marketer_outreach`, `marketer_referral_codes`, `otps`, `rate_limit_alerts`, `webhook_events`

## Tables declared in schema.sql that production does not have

`inventory_alerts`, `invoices`, `learning_objectives`, `lesson_plan_templates`, `password_reset_tokens`, `push_subscriptions`, `teaching_resources`, `topic_performance`

## Note

The migrations in `supabase/migrations/` are the real history. This file is a
convenience artefact and is currently unsafe to reason from. Queries and
policies should be written against the live database until it is regenerated.