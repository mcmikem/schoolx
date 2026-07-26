-- Marketer Platform Feature Tables
-- Adds: leads management, outreach logs, referral codes

-- 1. Marketer Leads — track school prospects
CREATE TABLE IF NOT EXISTS public.marketer_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marketer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    school_name TEXT NOT NULL,
    contact_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    district TEXT,
    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'contacted', 'interested', 'not_interested', 'converted', 'lost')),
    notes TEXT,
    next_follow_up TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketer_leads_marketer ON public.marketer_leads (marketer_id);
CREATE INDEX IF NOT EXISTS idx_marketer_leads_status ON public.marketer_leads (status);
CREATE INDEX IF NOT EXISTS idx_marketer_leads_created ON public.marketer_leads (created_at DESC);

-- 2. Marketer Outreach — communication history
CREATE TABLE IF NOT EXISTS public.marketer_outreach (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marketer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.marketer_leads(id) ON DELETE SET NULL,
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('email', 'sms', 'call', 'whatsapp', 'meeting')),
    recipient_name TEXT,
    recipient_contact TEXT,
    subject TEXT,
    content TEXT,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'scheduled')),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketer_outreach_marketer ON public.marketer_outreach (marketer_id);
CREATE INDEX IF NOT EXISTS idx_marketer_outreach_lead ON public.marketer_outreach (lead_id);
CREATE INDEX IF NOT EXISTS idx_marketer_outreach_sent ON public.marketer_outreach (sent_at DESC);

-- 3. Marketer Referral Codes — unique tracking links
CREATE TABLE IF NOT EXISTS public.marketer_referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marketer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    label TEXT,
    clicks INTEGER NOT NULL DEFAULT 0,
    conversions INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketer_referral_codes_marketer ON public.marketer_referral_codes (marketer_id);
CREATE INDEX IF NOT EXISTS idx_marketer_referral_codes_code ON public.marketer_referral_codes (code);

-- 4. Add onboarding_notes to schools (optional marketer notes for schools they onboard)
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS onboarding_notes TEXT;

-- 5. RLS: marketers can CRUD their own leads, outreach, referrals
ALTER TABLE public.marketer_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketer_outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketer_referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY marketer_leads_self ON public.marketer_leads
    FOR ALL USING (
        marketer_id IN (
            SELECT id FROM public.users WHERE auth_id = auth.uid() AND role = 'marketer'
        )
    );

CREATE POLICY marketer_outreach_self ON public.marketer_outreach
    FOR ALL USING (
        marketer_id IN (
            SELECT id FROM public.users WHERE auth_id = auth.uid() AND role = 'marketer'
        )
    );

CREATE POLICY marketer_referral_codes_self ON public.marketer_referral_codes
    FOR ALL USING (
        marketer_id IN (
            SELECT id FROM public.users WHERE auth_id = auth.uid() AND role = 'marketer'
        )
    );

-- Super admin can see everything
CREATE POLICY marketer_leads_admin ON public.marketer_leads
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'super_admin')
    );

CREATE POLICY marketer_outreach_admin ON public.marketer_outreach
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'super_admin')
    );

CREATE POLICY marketer_referral_codes_admin ON public.marketer_referral_codes
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'super_admin')
    );
