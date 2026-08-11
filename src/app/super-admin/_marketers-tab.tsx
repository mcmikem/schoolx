"use client";
import { useState, useEffect, useCallback } from "react";
import { logger } from "@/lib/logger";

export const DEFAULT_MARKETER_PASSWORD = "Omutofoundation";

export interface MarketerRow {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  created_at: string;
}

export interface EarningsSummary {
  total: number;
  pending: number;
  paid: number;
  schools_count: number;
}

export function MarketersTab() {
  const [marketers, setMarketers] = useState<MarketerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [contactMethod, setContactMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [earningsMap, setEarningsMap] = useState<Record<string, { data: any[]; summary: EarningsSummary }>>({});
  const [earningForm, setEarningForm] = useState({
    earning_type: "onboarding_bonus",
    amount: "",
    notes: "",
    school_id: "",
  });
  const [schoolsList, setSchoolsList] = useState<{ id: string; name: string }[]>([]);
  const toast = { success: (m: string) => setSuccess(m), error: (m: string) => setError(m) };

  const fetchMarketers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/marketers/");
      const body = await res.json();
      if (body.success) setMarketers(body.data || []);
      else setError(body.error || "Failed to load");
    } catch (err) {
      logger.warn("fetchMarketers failed:", err);
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketers();
  }, [fetchMarketers]);

  useEffect(() => {
    fetch("/api/schools/")
      .then((r) => r.json())
      .then((b) => {
        if (b.success) setSchoolsList((b.data || []).map((s: any) => ({ id: s.id, name: s.name })));
      })
      .catch((err) => logger.warn("schools fetch failed:", err));
  }, []);

  useEffect(() => {
    fetch("/api/marketers/config/")
      .then((r) => r.json())
      .then((b) => {
        const configured = b.data?.emailConfigured === true;
        setEmailConfigured(configured);
        if (!configured) setContactMethod("phone");
      })
      .catch((err) => {
        logger.warn("marketers config fetch failed:", err);
        setContactMethod("phone");
      });
  }, []);

  const createMarketer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const payload: Record<string, string | undefined> = { full_name: fullName.trim() || undefined };
    if (contactMethod === "email") {
      if (!email.trim()) {
        setError("Email is required");
        return;
      }
      payload.email = email.trim().toLowerCase();
    } else {
      if (!phone.trim()) {
        setError("Phone number is required");
        return;
      }
      payload.phone = phone.trim();
    }
    setCreating(true);
    try {
      const res = await fetch("/api/marketers/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (body.success) {
        toast.success(body.message || "Marketer created");
        setEmail("");
        setPhone("");
        setFullName("");
        fetchMarketers();
      } else {
        setError(body.error || "Failed to create");
      }
    } catch (err) {
      logger.warn("createMarketer failed:", err);
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setCreating(false);
    }
  };

  const toggleExpand = async (marketerId: string) => {
    if (expandedId === marketerId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(marketerId);
    if (earningsMap[marketerId]) return;
    try {
      const res = await fetch(`/api/marketers/earnings/?marketer_id=${marketerId}`);
      const body = await res.json();
      if (body.success) {
        const list = body.data || [];
        const total = list.reduce((s: number, e: any) => s + Number(e.amount), 0);
        const pending = list
          .filter((e: any) => e.status === "pending" || e.status === "approved")
          .reduce((s: number, e: any) => s + Number(e.amount), 0);
        const paid = list
          .filter((e: any) => e.status === "paid")
          .reduce((s: number, e: any) => s + Number(e.amount), 0);
        const schools = [...new Set(list.filter((e: any) => e.school_id).map((e: any) => e.school_id))].length;
        setEarningsMap((m) => ({
          ...m,
          [marketerId]: { data: list, summary: { total, pending, paid, schools_count: schools } },
        }));
      }
    } catch (err) {
      logger.warn("toggleExpand earnings fetch failed:", err);
    }
  };

  const addEarning = async (marketerId: string) => {
    if (!earningForm.amount) return;
    try {
      const res = await fetch("/api/marketers/earnings/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketer_id: marketerId,
          earning_type: earningForm.earning_type,
          amount: Number(earningForm.amount),
          school_id: earningForm.school_id || null,
          notes: earningForm.notes || null,
        }),
      });
      const body = await res.json();
      if (body.success) {
        toast.success("Earning added");
        setEarningForm({ earning_type: "onboarding_bonus", amount: "", notes: "", school_id: "" });
        toggleExpand(marketerId);
      } else {
        setError(body.error || "Failed to add earning");
      }
    } catch (err) {
      logger.warn("addEarning failed:", err);
      setError(err instanceof Error ? err.message : "Network error");
    }
  };

  const totalEarnings = marketers.reduce((sum, m) => {
    const e = earningsMap[m.id]?.summary;
    return sum + (e?.total || 0);
  }, 0);
  const totalPending = marketers.reduce((sum, m) => {
    const e = earningsMap[m.id]?.summary;
    return sum + (e?.pending || 0);
  }, 0);
  const avgPerMarketer = marketers.length ? Math.round(totalEarnings / marketers.length) : 0;

  return (
    <div className="space-y-5">
      {/* Performance summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-[11px] font-medium text-[var(--t3)]">Total Marketers</div>
          <div className="text-[22px] font-bold text-[var(--t1)] mt-1">{marketers.length}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-[11px] font-medium text-[var(--t3)]">Total Earnings (All)</div>
          <div className="text-[22px] font-bold text-[var(--t1)] mt-1">UGX {totalEarnings.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-[11px] font-medium text-[var(--t3)]">Pending Payouts</div>
          <div className="text-[22px] font-bold text-amber-600 mt-1">UGX {totalPending.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-[11px] font-medium text-[var(--t3)]">Avg Earnings / Marketer</div>
          <div className="text-[22px] font-bold text-[var(--t1)] mt-1">UGX {avgPerMarketer.toLocaleString()}</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-['Sora'] text-[15px] font-bold text-[var(--t1)]">Field Marketers</h2>
          <p className="text-[12px] text-[var(--t3)] mt-0.5">Manage marketing team accounts and commissions.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="font-['Sora'] text-[13px] font-bold text-[var(--t1)] mb-3">Add Marketer</h3>
        {emailConfigured && (
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => {
                setContactMethod("email");
                setPhone("");
              }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                contactMethod === "email"
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--bg)] text-[var(--t3)] border border-[var(--border)]"
              }`}
            >
              Via Email
            </button>
            <button
              type="button"
              onClick={() => {
                setContactMethod("phone");
                setEmail("");
              }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                contactMethod === "phone"
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--bg)] text-[var(--t3)] border border-[var(--border)]"
              }`}
            >
              Via Phone
            </button>
          </div>
        )}
        <form onSubmit={createMarketer} className="flex items-end gap-3">
          {contactMethod === "email" ? (
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="marketer@example.com"
                required={contactMethod === "email"}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t1)] placeholder:text-[var(--t4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              />
            </div>
          ) : (
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">Phone *</label>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0542414745"
                required={contactMethod === "phone"}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t1)] placeholder:text-[var(--t4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              />
            </div>
          )}
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-[var(--t3)] mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Marketer"
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--t1)] placeholder:text-[var(--t4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-[12px] font-bold hover:opacity-90 transition-opacity disabled:opacity-60 whitespace-nowrap"
          >
            {creating ? "Creating\u2026" : "Create Marketer"}
          </button>
        </form>
        {error && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
            <span className="text-red-500 shrink-0 mt-0.5">!</span>
            <p className="text-[13px] text-red-700 font-medium">{error}</p>
          </div>
        )}
        {success && (
          <div className="mt-3 p-3 rounded-xl bg-green-50 border border-green-200">
            <p className="text-[13px] text-green-700 font-medium">{success}</p>
          </div>
        )}
        {contactMethod === "phone" && (
          <p className="mt-2 text-[11px] text-[var(--t4)]">
            Default password: <code className="font-bold text-[var(--t2)]">{DEFAULT_MARKETER_PASSWORD}</code>
          </p>
        )}
        {contactMethod === "email" && emailConfigured && (
          <p className="mt-2 text-[11px] text-[var(--t4)]">Login link will be sent to the marketer's email.</p>
        )}
        {!emailConfigured && (
          <p className="mt-2 text-[11px] text-amber-600">
            Email not configured. Only phone-based onboarding is available.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h3 className="font-['Sora'] text-[13px] font-bold text-[var(--t1)]">Marketers ({marketers.length})</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
          </div>
        ) : marketers.length === 0 ? (
          <p className="text-center py-8 text-[12px] text-[var(--t4)]">No marketers yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Name</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Email</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Total Earned</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Pending</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Status</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--t3)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {marketers.map((m) => {
                  const em = earningsMap[m.id];
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors cursor-pointer"
                      onClick={() => toggleExpand(m.id)}
                    >
                      <td className="px-4 py-2.5 font-semibold text-[var(--t1)]">{m.full_name || "—"}</td>
                      <td className="px-4 py-2.5 text-[var(--t2)]">{m.email || "—"}</td>
                      <td className="px-4 py-2.5 font-semibold text-[var(--t1)]">
                        {em ? `UGX ${em.summary.total.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-[#d97706] font-semibold">
                        {em ? `UGX ${em.summary.pending.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${m.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
                        >
                          {m.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[11px] text-[var(--primary)] font-semibold">
                          {expandedId === m.id ? "▲" : "▼"} Details
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {expandedId && earningsMap[expandedId] && (
          <div className="border-t border-[var(--border)] p-4 bg-[var(--bg)] space-y-4">
            <div className="flex gap-4">
              <div className="text-[12px]">
                <span className="font-semibold text-[var(--t1)]">Total:</span> UGX{" "}
                {earningsMap[expandedId].summary.total.toLocaleString()}
              </div>
              <div className="text-[12px]">
                <span className="font-semibold text-[#d97706]">Pending:</span> UGX{" "}
                {earningsMap[expandedId].summary.pending.toLocaleString()}
              </div>
              <div className="text-[12px]">
                <span className="font-semibold text-[#0d9488]">Paid:</span> UGX{" "}
                {earningsMap[expandedId].summary.paid.toLocaleString()}
              </div>
              <div className="text-[12px]">
                <span className="font-semibold text-[var(--t1)]">Schools:</span>{" "}
                {earningsMap[expandedId].summary.schools_count}
              </div>
            </div>
            <div className="flex items-end gap-2 border-t border-[var(--border)] pt-3">
              <select
                value={earningForm.earning_type}
                onChange={(e) => setEarningForm((f) => ({ ...f, earning_type: e.target.value }))}
                className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[11px]"
              >
                <option value="onboarding_bonus">Onboarding Bonus</option>
                <option value="subscription_commission">Subscription</option>
                <option value="performance_bonus">Performance Bonus</option>
                <option value="adjustment">Adjustment</option>
              </select>
              <input
                type="number"
                inputMode="numeric"
                value={earningForm.amount}
                onChange={(e) => setEarningForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="Amount"
                className="w-24 px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[11px]"
              />
              <select
                value={earningForm.school_id}
                onChange={(e) => setEarningForm((f) => ({ ...f, school_id: e.target.value }))}
                className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[11px] max-w-[160px]"
              >
                <option value="">No school</option>
                {schoolsList.slice(0, 50).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={earningForm.notes}
                onChange={(e) => setEarningForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Notes"
                className="w-32 px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[11px]"
              />
              <button
                onClick={() => addEarning(expandedId)}
                className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-[11px] font-bold hover:opacity-90"
              >
                Add
              </button>
            </div>
            <div className="overflow-x-auto">
              {earningsMap[expandedId].data.length === 0 ? (
                <p className="text-[11px] text-[var(--t4)] py-2">No earnings recorded</p>
              ) : (
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left px-3 py-1.5 font-semibold text-[var(--t3)]">Type</th>
                      <th className="text-left px-3 py-1.5 font-semibold text-[var(--t3)]">Amount</th>
                      <th className="text-left px-3 py-1.5 font-semibold text-[var(--t3)]">Status</th>
                      <th className="text-left px-3 py-1.5 font-semibold text-[var(--t3)]">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earningsMap[expandedId].data.map((e: any) => (
                      <tr key={e.id} className="border-b border-[var(--border)]">
                        <td className="px-3 py-1.5 text-[var(--t1)]">{e.earning_type.replace(/_/g, " ")}</td>
                        <td className="px-3 py-1.5 font-semibold text-[var(--t1)]">
                          UGX {Number(e.amount).toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${e.status === "paid" ? "bg-green-100 text-green-700" : e.status === "pending" ? "bg-yellow-100 text-yellow-700" : e.status === "approved" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-600"}`}
                          >
                            {e.status}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-[var(--t3)]">
                          {new Date(e.created_at).toLocaleDateString("en-UG", { day: "numeric", month: "short" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
