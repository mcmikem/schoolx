-- Minimal auditable evidence that a school assessed learner age and recorded
-- the guardian consent or statutory exception relied on for child data.
-- This does not itself establish that the recorded legal basis is valid.
CREATE TABLE IF NOT EXISTS public.student_privacy_evidence (
  student_id UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  age_assessment TEXT NOT NULL CHECK (age_assessment IN ('verified', 'unknown')),
  age_source TEXT CHECK (age_source IN ('birth_record', 'school_record', 'guardian_statement', 'other')),
  age_assessed_at TIMESTAMPTZ,
  processing_basis TEXT NOT NULL CHECK (
    processing_basis IN ('guardian_consent', 'legal_obligation', 'research_statistical', 'pending')
  ),
  notice_version TEXT NOT NULL CHECK (char_length(notice_version) BETWEEN 1 AND 80),
  guardian_name TEXT,
  guardian_relationship TEXT,
  guardian_contact TEXT,
  consent_obtained_at TIMESTAMPTZ,
  evidence_method TEXT CHECK (evidence_method IN ('signed_form', 'digital_record', 'in_person_record', 'other')),
  evidence_reference TEXT CHECK (char_length(evidence_reference) <= 500),
  basis_justification TEXT CHECK (char_length(basis_justification) <= 2000),
  recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_privacy_age_source_required CHECK (
    age_assessment <> 'verified' OR (age_source IS NOT NULL AND age_assessed_at IS NOT NULL)
  ),
  CONSTRAINT student_privacy_consent_evidence_required CHECK (
    processing_basis <> 'guardian_consent' OR (
      guardian_name IS NOT NULL AND guardian_relationship IS NOT NULL
      AND consent_obtained_at IS NOT NULL AND evidence_method IS NOT NULL
    )
  ),
  CONSTRAINT student_privacy_exception_justification_required CHECK (
    processing_basis NOT IN ('legal_obligation', 'research_statistical')
    OR basis_justification IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_student_privacy_evidence_school
  ON public.student_privacy_evidence (school_id, updated_at DESC);

ALTER TABLE public.student_privacy_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_privacy_evidence FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_privacy_evidence TO service_role;

CREATE OR REPLACE FUNCTION public.validate_student_privacy_evidence_school()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  linked_school UUID;
BEGIN
  SELECT school_id INTO linked_school FROM public.students WHERE id = NEW.student_id;
  IF linked_school IS NULL OR linked_school <> NEW.school_id THEN
    RAISE EXCEPTION 'Student privacy evidence must match the learner school';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_student_privacy_evidence_school ON public.student_privacy_evidence;
CREATE TRIGGER trg_validate_student_privacy_evidence_school
BEFORE INSERT OR UPDATE OF student_id, school_id ON public.student_privacy_evidence
FOR EACH ROW EXECUTE FUNCTION public.validate_student_privacy_evidence_school();
