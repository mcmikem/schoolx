"use client";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { isSupabaseConfigured } from "@/lib/supabase";
import { adminAction } from "./_shared";
import type { SubscriptionPlan, FeatureStage } from "./_shared";

export function RegisterSchoolForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    school_code: "",
    district: "",
    subcounty: "",
    parish: "",
    village: "",
    school_type: "primary" as "primary" | "secondary" | "combined",
    ownership: "private" as "private" | "government" | "government_aided",
    phone: "",
    email: "",
    primary_color: "#001F3F",
    subscription_plan: "starter" as SubscriptionPlan,
    feature_stage: "full" as FeatureStage,
    trial_days: "30",
    admin_name: "",
    admin_phone: "",
    admin_password: "",
    digitization_fee: "0",
  });

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const requireLiveSupabase = () => {
    if (isSupabaseConfigured) return true;
    toast.error("Connect Supabase to create schools.");
    return false;
  };

  const digitizationFeeAmt = Number(form.digitization_fee) || 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.district.trim() || !form.school_code.trim()) {
      toast.error("Name, code, and district are required");
      return;
    }
    if (!form.admin_name.trim() || !form.admin_phone.trim() || !form.admin_password) {
      toast.error("Admin name, phone, and password are required");
      return;
    }
    if (form.admin_password.length < 8) {
      toast.error("Admin password must be at least 8 characters");
      return;
    }
    if (digitizationFeeAmt > 0 && (digitizationFeeAmt < 10000 || digitizationFeeAmt > 50000)) {
      toast.error("Digitization fee must be between 10,000 and 50,000 UGX");
      return;
    }
    if (!requireLiveSupabase()) return;
    setSaving(true);
    try {
      await adminAction("create_school", {
        name: form.name.trim(),
        school_code: form.school_code.trim().toUpperCase(),
        district: form.district.trim(),
        subcounty: form.subcounty.trim() || null,
        parish: form.parish.trim() || null,
        village: form.village.trim() || null,
        school_type: form.school_type,
        ownership: form.ownership,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        primary_color: form.primary_color,
        subscription_plan: form.subscription_plan,
        feature_stage: form.feature_stage,
        trial_days: Number(form.trial_days) || 30,
        admin_name: form.admin_name.trim(),
        admin_phone: form.admin_phone.trim(),
        admin_password: form.admin_password,
        digitization_fee: digitizationFeeAmt || null,
      });
      toast.success(`School "${form.name}" registered. Admin can sign in with ${form.admin_phone}`);
      onDone();
    } catch (e: any) {
      toast.error(e?.message || "Failed to register school");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4">
      <h3 className="font-['Sora'] text-[13px] font-bold text-[var(--t1)]">School Information</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: "School Name", name: "name", required: true, placeholder: "e.g. St. Mary's Primary" },
          { label: "School Code", name: "school_code", required: true, placeholder: "e.g. SMC001" },
          { label: "District", name: "district", required: true, placeholder: "e.g. Kampala" },
          { label: "Subcounty", name: "subcounty", placeholder: "e.g. Central" },
          { label: "Parish", name: "parish", placeholder: "e.g. Parish Name" },
          { label: "Village", name: "village", placeholder: "e.g. Village Name" },
          { label: "Phone", name: "phone", tp: "tel", placeholder: "+256 700 000 000" },
          { label: "Email", name: "email", tp: "email", placeholder: "admin@school.ug" },
        ].map((f) => (
          <div key={f.name}>
            <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">
              {f.label}
              {f.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <input
              type={(f as any).tp || "text"}
              value={(form as any)[f.name]}
              onChange={(e) => set(f.name, e.target.value)}
              placeholder={f.placeholder}
              required={f.required}
              className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)] transition-colors"
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">
            School Type <span className="text-red-500">*</span>
          </label>
          <select
            value={form.school_type}
            onChange={(e) => set("school_type", e.target.value)}
            className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)]"
          >
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
            <option value="combined">Combined</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">
            Ownership <span className="text-red-500">*</span>
          </label>
          <select
            value={form.ownership}
            onChange={(e) => set("ownership", e.target.value)}
            className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)]"
          >
            <option value="private">Private</option>
            <option value="government">Government</option>
            <option value="government_aided">Government Aided</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">
            Subscription Plan
          </label>
          <select
            value={form.subscription_plan}
            onChange={(e) => set("subscription_plan", e.target.value)}
            className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)]"
          >
            <option value="starter">Starter \u2014 UGX 2,000/student/term</option>
            <option value="growth">Growth \u2014 UGX 3,500/student/term</option>
            <option value="enterprise">Enterprise \u2014 UGX 5,000/student/term</option>
            <option value="lifetime">Lifetime License</option>
            <option value="free_trial">Free Trial</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">
            Feature Access
          </label>
          <select
            value={form.feature_stage}
            onChange={(e) => set("feature_stage", e.target.value)}
            className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)]"
          >
            <option value="core">Core Only</option>
            <option value="academic">Academic</option>
            <option value="finance">Finance</option>
            <option value="full">Full Access</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">
            Trial Duration (days)
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            value={form.trial_days}
            onChange={(e) => set("trial_days", e.target.value)}
            className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)]"
          />
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">
          School Brand Colour
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={form.primary_color}
            onChange={(e) => set("primary_color", e.target.value)}
            className="w-10 h-10 rounded-lg border border-[var(--border)] cursor-pointer"
          />
          <span className="text-[12px] text-[var(--t3)] font-mono">{form.primary_color}</span>
        </div>
      </div>
      <hr className="border-[var(--border)]" />
      <h3 className="font-['Sora'] text-[13px] font-bold text-[var(--t1)]">Admin Account</h3>
      <p className="text-[11px] text-[var(--t3)] -mt-2">The school admin will use these credentials to sign in.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">
            Admin Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.admin_name}
            onChange={(e) => set("admin_name", e.target.value)}
            placeholder="e.g. John Doe"
            required
            className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)] transition-colors"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">
            Admin Phone <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={form.admin_phone}
            onChange={(e) => set("admin_phone", e.target.value)}
            placeholder="0700000000"
            required
            className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)] transition-colors"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">
            Password <span className="text-red-500">*</span>
            <span className="font-normal normal-case text-[var(--t4)] ml-1">(min 8 chars, 1 uppercase, 1 number)</span>
          </label>
          <input
            type="password"
            value={form.admin_password}
            onChange={(e) => set("admin_password", e.target.value)}
            placeholder="Enter admin password"
            required
            className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)] transition-colors"
          />
        </div>
      </div>
      <hr className="border-[var(--border)]" />
      <h3 className="font-['Sora'] text-[13px] font-bold text-[var(--t1)]">Digitization Service (Optional)</h3>
      <p className="text-[11px] text-[var(--t3)] -mt-2">
        Offer to digitize the school's student data for an additional fee (UGX 10,000 \u2013 50,000).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-bold text-[var(--t2)] uppercase tracking-wide mb-1.5">
            Digitization Fee (UGX)
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={50000}
            step={5000}
            value={form.digitization_fee}
            onChange={(e) => set("digitization_fee", e.target.value)}
            placeholder="0 = No digitization"
            className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--primary)] transition-colors"
          />
        </div>
        {digitizationFeeAmt > 0 && (
          <div className="flex items-center">
            <span className="text-[12px] text-emerald-600 font-semibold">
              + UGX {digitizationFeeAmt.toLocaleString()} digitization fee
            </span>
          </div>
        )}
      </div>
      <div className="pt-2">
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-[var(--primary)] text-white font-bold text-[13px] py-3 hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {saving ? "Registering school\u2026" : "Register School"}
        </button>
      </div>
    </form>
  );
}
