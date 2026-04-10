"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { cardClassName } from "@/lib/utils";
import { format } from "date-fns";

const GRADES = ["Scale 1 – UGX 400k", "Scale 2 – UGX 600k", "Scale 3 – UGX 800k", "Scale 4 – UGX 1.0M", "Scale 5 – UGX 1.4M"];
const GRADE_VALUES: Record<string, number> = {
  "Scale 1 – UGX 400k": 400000,
  "Scale 2 – UGX 600k": 600000,
  "Scale 3 – UGX 800k": 800000,
  "Scale 4 – UGX 1.0M": 1000000,
  "Scale 5 – UGX 1.4M": 1400000,
};

export default function PayrollPage() {
  const { school } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [month] = useState(format(new Date(), "MMMM yyyy"));
  const [payroll, setPayroll] = useState<Record<string, { grade: string; deductions: number }>>({});

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
        const init: Record<string, { grade: string; deductions: number }> = {};
        (data || []).forEach((s: any) => {
          init[s.id] = { grade: GRADES[1], deductions: 0 };
        });
        setPayroll(init);
        setLoading(false);
      });
  }, [school?.id]);

  const totalGross = staff.reduce((sum, s) => sum + (GRADE_VALUES[payroll[s.id]?.grade] || 0), 0);
  const totalDeductions = staff.reduce((sum, s) => sum + (payroll[s.id]?.deductions || 0), 0);
  const totalNet = totalGross - totalDeductions;

  const handleProcessPayroll = async () => {
    if (!confirm(`Process payroll for ${staff.length} staff?\nTotal Net: UGX ${totalNet.toLocaleString()}`)) return;
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1500)); // Simulate processing
    alert(`✅ Payroll processed for ${month}.\nTotal paid: UGX ${totalNet.toLocaleString()}\n\nSlips will be sent to staff mobile numbers.`);
    setProcessing(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Payroll</h1>
          <p className="text-slate-500 font-medium">Staff salary management for <span className="font-bold text-slate-700">{month}</span></p>
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
          Process Payroll
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Active Staff", value: staff.length, icon: "badge", color: "bg-slate-700" },
          { label: "Gross Pay", value: `UGX ${(totalGross / 1000000).toFixed(1)}M`, icon: "trending_up", color: "bg-blue-600" },
          { label: "Deductions", value: `UGX ${totalDeductions.toLocaleString()}`, icon: "remove_circle", color: "bg-amber-500" },
          { label: "Net Pay", value: `UGX ${(totalNet / 1000000).toFixed(1)}M`, icon: "account_balance_wallet", color: "bg-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="p-5 bg-white rounded-3xl border border-slate-100 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl ${s.color} text-white flex items-center justify-center shrink-0`}>
              <MaterialIcon icon={s.icon} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
              <p className="text-lg font-black text-slate-800 leading-tight">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Payroll Table */}
      <div className={cardClassName + " overflow-hidden"}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/70">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Staff Member</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Department</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Pay Grade</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Gross</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Deductions</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Net</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Bank Account</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-3 bg-slate-100 rounded-full animate-pulse w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                : staff.map((member) => {
                    const grade = payroll[member.id]?.grade || GRADES[1];
                    const gross = GRADE_VALUES[grade] || 0;
                    const deductions = payroll[member.id]?.deductions || 0;
                    const net = gross - deductions;
                    return (
                      <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-black text-xs text-slate-500 shrink-0">
                              {member.first_name?.[0]}{member.last_name?.[0]}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">{member.first_name} {member.last_name}</p>
                              <p className="text-[10px] font-bold text-slate-400 capitalize">{member.role?.replace(/_/g, " ")}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">
                            {member.department || "General"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={grade}
                            onChange={(e) => setPayroll((prev) => ({ ...prev, [member.id]: { ...prev[member.id], grade: e.target.value } }))}
                            className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 outline-none"
                          >
                            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-800 text-sm">UGX {gross.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            value={deductions || ""}
                            onChange={(e) => setPayroll((prev) => ({ ...prev, [member.id]: { ...prev[member.id], deductions: parseFloat(e.target.value) || 0 } }))}
                            placeholder="0"
                            className="w-28 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-amber-100"
                          />
                        </td>
                        <td className="px-6 py-4 font-black text-emerald-700 text-sm">UGX {net.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-slate-400 font-mono">{member.bank_account || "—"}</p>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
            {!loading && staff.length > 0 && (
              <tfoot>
                <tr className="bg-slate-800 text-white">
                  <td colSpan={3} className="px-6 py-4 font-black text-sm uppercase tracking-wider">Totals</td>
                  <td className="px-6 py-4 font-black text-sm">UGX {totalGross.toLocaleString()}</td>
                  <td className="px-6 py-4 font-black text-sm text-amber-300">UGX {totalDeductions.toLocaleString()}</td>
                  <td className="px-6 py-4 font-black text-sm text-emerald-300">UGX {totalNet.toLocaleString()}</td>
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
