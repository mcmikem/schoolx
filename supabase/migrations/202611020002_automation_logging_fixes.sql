-- Automation logging + enum mismatches found by auditing every constrained
-- column the app writes against production's CHECK constraints.

-- 1. Automated message logs. Three cron routes (attendance-heartbeat,
--    auto-attendance-followup, auto-installment-reminder) have no sms_triggers
--    row, so they wrote slug strings into the uuid trigger_id FK and phone
--    numbers into the recipient_id FK to users(id). Every insert was rejected,
--    which is why automated_message_logs is empty in production and the 24h
--    cooldown never matched anything. trigger_key carries the route slug; the
--    uuid trigger_id stays reserved for real sms_triggers rows (sms/run).
ALTER TABLE public.automated_message_logs ADD COLUMN IF NOT EXISTS trigger_key TEXT;
COMMENT ON COLUMN public.automated_message_logs.trigger_key IS
  'Route slug for automations that have no sms_triggers row. Used for cooldown matching.';

-- 2. The messages page writes 'bulk' (custom recipient pick) and
--    'staff_and_parents' (notice broadcast to everyone), but production only
--    allows individual/class/all, so both sends were rejected.
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_recipient_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_recipient_type_check
  CHECK (recipient_type = ANY (ARRAY[
    'individual'::text, 'class'::text, 'all'::text, 'bulk'::text, 'staff_and_parents'::text
  ]));

-- 3. Demo-mode sends are logged as status 'demo' by the automation engine.
ALTER TABLE public.sms_logs DROP CONSTRAINT IF EXISTS sms_logs_status_check;
ALTER TABLE public.sms_logs ADD CONSTRAINT sms_logs_status_check
  CHECK (status = ANY (ARRAY['sent'::text, 'failed'::text, 'pending'::text, 'demo'::text]));

-- 4. The demo school's seeded trial payment is issued by the system, not a
--    payment provider.
ALTER TABLE public.subscription_payments DROP CONSTRAINT IF EXISTS subscription_payments_provider_check;
ALTER TABLE public.subscription_payments ADD CONSTRAINT subscription_payments_provider_check
  CHECK (provider = ANY (ARRAY[
    'stripe'::text, 'paypal'::text, 'mtn'::text, 'airtel'::text, 'system'::text
  ]));
