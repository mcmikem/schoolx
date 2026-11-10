"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { APP_NAME } from "@/lib/app-name";

type PrivacyRequestSummary = {
  reference_code: string;
  request_type: string;
  status: string;
  created_at: string;
  updated_at: string;
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  access: "Access my data",
  correction: "Correct my data",
  objection: "Object to or restrict processing",
  deletion: "Request deletion where applicable",
  other: "Another privacy concern",
};

export default function PrivacyPage() {
  const { user, school } = useAuth();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [requests, setRequests] = useState<PrivacyRequestSummary[]>([]);
  const [requestType, setRequestType] = useState("access");
  const [requestDetails, setRequestDetails] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch("/api/privacy/requests/", {
        headers: { authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      if (!response.ok) return;
      const body = await response.json();
      setRequests(Array.isArray(body.requests) ? body.requests : []);
    } catch {
      // The page remains usable if request history is temporarily unavailable.
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) void loadRequests();
  }, [loadRequests, user?.id]);

  const handleSubmitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittingRequest(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sign in again to submit a privacy request.");
        return;
      }
      const response = await fetch("/api/privacy/requests/", {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestType, details: requestDetails }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(body.error || "Could not submit your request.");
        return;
      }
      setRequestDetails("");
      toast.success(`Privacy request submitted. Reference: ${body.request.reference_code}`);
      await loadRequests();
    } catch {
      toast.error("Could not submit your request. Please try again.");
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const res = await fetch("/api/privacy/export/", {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        toast.error("Export failed. Please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `skoolmate-data-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data has been downloaded.");
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-['Sora'] text-2xl font-bold text-[var(--t1)] dark:text-[var(--t4)]">
            Privacy & Data Protection
          </h1>
          <p className="text-sm text-[var(--t3)] dark:text-[var(--t3)] mt-1">
            Your rights under the Uganda Data Protection and Privacy Act, 2019
          </p>
        </div>

        {/* Privacy Notice */}
        <div className="bg-[var(--surface)] dark:bg-[var(--surface-container-high)] rounded-xl border border-[var(--border)] dark:border-[var(--border)] p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--t1)] dark:text-[var(--t4)] mb-4 flex items-center gap-2">
            <MaterialIcon icon="policy" className="text-[var(--secondary)]" />
            Privacy Notice
          </h2>
          <div className="space-y-4 text-sm text-[var(--t2)] dark:text-[var(--t4)] leading-relaxed">
            <div>
              <h3 className="font-semibold text-[var(--t1)] dark:text-[var(--t4)] mb-1">Data Controller</h3>
              <p>
                For learner and school records, your school (&ldquo;{school?.name || "the school"}&rdquo;) generally
                decides why and how data is used. {APP_NAME} provides the service and processes those records for the
                school. Omuto may separately handle account, billing, security, and support data. The responsible role
                depends on the purpose of each processing activity.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--t1)] dark:text-[var(--t4)] mb-1">School Agreement</h3>
              <p>
                When a school registers, its authorised representative accepts the School Agreement in our{" "}
                <a href="/terms#school-data-processing" className="underline">
                  Terms of Service
                </a>
                . It describes what Omuto processes for the school, each party&apos;s responsibilities, service
                providers, assistance with requests and incidents, and return or deletion at the end of service. The
                school remains responsible for deciding why learner records are used and for providing required notices
                and obtaining required permissions.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--t1)] dark:text-[var(--t4)] mb-1">What We Collect</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Identity: name, phone number, email address</li>
                <li>Education: grades, attendance, class assignments</li>
                <li>Financial: fee balances, payment records</li>
                <li>Health: health records (if entered by the school)</li>
                <li>Access: login times, device information</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--t1)] dark:text-[var(--t4)] mb-1">Purpose of Processing</h3>
              <p>
                Data is processed to: manage student records, track academic progress, collect fees, communicate with
                parents, comply with MoES/UNEB reporting requirements, and provide the SkoolMate service.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--t1)] dark:text-[var(--t4)] mb-1">Data Retention</h3>
              <p>
                Records are retained for the period needed for the school purpose, applicable legal obligations, and the
                school&apos;s agreement with {APP_NAME}. The school determines the retention period for its records;
                Omuto retains them for service delivery and any agreed transition or backup cycle. To ask about a
                record, contact your school or email{" "}
                <a className="underline" href="mailto:os@omuto.org">
                  os@omuto.org
                </a>
                . A request is reviewed against school recordkeeping duties before action is taken.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--t1)] dark:text-[var(--t4)] mb-1">Third-Party Sharing</h3>
              <p>
                School staff use records according to their access rights. To operate SkoolMate, data may also be
                processed by infrastructure, authentication, communications, monitoring, and payment service providers
                configured for the service. We do not sell personal data. Ask us for the current provider and
                processing-location list before relying on any cross-border transfer statement.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--t1)] dark:text-[var(--t4)] mb-1">Data Storage & Security</h3>
              <p>
                SkoolMate uses account access controls and secure connections. The school agreement requires appropriate
                safeguards and confidentiality obligations. Contact{" "}
                <a className="underline" href="mailto:os@omuto.org">
                  os@omuto.org
                </a>{" "}
                for current security and service-provider information, including processing locations and transfer
                safeguards.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--t1)] dark:text-[var(--t4)] mb-1">Children&apos;s Data</h3>
              <p>
                The Data Protection and Privacy Act has additional protections for children and special categories of
                personal data. Schools must identify a lawful basis for each use and provide any required parent or
                guardian consent. Health, religion, and financial information may need additional safeguards. Contact
                your school about the basis and notices that apply to your child&apos;s records.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--t1)] dark:text-[var(--t4)] mb-1">Your Rights</h3>
              <p>
                Depending on the circumstances, the Act provides rights to access personal data, seek correction of
                inaccurate data, object to or prevent certain processing, and seek deletion in specified cases. These
                rights are subject to lawful exceptions and school recordkeeping obligations. This download is a
                self-scoped account export; it does not include every record held by the school.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--t1)] dark:text-[var(--t4)] mb-1">Complaints</h3>
              <p>
                You may raise a concern with the Personal Data Protection Office (PDPO):{" "}
                <a className="underline" href="https://pdpo.go.ug/" target="_blank" rel="noreferrer">
                  pdpo.go.ug
                </a>{" "}
                or contact your school and our privacy contact at{" "}
                <a className="underline" href="mailto:os@omuto.org">
                  os@omuto.org
                </a>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Data Export */}
        <div className="bg-[var(--surface)] dark:bg-[var(--surface-container-high)] rounded-xl border border-[var(--border)] dark:border-[var(--border)] p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--t1)] dark:text-[var(--t4)] mb-2 flex items-center gap-2">
            <MaterialIcon icon="download" className="text-[var(--green)]" />
            Export Your Data
          </h2>
          <p className="text-sm text-[var(--t3)] dark:text-[var(--t3)] mb-4">
            Download the profile details held for your signed-in account. Student accounts also receive linked learner,
            attendance, grade, and payment records where available. Parent and staff exports do not include
            children&apos;s or school-wide records. Ask your school to review requests for those records.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--secondary)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {exporting ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />{" "}
                Exporting...
              </>
            ) : (
              <>
                <MaterialIcon icon="cloud_download" className="text-lg" /> Download My Data
              </>
            )}
          </button>
        </div>

        {/* Privacy request */}
        <div className="bg-[var(--surface)] dark:bg-[var(--surface-container-high)] rounded-xl border border-red-200 dark:border-red-900/50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
            <MaterialIcon icon="delete_forever" className="text-red-600 dark:text-red-400" />
            Request a Privacy Review
          </h2>
          <p className="text-sm text-[var(--t3)] dark:text-[var(--t3)] mb-4">
            Contact your school to request access, correction, restriction, or deletion where applicable. School records
            may need to be retained for legal or educational purposes, so requests are reviewed before any change. Email
            our privacy contact for help.
          </p>
          <form onSubmit={handleSubmitRequest} className="space-y-3">
            <label className="block text-sm font-medium text-[var(--t2)]">
              What would you like help with?
              <select
                value={requestType}
                onChange={(event) => setRequestType(event.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-[var(--border2)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--t1)]"
              >
                {Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-[var(--t2)]">
              Details (optional)
              <textarea
                value={requestDetails}
                onChange={(event) => setRequestDetails(event.target.value.slice(0, 2000))}
                maxLength={2000}
                rows={3}
                placeholder="Describe the request briefly. Avoid including passwords or sensitive health details."
                className="mt-1.5 block w-full resize-y rounded-xl border border-[var(--border2)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--t1)] placeholder:text-[var(--t4)]"
              />
              <span className="mt-1 block text-right text-xs text-[var(--t4)]">{requestDetails.length}/2000</span>
            </label>
            <button
              type="submit"
              disabled={submittingRequest}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border2)] px-4 py-2.5 text-sm font-semibold text-[var(--secondary)] transition-colors hover:bg-[var(--surface-container-low)] disabled:opacity-50"
            >
              <MaterialIcon icon="send" className="text-lg" />
              {submittingRequest ? "Submitting…" : "Submit privacy request"}
            </button>
          </form>

          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <h3 className="text-sm font-semibold text-[var(--t1)]">Your privacy requests</h3>
            {loadingRequests ? (
              <p className="mt-2 text-sm text-[var(--t3)]">Loading request history…</p>
            ) : requests.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--t3)]">No requests submitted yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-[var(--border)]">
                {requests.map((item) => (
                  <li
                    key={item.reference_code}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                  >
                    <span className="font-medium text-[var(--t1)]">
                      {item.reference_code} · {REQUEST_TYPE_LABELS[item.request_type] || item.request_type}
                    </span>
                    <span className="rounded-full bg-[var(--surface-container-low)] px-2.5 py-1 text-xs capitalize text-[var(--t2)]">
                      {item.status.replace(/_/g, " ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-4 text-xs text-[var(--t3)]">
            Requests about learner or school records are routed for review by the school. You can also contact{" "}
            <a className="underline" href="mailto:os@omuto.org">
              os@omuto.org
            </a>{" "}
            if you cannot access your account.
          </p>
        </div>

        <p className="text-xs text-[var(--t3)] dark:text-[var(--t3)] text-center mt-8">
          {APP_NAME} &mdash; Privacy Notice version 2026-11-09
        </p>
      </div>
    </div>
  );
}
