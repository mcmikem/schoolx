"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { APP_NAME } from "@/lib/app-name";

export default function PrivacyPage() {
  const { user, school, signOut } = useAuth();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const res = await fetch("/api/privacy/delete/", {
        method: "POST",
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Deletion request failed.");
        return;
      }
      toast.success("Your account and data deletion is being processed. You will be signed out.");
      setTimeout(() => {
        signOut();
      }, 2000);
    } catch {
      toast.error("Deletion request failed. Please try again.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-['Sora'] text-2xl font-bold text-gray-900 dark:text-gray-100">
            Privacy & Data Protection
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Your rights under the Uganda Data Protection and Privacy Act, 2019
          </p>
        </div>

        {/* Privacy Notice */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <MaterialIcon icon="policy" className="text-[var(--navy)]" />
            Privacy Notice
          </h2>
          <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Data Controller</h3>
              <p>
                Your school (&ldquo;{school?.name || "the school"}&rdquo;) is the data controller responsible for your
                personal data. {APP_NAME} acts as a data processor on behalf of the school.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">What We Collect</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Identity: name, phone number, email address</li>
                <li>Education: grades, attendance, class assignments</li>
                <li>Financial: fee balances, payment records</li>
                <li>Health: health records (if entered by the school)</li>
                <li>Access: login times, device information</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Purpose of Processing</h3>
              <p>
                Data is processed to: manage student records, track academic progress, collect fees, communicate with
                parents, comply with MoES/UNEB reporting requirements, and provide the SkoolMate service.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Data Retention</h3>
              <p>
                Student records are retained for the duration of enrollment plus 7 years (per UNEB requirements).
                Parent/guardian contact data is retained while the student is enrolled. You may request deletion at any
                time.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Third-Party Sharing</h3>
              <p>
                Data is shared only with: school administrators, UNEB (for exam registration), MoES (for statutory
                reports), and payment processors (for fee collection). We do not sell personal data.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Data Storage & Security</h3>
              <p>
                Data is stored on encrypted servers with role-based access control. All transmissions use TLS
                encryption. Backups are encrypted and access-logged.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Children&apos;s Data</h3>
              <p>
                Student data is processed under legitimate interest and contractual necessity. Schools must obtain
                informed consent from parents/guardians before entering student data. Students under 18 have additional
                protections under Section 10 of the PDPA.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Your Rights</h3>
              <p>
                Under the PDPA, you have the right to: access your data, correct inaccuracies, withdraw consent, request
                data portability, and request deletion. Use the tools below or contact your school administrator.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Complaints</h3>
              <p>
                You may lodge a complaint with the National Information Technology Authority (NITA-U) or the Office of
                the Data Protection & Privacy Officer, PDPO, Kampala.
              </p>
            </div>
          </div>
        </div>

        {/* Data Export */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
            <MaterialIcon icon="download" className="text-[var(--green)]" />
            Export Your Data
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Download a copy of all your personal data stored in SkoolMate, including profile, academic records, and
            financial history. This is your right under Section 19 of the PDPA.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
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

        {/* Data Deletion */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-900/50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
            <MaterialIcon icon="delete_forever" className="text-red-600 dark:text-red-400" />
            Request Account Deletion
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Permanently delete your account and all associated data.{" "}
            <strong className="text-red-600 dark:text-red-400">This action cannot be undone.</strong> Under PDPA Section
            21, you have the right to request erasure of your personal data.
          </p>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <MaterialIcon icon="warning" className="text-lg" />
              Request Deletion
            </button>
          ) : (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
              <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-3">
                Are you absolutely sure? This will permanently delete your account, all your data, and cannot be
                reversed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleting ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />{" "}
                      Deleting...
                    </>
                  ) : (
                    "Yes, delete everything"
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-8">
          {APP_NAME} &mdash; Compliant with Uganda&apos;s Data Protection & Privacy Act, 2019
        </p>
      </div>
    </div>
  );
}
