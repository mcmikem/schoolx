-- Migration: Normalize parent phone numbers to 13-digit format (e.g., 256XXXXXXXXX)
-- Applies to students and related tables storing parent_phone and parent_phone2.

-- Helper function to normalize phone numbers
CREATE OR REPLACE FUNCTION public.normalize_uganda_phone(p_phone TEXT) RETURNS TEXT AS $$
DECLARE
    cleaned TEXT := regexp_replace(p_phone, '[^0-9]', '', 'g');
BEGIN
    IF cleaned LIKE '256%' AND length(cleaned) = 12 THEN
        RETURN cleaned;
    ELSIF length(cleaned) = 9 THEN
        -- Assume local Ugandan format without country code
        RETURN '256' || cleaned;
    ELSIF length(cleaned) = 10 AND left(cleaned, 1) = '0' THEN
        RETURN '256' || right(cleaned, 9);
    ELSE
        -- Return original if cannot normalize
        RETURN p_phone;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Update students table
UPDATE public.students
SET parent_phone = public.normalize_uganda_phone(parent_phone),
    parent_phone2 = CASE WHEN parent_phone2 IS NOT NULL THEN public.normalize_uganda_phone(parent_phone2) ELSE NULL END;

-- Update any other tables that store parent_phone (example: payments, notifications, etc.)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='payments' AND table_schema='public') THEN
        EXECUTE 'UPDATE public.payments SET parent_phone = public.normalize_uganda_phone(parent_phone) WHERE parent_phone IS NOT NULL';
    END IF;
END $$;

-- sms_notifications table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sms_notifications' AND column_name='parent_phone') THEN
        EXECUTE 'UPDATE public.sms_notifications SET parent_phone = public.normalize_uganda_phone(parent_phone) WHERE parent_phone IS NOT NULL';
    END IF;
END $$;

-- Clean up: drop helper function (optional, keep for future use)
-- DROP FUNCTION public.normalize_uganda_phone(TEXT);
