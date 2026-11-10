"use client";

import { useCallback, useEffect, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";

type Evidence = {
  age_assessment: "verified" | "unknown";
  age_source: string | null;
  processing_basis: "guardian_consent" | "legal_obligation" | "research_statistical" | "pending";
  notice_version: string;
  guardian_name: string | null;
  guardian_relationship: string | null;
  guardian_contact: string | null;
  consent_obtained_at: string | null;
  evidence_method: string | null;
  evidence_reference: string | null;
  basis_justification: string | null;
};

const emptyEvidence: Evidence = {
  age_assessment: "unknown",
  age_source: null,
  processing_basis: "pending",
  notice_version: "",
  guardian_name: "",
  guardian_relationship: "",
  guardian_contact: "",
  consent_obtained_at: null,
  evidence_method: null,
  evidence_reference: "",
  basis_justification: "",
};

const inputClass =
  "mt-1 block min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--t1)]";
const labelClass = "block text-xs font-semibold text-[var(--t2)]";

export function StudentPrivacyEvidencePanel({ studentId }: { studentId: string }) {
  const toast = useToast();
  const [evidence, setEvidence] = useState<Evidence>(emptyEvidence);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in again to review this record.");
      const response = await fetch(`/api/students/${encodeURIComponent(studentId)}/privacy-evidence/`, {
        headers: { authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not load privacy evidence.");
      setEvidence({ ...emptyEvidence, ...(body.evidence ?? {}) });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load privacy evidence.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof Evidence>(key: K, value: Evidence[K]) => {
    setEvidence((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in again to save this record.");
      const response = await fetch(`/api/students/${encodeURIComponent(studentId)}/privacy-evidence/`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ageAssessment: evidence.age_assessment,
          ageSource: evidence.age_source,
          processingBasis: evidence.processing_basis,
          noticeVersion: evidence.notice_version,
          guardianName: evidence.guardian_name,
          guardianRelationship: evidence.guardian_relationship,
          guardianContact: evidence.guardian_contact,
          consentObtainedAt: evidence.consent_obtained_at,
          evidenceMethod: evidence.evidence_method,
          evidenceReference: evidence.evidence_reference,
          justification: evidence.basis_justification,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not save privacy evidence.");
      toast.success("Learner privacy evidence saved.");
      setEvidence({ ...emptyEvidence, ...(body.evidence ?? {}) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save privacy evidence.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--t3)]"
        role="status"
      >
        Loading learner privacy record…
      </div>
    );
  if (loadError)
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
        <p>{loadError}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 min-h-10 rounded-lg border border-current px-3 font-semibold"
        >
          Try again
        </button>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--primary)]/20 bg-[var(--primary-50)] p-4 text-sm text-[var(--t2)]">
        <div className="flex items-start gap-3">
          <MaterialIcon icon="privacy_tip" size={20} className="mt-0.5 shrink-0 text-[var(--primary)]" />
          <p>
            Record how the school assessed the learner’s age, which notice was provided, and the consent or statutory
            exception documented by the school. This record does not itself establish that a consent or exception is
            legally sufficient; have the school’s process reviewed by its privacy lead or counsel.
          </p>
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2 sm:p-5">
        <label className={labelClass}>
          Age assessment
          <select
            className={inputClass}
            value={evidence.age_assessment}
            onChange={(event) => set("age_assessment", event.target.value as Evidence["age_assessment"])}
          >
            <option value="unknown">Age not yet verified</option>
            <option value="verified">Age verified</option>
          </select>
        </label>
        {evidence.age_assessment === "verified" && (
          <label className={labelClass}>
            Age evidence source
            <select
              className={inputClass}
              value={evidence.age_source ?? ""}
              onChange={(event) => set("age_source", event.target.value || null)}
            >
              <option value="">Choose source</option>
              <option value="birth_record">Birth record</option>
              <option value="school_record">School record</option>
              <option value="guardian_statement">Guardian statement</option>
              <option value="other">Other verified source</option>
            </select>
          </label>
        )}
        <label className={labelClass}>
          Learner privacy notice version
          <input
            className={inputClass}
            maxLength={80}
            value={evidence.notice_version}
            onChange={(event) => set("notice_version", event.target.value)}
            placeholder="For example: learner-notice-2026-01"
          />
        </label>
        <label className={labelClass}>
          Documented processing basis
          <select
            className={inputClass}
            value={evidence.processing_basis}
            onChange={(event) => set("processing_basis", event.target.value as Evidence["processing_basis"])}
          >
            <option value="pending">Pending review</option>
            <option value="guardian_consent">Prior parent / guardian consent</option>
            <option value="legal_obligation">Necessary to comply with law</option>
            <option value="research_statistical">Research or statistical purpose</option>
          </select>
        </label>

        {evidence.processing_basis === "guardian_consent" && (
          <>
            <label className={labelClass}>
              Parent / guardian name
              <input
                className={inputClass}
                maxLength={160}
                value={evidence.guardian_name ?? ""}
                onChange={(event) => set("guardian_name", event.target.value)}
              />
            </label>
            <label className={labelClass}>
              Relationship to learner
              <input
                className={inputClass}
                maxLength={80}
                value={evidence.guardian_relationship ?? ""}
                onChange={(event) => set("guardian_relationship", event.target.value)}
                placeholder="Parent, guardian, or authorised person"
              />
            </label>
            <label className={labelClass}>
              Guardian contact (optional)
              <input
                className={inputClass}
                maxLength={120}
                value={evidence.guardian_contact ?? ""}
                onChange={(event) => set("guardian_contact", event.target.value)}
              />
            </label>
            <label className={labelClass}>
              Consent obtained on
              <input
                type="date"
                className={inputClass}
                value={evidence.consent_obtained_at?.slice(0, 10) ?? ""}
                onChange={(event) =>
                  set(
                    "consent_obtained_at",
                    event.target.value ? new Date(`${event.target.value}T12:00:00`).toISOString() : null,
                  )
                }
              />
            </label>
            <label className={labelClass}>
              How evidence was recorded
              <select
                className={inputClass}
                value={evidence.evidence_method ?? ""}
                onChange={(event) => set("evidence_method", event.target.value || null)}
              >
                <option value="">Choose method</option>
                <option value="signed_form">Signed paper form</option>
                <option value="digital_record">Digital record</option>
                <option value="in_person_record">In-person record</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className={labelClass}>
              Evidence reference (optional)
              <input
                className={inputClass}
                maxLength={500}
                value={evidence.evidence_reference ?? ""}
                onChange={(event) => set("evidence_reference", event.target.value)}
                placeholder="Register entry, file reference, or secure document ID"
              />
            </label>
          </>
        )}

        {["legal_obligation", "research_statistical"].includes(evidence.processing_basis) && (
          <label className={`${labelClass} sm:col-span-2`}>
            Why does the school consider this exception applies?
            <textarea
              className={`${inputClass} min-h-24 resize-y`}
              maxLength={2000}
              value={evidence.basis_justification ?? ""}
              onChange={(event) => set("basis_justification", event.target.value)}
            />
          </label>
        )}
        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <p className="max-w-2xl text-xs leading-5 text-[var(--t3)]">
            Keep signed forms or other supporting evidence in the school’s approved secure records location. Store only
            a reference here.
          </p>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <MaterialIcon icon="save" size={18} />
            {saving ? "Saving…" : "Save record"}
          </button>
        </div>
      </div>
    </div>
  );
}
