"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { cardClassName } from "@/lib/utils";
import { format } from "date-fns";
import { withTimeout } from "@/lib/hooks/utils";
import { calculateUgandaPayrollTaxes } from "@/lib/operations";
import { useToast } from "@/components/Toast";
import PersonInitials from "@/components/ui/PersonInitials";

const GRADES = [
  "Scale 1 – UGX 400k",
  "Scale 2 – UGX 600k",
  "Scale 3 – UGX 800k",
  "Scale 4 – UGX 1.0M",
  "Scale 5 – UGX 1.4M",
  "Custom",
];
const GRADE_VALUES: Record<string, number> = {
  "Scale 1 – UGX 400k": 400000,
  "Scale 2 – UGX 600k": 600000,
  "Scale 3 – UGX 800k": 800000,
  "Scale 4 – UGX 1.0M": 1000000,
  "Scale 5 – UGX 1.4M": 1400000,
};
const ROLE_TO_GRADE: Record<string, string> = {
  headmaster: "Scale 5 – UGX 1.4M",
  deputy_headmaster: "Scale 4 – UGX 1.0M",
  dean_of_studies: "Scale 3 – UGX 800k",
  teacher: "Scale 2 – UGX 600k",
  admin: "Scale 2 – UGX 600k",
  support: "Scale 1 – UGX 400k",
};

interface PayrollStaff {
  id: string;
  full_name: string;
  role: string;
  bank_account: string | null;
}

interface PayrollHistoryRecord {
  id: string;
  staff_id: string;
  month: string;
  gross_pay: number;
  nssf_deduction: number;
  paye_tax: number;
  other_deductions: number;
  net_pay: number;
  status: string;
  created_at: string;
}

interface ProgressState {
  open: boolean;
  total: number;
  processed: number;
  totalGross: number;
  totalTax: number;
  totalNet: number;
  error?: string;
}

export default function PayrollPage() {
  const { school, user } = useAuth();
  const toast = useToast();
  const [staff, setStaff] = useState<PayrollStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [month] = useState(format(new Date(), "MMMM yyyy"));
  const [payroll, setPayroll] = useState<Record<string, { grade: string; customGross: number; deductions: number }>>(
    {},
  );
  const [history, setHistory] = useState<PayrollHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({
    open: false,
    total: 0,
    processed: 0,
    totalGross: 0,
    totalTax: 0,
    totalNet: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!school?.id) return;
    setLoading(true);
    supabase
      .from("users")
      .select("id, full_name, role, bank_account")
      .eq("school_id", school.id)
      .not("role", "in", '("student","parent")')
      .then(({ data }) => {
        setStaff(data || []);
        const init: Record<string, { grade: string; customGross: number; deductions: number }> = {};
        (data || []).forEach((s: PayrollStaff) => {
          init[s.id] = { grade: ROLE_TO_GRADE[s.role] || GRADES[1], customGross: 0, deductions: 0 };
        });
        setPayroll(init);
        setLoading(false);
      });
    supabase
      .from("payroll_history")
      .select("*")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setHistory(data || []);
        setHistoryLoading(false);
      });
    setHistoryLoading(true);
  }, [school?.id]);

  const handleCalculateAll = () => {
    setPayroll((prev) => {
      const next = { ...prev };
      staff.forEach((s) => {
        const grade = ROLE_TO_GRADE[s.role] || GRADES[1];
        next[s.id] = { ...next[s.id], grade, customGross: 0 };
      });
      return next;
    });
    toast.success("Salary grades auto-assigned by role");
  };

  const calculateStaffPay = (staffId: string) => {
    const config = payroll[staffId] || { grade: GRADES[1], customGross: 0, deductions: 0 };
    const gross = config.grade === "Custom" ? config.customGross : GRADE_VALUES[config.grade] || 0;
    const taxes = calculateUgandaPayrollTaxes(gross);
    const net = taxes.netPay - config.deductions;
    return { gross, ...taxes, net };
  };

  const totals = staff.reduce(
    (acc, s) => {
      const pay = calculateStaffPay(s.id);
      return {
        gross: acc.gross + pay.gross,
        nssf: acc.nssf + pay.nssf,
        paye: acc.paye + pay.paye,
        other: acc.other + (payroll[s.id]?.deductions || 0),
        net: acc.net + pay.net,
      };
    },
    { gross: 0, nssf: 0, paye: 0, other: 0, net: 0 },
  );

  const handleRunPayroll = async () => {
    setConfirmOpen(false);
    setProcessing(true);
    setProgress({ open: true, total: staff.length, processed: 0, totalGross: 0, totalTax: 0, totalNet: 0 });
    let processed = 0;
    let totalGross = 0;
    let totalTax = 0;
    let totalNet = 0;
    try {
      for (const s of staff) {
        const pay = calculateStaffPay(s.id);
        const record = {
          school_id: school?.id,
          staff_id: s.id,
          month,
          gross_pay: pay.gross,
          nssf_deduction: pay.nssf,
          paye_tax: pay.paye,
          other_deductions: payroll[s.id]?.deductions || 0,
          net_pay: pay.net,
          status: "processed",
          processed_by: user?.id,
        };
        const { error } = await withTimeout(
          supabase
            .from("payroll_history")
            .upsert(record, { onConflict: "staff_id, month" })
            .then((r) => r),
          15000,
          { data: null, error: { message: "Payroll save timed out" } } as any,
        );
        if (error) throw error;
        processed++;
        totalGross += pay.gross;
        totalTax += pay.paye + pay.nssf;
        totalNet += pay.net;
        setProgress((p) => ({ ...p, processed, totalGross, totalTax, totalNet }));
      }
      toast.success(`Payroll complete: ${processed} staff processed, UGX ${totalNet.toLocaleString()} net total.`);
      withTimeout(
        supabase
          .from("payroll_history")
          .select("*")
          .eq("school_id", school?.id)
          .order("created_at", { ascending: false })
          .limit(50)
          .then((r) => r),
        15000,
        { data: [], error: null } as any,
      ).then(({ data }) => setHistory(data || []));
    } catch (err: any) {
      setProgress((p) => ({ ...p, error: err.message }));
      toast.error(err.message || "Failed to record payroll");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-end flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Payroll Hub</h1>
            <p className="text-slate-500 font-medium">
              Smart Salary Manager for <span className="font-bold text-slate-700">{month}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCalculateAll}
              disabled={staff.length === 0 || processing}
              className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/20 hover:scale-105 transition-all disabled:opacity-40 disabled:scale-100"
            >
              <MaterialIcon icon="auto_awesome" />
              Calculate All
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={staff.length === 0 || processing}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 hover:scale-105 transition-all disabled:opacity-40 disabled:scale-100"
            >
              {processing ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <MaterialIcon icon="account_balance" />
              )}
              Run Payroll
            </button>
          </div>

          {/* Confirmation dialog */}
          {confirmOpen && (
            <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto shadow-2xl">
                <h3 className="text-lg font-bold text-slate-800 mb-2">Run payroll for {month}?</h3>
                <p className="text-sm text-slate-500 mb-1">
                  {staff.length} staff members &bull; Gross:{" "}
                  <span className="font-semibold text-slate-700">UGX {totals.gross.toLocaleString()}</span> &bull; Net:{" "}
                  <span className="font-semibold text-slate-700">UGX {totals.net.toLocaleString()}</span>
                </p>
                <p className="text-xs text-amber-600 bg-amber-50 rounded-xl p-3 mt-3">
                  This will calculate PAYE tax and create payroll records for all staff. The records will appear in
                  Payroll History.
                </p>
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => setConfirmOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRunPayroll}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition"
                  >
                    Confirm & Run
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Progress modal */}
          {progress.open && (
            <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto shadow-2xl">
                <h3 className="text-lg font-bold text-slate-800 mb-4">
                  {progress.error ? "Payroll Error" : "Processing Payroll..."}
                </h3>
                {progress.error ? (
                  <div className="bg-rose-50 rounded-xl p-4 text-sm text-rose-700 font-medium">{progress.error}</div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="text-sm text-slate-500">
                      {progress.processed} of {progress.total} staff processed
                    </p>
                    <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-sm">
                      <p className="flex justify-between">
                        <span className="text-slate-500">Gross total</span>
                        <span className="font-bold text-slate-800">UGX {progress.totalGross.toLocaleString()}</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-slate-500">Total tax (PAYE+NSSF)</span>
                        <span className="font-bold text-rose-600">UGX {progress.totalTax.toLocaleString()}</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-slate-500">Net total</span>
                        <span className="font-bold text-emerald-600">UGX {progress.totalNet.toLocaleString()}</span>
                      </p>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => setProgress((p) => ({ ...p, open: false }))}
                  className="w-full mt-4 py-2.5 rounded-xl bg-slate-100 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition"
                >
                  {progress.error ? "Dismiss" : "Close"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Staff", value: staff.length, icon: "badge", color: "bg-slate-700", suffix: "" },
            {
              label: "Gross Payroll",
              value: `UGX ${(totals.gross / 1000000).toFixed(1)}M`,
              icon: "payments",
              color: "bg-blue-600",
              suffix: "",
            },
            {
              label: "Total PAYE Tax",
              value: `UGX ${totals.paye.toLocaleString()}`,
              icon: "gavel",
              color: "bg-red-500",
              suffix: "",
            },
            {
              label: "Total Net Pay",
              value: `UGX ${(totals.net / 1000000).toFixed(1)}M`,
              icon: "account_balance_wallet",
              color: "bg-emerald-600",
              suffix: "",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="p-4 bg-white rounded-3xl border border-slate-100 flex flex-col items-center text-center gap-2"
            >
              <div className={`w-10 h-10 rounded-xl ${s.color} text-white flex items-center justify-center shrink-0`}>
                <MaterialIcon icon={s.icon} style={{ fontSize: 20 }} />
              </div>
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
                <p className="text-sm font-black text-slate-800 leading-tight">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Search by staff name..."
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="text-xs text-slate-400 font-medium">
            {staff.filter((s) => !searchQuery || s.full_name?.toLowerCase().includes(searchQuery.toLowerCase())).length}{" "}
            of {staff.length}
          </span>
        </div>

        {/* Payroll Table */}
        <div className={cardClassName + " overflow-hidden border-none shadow-xl shadow-slate-200/50"}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Staff</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                    Gross (UGX)
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                    NSSF
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                    PAYE
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Other Ded.
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                    Net Pay
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Bank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-6 py-4">
                        <div className="h-4 bg-slate-50 rounded-lg animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : staff.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <p className="text-sm font-medium text-[var(--t2)]">No staff members found</p>
                      <p className="text-xs text-[var(--t3)] mt-1">Add staff in the Staff page to manage payroll</p>
                    </td>
                  </tr>
                ) : (
                  staff
                    .filter((s) => !searchQuery || s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((member) => {
                      const config = payroll[member.id] || { grade: GRADES[1], customGross: 0, deductions: 0 };
                      const pay = calculateStaffPay(member.id);

                      return (
                        <tr key={member.id} className="hover:bg-slate-50/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="shrink-0">
                                <PersonInitials name={member.full_name || "Staff"} size={32} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800">{member.full_name}</p>
                                <p className="text-[9px] font-medium text-slate-400">{member.role || "Staff"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <select
                                value={config.grade}
                                onChange={(e) =>
                                  setPayroll((prev) => ({
                                    ...prev,
                                    [member.id]: { ...prev[member.id], grade: e.target.value },
                                  }))
                                }
                                className="text-[10px] font-bold text-slate-500 bg-slate-50 border-none outline-none text-right"
                              >
                                {GRADES.map((g) => (
                                  <option key={g} value={g}>
                                    {g}
                                  </option>
                                ))}
                              </select>
                              {config.grade === "Custom" ? (
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  value={config.customGross || ""}
                                  onChange={(e) =>
                                    setPayroll((prev) => ({
                                      ...prev,
                                      [member.id]: { ...prev[member.id], customGross: parseFloat(e.target.value) || 0 },
                                    }))
                                  }
                                  className="w-24 text-right text-xs font-black text-slate-800 border-b border-slate-200 outline-none"
                                />
                              ) : (
                                <p className="text-xs font-black text-slate-800">{pay.gross.toLocaleString()}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              {pay.nssf.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                              {pay.paye.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              inputMode="numeric"
                              value={config.deductions || ""}
                              onChange={(e) =>
                                setPayroll((prev) => ({
                                  ...prev,
                                  [member.id]: { ...prev[member.id], deductions: parseFloat(e.target.value) || 0 },
                                }))
                              }
                              placeholder="0"
                              className="w-20 text-xs font-bold text-slate-600 bg-slate-50 border-none rounded-lg px-2 py-1 outline-none"
                            />
                          </td>
                          <td className="px-6 py-4 text-right font-black text-emerald-700 text-xs">
                            {pay.net.toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-[10px] text-slate-400 font-mono truncate max-w-[100px]">
                              {member.bank_account || "—"}
                            </p>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
              {!loading && staff.length > 0 && (
                <tfoot className="bg-slate-900 text-white">
                  <tr>
                    <td className="px-6 py-4 text-[10px] font-black uppercase tracking-wider">School Totals</td>
                    <td className="px-6 py-4 text-right font-black text-xs text-blue-300">
                      {totals.gross.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center font-black text-xs text-amber-400">
                      {totals.nssf.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center font-black text-xs text-rose-400">
                      {totals.paye.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-xs font-black text-slate-400 text-center">
                      {totals.other.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-xs text-emerald-400">
                      {totals.net.toLocaleString()}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Payroll History */}
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight mb-4 flex items-center gap-2">
            <MaterialIcon icon="history" />
            Payroll History
          </h2>
          <div className={cardClassName + " overflow-hidden border-none shadow-xl shadow-slate-200/50"}>
            {historyLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-4 bg-slate-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm font-medium text-slate-400">No payroll history yet</p>
                <p className="text-xs text-slate-300 mt-1">Run payroll to see records here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Month
                      </th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">
                        Gross
                      </th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">
                        NSSF
                      </th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">
                        PAYE
                      </th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">
                        Net
                      </th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Status
                      </th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {history.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-4 py-3 text-xs font-semibold text-slate-700">{r.month}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-800 text-right">
                          {r.gross_pay.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-amber-600 text-right">
                          {r.nssf_deduction.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-rose-600 text-right">
                          {r.paye_tax.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-emerald-700 text-right">
                          {r.net_pay.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${r.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[10px] text-slate-400">
                          {format(new Date(r.created_at), "dd MMM yyyy")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageErrorBoundary>
  );
}
