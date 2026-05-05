-- Widen the event_type check to include all values used by the application
ALTER TABLE public.sms_triggers DROP CONSTRAINT IF EXISTS sms_triggers_event_type_check;
ALTER TABLE public.sms_triggers
  ADD CONSTRAINT sms_triggers_event_type_check
  CHECK (event_type IN (
    'fee_overdue',
    'student_absent',
    'staff_absent',
    'exam_results',
    'absentee_alert',
    'payment_confirmation',
    'report_card_ready'
  ));
