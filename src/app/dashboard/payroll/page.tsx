"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { cardClassName } from "@/lib/utils";
import { format } from "date-fns";
import { calculateUgandaPayrollTaxes } from "@/lib/operations";
import { useToast } from "@/components/Toast";

const GRADES = ["Scale 1 – UGX 400k", "Scale 2 – UGX 600k", "Scale 3 – UGX 800k", "Scale 4 – UGX 1.0M", "Scale 5 – UGX 1.4M", "Custom"];
const GRADE_VALUES: Record<string, number> = {
  "Scale 1 – UGX 400k": 400000,
  "Scale 2 – UGX 600k": 600000,
  "Scale 3 – UGX 800k": 800000,
  "Scale 4 – UGX 1.0M": 1000000,
  "Scale 5 – UGX 1.4M": 1400000,
};

export default function PayrollPage() {
  const { school, user } = useAuth();
  const toast = useToast();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [month] = useState(format(new Date(), "MMMM yyyy"));
  const [payroll, setPayroll] = useState<Record<string, { grade: string; customGross: number; deductions: number }>>({});

  useEffect(() => {
    if (!school?.id) return;
    setLoading(true);
    supabase
      .from("staff")
      .select("id, first_name, last_name, role, department, bank_account")
      .eq("school_id", school.id)
      .eq("status", "active")
      .then(({ data }) => {
        setStaff(data || []);
        // Init default payroll grades
        const init: Record<string, { grade: string; customGross: number; deductions: number }> = {};
        (data || []).forEach((s: any) => {
          init[s.id] = { grade: GRADES[1], customGross: 0, deductions: 0 };
        });
        setPayroll(init);
        setLoading(false);
      });
  }, [school?.id]);

  const calculateStaffPay = (staffId: string) => {
    const config = payroll[staffId] || { grade: GRADES[1], customGross: 0, deductions: 0 };
    const gross = config.grade === "Custom" ? config.customGross : (GRADE_VALUES[config.grade] || 0);
    const taxes = calculateUgandaPayrollTaxes(gross);
    const net = taxes.netPay - config.deductions;
    return { gross, ...taxes, net };
  };

  const totals = staff.reduce((acc, s) => {
    const pay = calculateStaffPay(s.id);
    return {
      gross: acc.gross + pay.gross,
      nssf: acc.nssf + pay.nssf,
      paye: acc.paye + pay.paye,
      other: acc.other + (payroll[s.id]?.deductions || 0),
      net: acc.net + pay.net
    };
  }, { gross: 0, nssf: 0, paye: 0, other: 0, net: 0 });

  const handleProcessPayroll = async () => {
    if (!confirm(`Process payroll for ${staff.length} staff?\nTotal Net: UGX ${totals.net.toLocaleString()}`)) return;
    
    setProcessing(true);
    try {
      const records = staff.map(s => {
        const pay = calculateStaffPay(s.id);
        return {
          school_id: school?.id,
          staff_id: s.id,
          month,
          gross_pay: pay.gross,
          nssf_deduction: pay.nssf,
          paye_tax: pay.paye,
          other_deductions: payroll[s.id]?.deductions || 0,
          net_pay: pay.net,
          status: "paid",
          processed_by: user?.id
        };
      });

      const { error } = await supabase.from("payroll_history").upsert(records, { onConflict: "staff_id, month" });
      if (error) throw error;

      toast.success(`✅ Payroll processed for ${month}. Slips generated.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to process payroll");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Payroll Hub</h1>
          <p className="text-slate-500 font-medium">Smart Salary Manager for <span className="font-bold text-slate-700">{month}</span></p>
        </div>
        <button
          onClick={handleProcessPayroll}
          disabled={staff.length === 0 || processing}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 hover:scale-105 transition-all disabled:opacity-40 disabled:scale-100"
        >
          {processing
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <MaterialIcon icon="account_balance" />
          }
          Process & Disburse
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Active Staff", value: staff.length, icon: "badge", color: "bg-slate-700" },
          { label: "Gross Total", value: `UGX ${(totals.gross / 1000000).toFixed(1)}M`, icon: "payments", color: "bg-blue-600" },
          { label: "NSSF (5%)", value: `UGX ${totals.nssf.toLocaleString()}`, icon: "savings", color: "bg-amber-500" },
          { label: "PAYE Tax", value: `UGX ${totals.paye.toLocaleString()}`, icon: "gavel", color: "bg-red-500" },
          { label: "Net Payout", value: `UGX ${(totals.net / 1000000).toFixed(1)}M`, icon: "account_balance_wallet", color: "bg-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="p-4 bg-white rounded-3xl border border-slate-100 flex flex-col items-center text-center gap-2">
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

      {/* Payroll Table */}
      <div className={cardClassName + " overflow-hidden border-none shadow-xl shadow-slate-200/50"}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Staff</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Gross (UGX)</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">NSSF</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">PAYE</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Other Ded.</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Net</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Bank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-6 py-4"><div className="h-4 bg-slate-50 rounded-lg animate-pulse" /></td>
                    </tr>
                  ))
                : staff.map((member) => {
                    const config = payroll[member.id] || { grade: GRADES[1], customGross: 0, deductions: 0 };
                    const pay = calculateStaffPay(member.id);
                    
                    return (
                      <tr key={member.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-[10px] shrink-0">
                                {member.first_name?.[0]}{member.last_name?.[0]}
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-800">{member.first_name} {member.last_name}</p>
                                <p className="text-[9px] font-medium text-slate-400">{member.department || "General"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <select
                                value={config.grade}
                                onChange={(e) => setPayroll((prev) => ({ ...prev, [member.id]: { ...prev[member.id], grade: e.target.value } }))}
                                className="text-[10px] font-bold text-slate-500 bg-slate-50 border-none outline-none text-right"
                            >
                                {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                            </select>
                            {config.grade === "Custom" ? (
                                <input
                                    type="number"
                                    value={config.customGross || ""}
                                    onChange={(e) => setPayroll((prev) => ({ ...prev, [member.id]: { ...prev[member.id], customGross: parseFloat(e.target.value) || 0 } }))}
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
                            value={config.deductions || ""}
                            onChange={(e) => setPayroll((prev) => ({ ...prev, [member.id]: { ...prev[member.id], deductions: parseFloat(e.target.value) || 0 } }))}
                            placeholder="0"
                            className="w-20 text-xs font-bold text-slate-600 bg-slate-50 border-none rounded-lg px-2 py-1 outline-none"
                          />
                        </td>
                        <td className="px-6 py-4 text-right font-black text-emerald-700 text-xs">
                            {pay.net.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-[10px] text-slate-400 font-mono truncate max-w-[100px]">{member.bank_account || "—"}</p>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
            {!loading && staff.length > 0 && (
              <tfoot className="bg-slate-900 text-white">
                <tr>
                  <td className="px-6 py-4 text-[10px] font-black uppercase tracking-wider">School Totals</td>
                  <td className="px-6 py-4 text-right font-black text-xs text-blue-300">{totals.gross.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center font-black text-xs text-amber-400">{totals.nssf.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center font-black text-xs text-rose-400">{totals.paye.toLocaleString()}</td>
                  <td className="px-6 py-4 text-xs font-black text-slate-400 text-center">{totals.other.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-black text-xs text-emerald-400">{totals.net.toLocaleString()}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

