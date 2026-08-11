"use client";
import { useState } from "react";
import Image from "next/image";
import MaterialIcon from "@/components/MaterialIcon";
import { useToast } from "@/components/Toast";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Toggle, ConfirmDialog } from "./_atoms";
import {
  adminAction,
  fmtDate,
  PLAN_COLORS,
  PLAN_LABELS,
  PLAN_PRICES,
  STATUS_STYLES,
  FEATURE_STAGE_LABELS,
} from "./_shared";
import type { School, FeatureStage, SubscriptionPlan, SubscriptionStatus } from "./_shared";

export function SchoolDetailSheet({
  school,
  onClose,
  onUpdated,
  onDeleted,
}: {
  school: School;
  onClose: () => void;
  onUpdated: (s: School) => void;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();

  const [name, setName] = useState(school.name);
  const [district, setDistrict] = useState(school.district);
  const [phone, setPhone] = useState(school.phone || "");
  const [email, setEmail] = useState(school.email || "");
  const [color, setColor] = useState(school.primary_color || "#001F3F");
  const [plan, setPlan] = useState(school.subscription_plan);
  const [status, setStatus] = useState(school.subscription_status);
  const [stage, setStage] = useState<FeatureStage>(school.feature_stage || "full");
  const [trialDays, setTrialDays] = useState(14);
  const [isTester, setIsTester] = useState(school.is_tester ?? false);
  const [saving, setSaving] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Customization
  const [address, setAddress] = useState(school.address || "");
  const [motto, setMotto] = useState(school.motto || "");
  const [principalName, setPrincipalName] = useState(school.principal_name || "");
  const [reportHeader, setReportHeader] = useState(school.report_header || "");
  const [reportFooter, setReportFooter] = useState(school.report_footer || "");
  const [idCardStyle, setIdCardStyle] = useState(school.id_card_style || "standard");
  const [activeSection, setActiveSection] = useState<"details" | "subscription" | "customize">("details");

  const requireLiveSupabase = () => {
    if (isSupabaseConfigured) return true;
    toast.error("Connect Supabase to manage school records.");
    return false;
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("School name is required");
      return;
    }
    if (!requireLiveSupabase()) return;
    setSaving(true);
    try {
      await adminAction("update_school", {
        id: school.id,
        fields: {
          name: name.trim(),
          district: district.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          primary_color: color,
          subscription_plan: plan,
          subscription_status: status,
          feature_stage: stage,
          is_tester: isTester,
          address: address.trim() || null,
          motto: motto.trim() || null,
          principal_name: principalName.trim() || null,
          report_header: reportHeader.trim() || null,
          report_footer: reportFooter.trim() || null,
          id_card_style: idCardStyle,
        },
      });
      onUpdated({
        ...school,
        name: name.trim(),
        district: district.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        primary_color: color,
        subscription_plan: plan,
        subscription_status: status,
        feature_stage: stage,
        is_tester: isTester,
        address: address.trim() || undefined,
        motto: motto.trim() || undefined,
        principal_name: principalName.trim() || undefined,
        report_header: reportHeader.trim() || undefined,
        report_footer: reportFooter.trim() || undefined,
        id_card_style: idCardStyle,
      });
      toast.success("School updated");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const extendTrial = async () => {
    if (!requireLiveSupabase()) return;
    setSaving(true);
    try {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + trialDays);
      await adminAction("update_school", {
        id: school.id,
        fields: {
          subscription_status: "trial",
          trial_ends_at: newDate.toISOString(),
        },
      });
      onUpdated({
        ...school,
        subscription_status: "trial",
        trial_ends_at: newDate.toISOString(),
      });
      toast.success(`Trial extended by ${trialDays} days`);
      setStatus("trial");
    } catch (e: any) {
      toast.error(e?.message || "Failed to extend trial");
    } finally {
      setSaving(false);
    }
  };

  const activate = async () => {
    if (!requireLiveSupabase()) return;
    setSaving(true);
    try {
      await adminAction("update_school", {
        id: school.id,
        fields: { subscription_status: "active" },
      });
      onUpdated({ ...school, subscription_status: "active" });
      setStatus("active");
      toast.success("School activated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to activate");
    } finally {
      setSaving(false);
    }
  };

  const doSuspend = async () => {
    if (!requireLiveSupabase()) return;
    setSaving(true);
    try {
      await adminAction("update_school", {
        id: school.id,
        fields: { subscription_status: "suspended" },
      });
      onDeleted(school.id);
      toast.success(`${school.name} suspended`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setSaving(false);
      setShowSuspendConfirm(false);
    }
  };

  const doDelete = async () => {
    if (!requireLiveSupabase()) return;
    setSaving(true);
    try {
      await adminAction("delete_school", { id: school.id });
      onDeleted(school.id);
      toast.success(`${school.name} permanently deleted`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  const ic =
    "w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-[12px] text-[var(--t1)] outline-none focus:border-[var(--primary)] transition-colors";
  const sectionBtn = (id: typeof activeSection, label: string) => (
    <button
      type="button"
      onClick={() => setActiveSection(id)}
      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${activeSection === id ? "bg-[var(--primary)] text-white" : "text-[var(--t2)] hover:bg-[var(--bg)]"}`}
    >
      {label}
    </button>
  );

  return (
    <>
      <ConfirmDialog
        open={showSuspendConfirm}
        title={`Suspend "${school.name}"?`}
        body="The school will lose access until reactivated. All data is preserved."
        confirmLabel="Suspend School"
        danger
        loading={saving}
        onConfirm={doSuspend}
        onCancel={() => setShowSuspendConfirm(false)}
      />
      <ConfirmDialog
        open={showDeleteConfirm}
        title={`Permanently delete "${school.name}"?`}
        body="This will delete ALL school data including students, grades, fees, and staff. This CANNOT be undone."
        confirmLabel="Delete Everything"
        danger
        loading={saving}
        onConfirm={doDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <div className="fixed inset-0 z-40 flex items-center justify-end p-4">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--border)] w-full max-w-md h-full max-h-[90vh] overflow-y-auto flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] sticky top-0 bg-[var(--surface)] z-10">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0 overflow-hidden"
              style={{ background: color }}
            >
              {school.logo_url ? (
                <Image src={school.logo_url} alt={school.name} className="w-full h-full object-cover" />
              ) : (
                name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-['Sora'] text-[13px] font-bold text-[var(--t1)] truncate">{name || school.name}</div>
              <div className="text-[10px] text-[var(--t3)]">
                {school.school_code} · {fmtDate(school.created_at)}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[var(--t3)] hover:bg-[var(--bg)] transition-colors"
            >
              <MaterialIcon icon="close" style={{ fontSize: 18 }} />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 px-5 py-3 border-b border-[var(--border)]">
            {sectionBtn("details", "Details")}
            {sectionBtn("subscription", "Subscription")}
            {sectionBtn("customize", "Reports & IDs")}
          </div>

          <div className="flex-1 p-5 space-y-5 overflow-y-auto">
            {/* ── Details section ── */}
            {activeSection === "details" && (
              <>
                <div>
                  <div className="text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-2.5">
                    School Details
                  </div>
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={ic}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="School name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">
                          District
                        </label>
                        <input
                          className={ic}
                          value={district}
                          onChange={(e) => setDistrict(e.target.value)}
                          placeholder="District"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">
                          Brand Colour
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="w-9 h-9 rounded-lg border border-[var(--border)] cursor-pointer flex-shrink-0"
                          />
                          <span className="text-[11px] text-[var(--t3)] font-mono">{color}</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">
                          Phone
                        </label>
                        <input
                          className={ic}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+256 700 000 000"
                          type="tel"
                          inputMode="tel"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">
                          Email
                        </label>
                        <input
                          className={ic}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="admin@school.ug"
                          type="email"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Type", value: school.school_type },
                    { label: "Ownership", value: school.ownership },
                    {
                      label: "Students",
                      value: school.student_count?.toLocaleString() ?? "—",
                    },
                    { label: "Code", value: school.school_code },
                  ].map((row) => (
                    <div key={row.label} className="rounded-xl bg-[var(--bg)] px-3 py-2.5">
                      <div className="text-[10px] text-[var(--t3)] font-semibold uppercase tracking-wide mb-0.5">
                        {row.label}
                      </div>
                      <div className="text-[12px] font-semibold text-[var(--t1)] truncate">{row.value}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Subscription section ── */}
            {activeSection === "subscription" && (
              <>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-2">
                    Subscription Plan
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["starter", "growth", "enterprise", "lifetime", "free_trial"] as SubscriptionPlan[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPlan(p)}
                        className="rounded-xl border-2 px-2 py-2 text-center transition-all"
                        style={{
                          borderColor: plan === p ? PLAN_COLORS[p] : "var(--border)",
                          background: plan === p ? `${PLAN_COLORS[p]}12` : "var(--bg)",
                        }}
                      >
                        <div
                          className="text-[11px] font-bold"
                          style={{
                            color: plan === p ? PLAN_COLORS[p] : "var(--t2)",
                          }}
                        >
                          {PLAN_LABELS[p]}
                        </div>
                        <div className="text-[9px] text-[var(--t3)] mt-0.5">{PLAN_PRICES[p]}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-2">
                    Subscription Status
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["active", "trial", "expired", "suspended", "past_due", "canceled"] as SubscriptionStatus[]).map(
                      (st) => {
                        const sty = STATUS_STYLES[st];
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setStatus(st)}
                            className="rounded-xl border-2 px-2 py-2 text-center text-[11px] font-bold transition-all"
                            style={{
                              borderColor: status === st ? sty.text : "var(--border)",
                              background: status === st ? sty.bg : "var(--bg)",
                              color: status === st ? sty.text : "var(--t3)",
                            }}
                          >
                            {sty.label}
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-2">
                    Feature Access Level
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["core", "academic", "finance", "full"] as FeatureStage[]).map((fs) => (
                      <button
                        key={fs}
                        type="button"
                        onClick={() => setStage(fs)}
                        className="rounded-xl border-2 px-3 py-2 text-[11px] font-bold transition-all text-left"
                        style={{
                          borderColor: stage === fs ? "var(--primary)" : "var(--border)",
                          background: stage === fs ? "var(--primary-soft)" : "var(--bg)",
                          color: stage === fs ? "var(--primary)" : "var(--t3)",
                        }}
                      >
                        {FEATURE_STAGE_LABELS[fs]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-[12px] font-bold text-[#15803d]">Tester School Account</div>
                      <p className="text-[10px] text-[#4ade80] mt-0.5">
                        Bypasses subscription checks. Testers get in-app bug report tools.
                      </p>
                    </div>
                    <Toggle value={isTester} onChange={setIsTester} />
                  </div>
                </div>
                <div className="rounded-xl bg-[#fffbeb] border border-[#fef3c7] p-4">
                  <div className="text-[12px] font-bold text-[#b45309] mb-3">Extend / Activate Trial</div>
                  <div className="flex gap-2 items-center">
                    <select
                      value={trialDays}
                      onChange={(e) => setTrialDays(Number(e.target.value))}
                      className="flex-1 rounded-lg bg-white border border-[#fde68a] px-3 py-2 text-[12px] text-[#92400e]"
                    >
                      <option value={7}>+7 days</option>
                      <option value={14}>+14 days</option>
                      <option value={30}>+30 days</option>
                      <option value={60}>+60 days</option>
                      <option value={90}>+90 days</option>
                    </select>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={extendTrial}
                      className="px-4 py-2 rounded-lg bg-[#f59e0b] text-white text-[12px] font-bold hover:bg-[#d97706] transition-colors disabled:opacity-60"
                    >
                      Extend
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={activate}
                      className="px-4 py-2 rounded-lg bg-[#0d9488] text-white text-[12px] font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
                    >
                      Activate
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
                  <div className="text-[12px] font-bold text-red-700">Danger Zone</div>
                  <p className="text-[11px] text-red-600">
                    Suspending blocks all access. Data is preserved and can be restored.
                  </p>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setShowSuspendConfirm(true)}
                    className="w-full px-4 py-2 rounded-lg bg-red-600 text-white text-[12px] font-bold hover:bg-red-700 transition-colors disabled:opacity-60"
                  >
                    Suspend School
                  </button>
                  <p className="text-[11px] text-red-600 pt-1">
                    Permanent delete removes ALL data — students, fees, grades, staff. Cannot be undone.
                  </p>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full px-4 py-2 rounded-lg bg-red-900 text-white text-[12px] font-bold hover:bg-red-800 transition-colors disabled:opacity-60"
                  >
                    Delete School Permanently
                  </button>
                </div>
              </>
            )}

            {/* ── Customize section ── */}
            {activeSection === "customize" && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-[var(--primary-soft,#e0f2f1)] border border-[var(--primary)]/20">
                  <p className="text-[11px] text-[var(--t2)] leading-relaxed">
                    Customization fields appear on <strong>Report Cards</strong> and <strong>Student ID Cards</strong>{" "}
                    for this school. These override the defaults.
                  </p>
                </div>

                <div>
                  <div className="text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-3">
                    School Identity
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">
                        Physical Address
                      </label>
                      <input
                        className={ic}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="P.O. Box 123, Kampala, Uganda"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">
                        School Motto
                      </label>
                      <input
                        className={ic}
                        value={motto}
                        onChange={(e) => setMotto(e.target.value)}
                        placeholder="e.g. Excellence Through Integrity"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">
                        Head Teacher / Principal Name
                      </label>
                      <input
                        className={ic}
                        value={principalName}
                        onChange={(e) => setPrincipalName(e.target.value)}
                        placeholder="e.g. Mr. John Okello"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-3">
                    Report Card Layout
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">
                        Report Header Text
                        <span className="ml-1 normal-case text-[var(--t4)]">(appears at top of report card)</span>
                      </label>
                      <textarea
                        className={`${ic} resize-none`}
                        rows={3}
                        value={reportHeader}
                        onChange={(e) => setReportHeader(e.target.value)}
                        placeholder="e.g. ST. MARY'S PRIMARY SCHOOL\nP.O. Box 1234, Kampala\nTel: +256 700 000 000"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--t3)] mb-1 font-semibold uppercase tracking-wide">
                        Report Footer Text
                        <span className="ml-1 normal-case text-[var(--t4)]">(appears at bottom of report card)</span>
                      </label>
                      <textarea
                        className={`${ic} resize-none`}
                        rows={2}
                        value={reportFooter}
                        onChange={(e) => setReportFooter(e.target.value)}
                        placeholder="e.g. This report was generated by SkoolMate. Powered by Omuto Foundation."
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-3">
                    ID Card Style
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        value: "standard",
                        label: "Standard",
                        desc: "Classic layout",
                      },
                      {
                        value: "modern",
                        label: "Modern",
                        desc: "Photo-forward",
                      },
                      {
                        value: "minimal",
                        label: "Minimal",
                        desc: "Clean & simple",
                      },
                    ].map((style) => (
                      <button
                        key={style.value}
                        type="button"
                        onClick={() => setIdCardStyle(style.value)}
                        className="rounded-xl border-2 px-3 py-3 text-center transition-all"
                        style={{
                          borderColor: idCardStyle === style.value ? "var(--primary)" : "var(--border)",
                          background: idCardStyle === style.value ? "var(--primary-soft,#e0f2f1)" : "var(--bg)",
                        }}
                      >
                        <div
                          className="text-[12px] font-bold mb-1"
                          style={{
                            color: idCardStyle === style.value ? "var(--primary)" : "var(--t1)",
                          }}
                        >
                          {style.label}
                        </div>
                        <div className="text-[10px]" style={{ color: "var(--t3)" }}>
                          {style.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview strip */}
                <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <div className="px-3 py-2 bg-[var(--bg)] text-[10px] font-bold text-[var(--t3)] uppercase tracking-wide border-b border-[var(--border)]">
                    Preview — Report Card Header
                  </div>
                  <div className="p-4 text-center" style={{ borderTop: `3px solid ${color}` }}>
                    <div
                      className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                      style={{ background: color }}
                    >
                      {school.logo_url ? (
                        <Image src={school.logo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="text-[13px] font-bold text-[var(--t1)] whitespace-pre-line">
                      {reportHeader || name}
                    </div>
                    {motto && <div className="text-[10px] text-[var(--t3)] italic mt-1">"{motto}"</div>}
                    {address && <div className="text-[10px] text-[var(--t4)] mt-0.5">{address}</div>}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="px-5 pb-5 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="w-full rounded-xl bg-[var(--primary)] text-white font-bold text-[13px] py-3 hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save All Changes"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
