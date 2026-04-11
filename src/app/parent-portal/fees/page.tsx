"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";

export default function ParentFeesPage() {
  const { user, isDemo } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [feeStructure, setFeeStructure] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalFee: 0, totalPaid: 0, balance: 0 });

  const fetchChildren = useCallback(async () => {
    if (isDemo) {
      const demo = [{ id: "child-1", first_name: "Isaac", last_name: "Mugisha", class_id: "cls-1", class_name: "P.5 Blue" }];
      setChildren(demo);
      setSelectedChild(demo[0]);
      return;
    }
    if (!user?.id) return;
    const { data } = await supabase
      .from("parent_students")
      .select("student:students(id, first_name, last_name, class_id, class:classes(name))")
      .eq("parent_id", user.id);
    const list = (data || []).map((d: any) => ({ ...d.student, class_name: d.student.class?.name || "—" }));
    setChildren(list);
    if (list.length > 0) setSelectedChild(list[0]);
  }, [user?.id, isDemo]);

  const fetchFees = useCallback(async (child: any) => {
    if (!child) return;
    setLoading(true);
    if (isDemo) {
      const demoStructure = [
        { id: "fs-1", name: "Tuition Fee", amount: 800000, term: "Term 1" },
        { id: "fs-2", name: "Development Levy", amount: 150000, term: "Term 1" },
        { id: "fs-3", name: "Lunch", amount: 250000, term: "Term 1" },
      ];
      const demoPayments = [
        { id: "p-1", amount_paid: 800000, payment_date: "2026-01-15", payment_method: "Mobile Money", receipt_number: "RCP-001", fee_structure: { name: "Tuition Fee" } },
        { id: "p-2", amount_paid: 150000, payment_date: "2026-01-20", payment_method: "Bank", receipt_number: "RCP-002", fee_structure: { name: "Development Levy" } },
      ];
      const totalFee = demoStructure.reduce((s, f) => s + f.amount, 0);
      const totalPaid = demoPayments.reduce((s, p) => s + p.amount_paid, 0);
      setFeeStructure(demoStructure);
      setPayments(demoPayments);
      setStats({ totalFee, totalPaid, balance: Math.max(0, totalFee - totalPaid) });
      setLoading(false);
      return;
    }
    const [{ data: fs }, { data: pays }] = await Promise.all([
      supabase.from("fee_structure").select("id, name, amount, term").eq("class_id", child.class_id),
      supabase.from("fee_payments").select("id, amount_paid, payment_date, payment_method, receipt_number, fee_structure:fee_structure_id(name)").eq("student_id", child.id).order("payment_date", { ascending: false }),
    ]);
    const totalFee = (fs || []).reduce((s: number, f: any) => s + Number(f.amount), 0);
    const totalPaid = (pays || []).reduce((s: number, p: any) => s + Number(p.amount_paid), 0);
    setFeeStructure(fs || []);
    setPayments(pays || []);
    setStats({ totalFee, totalPaid, balance: Math.max(0, totalFee - totalPaid) });
    setLoading(false);
  }, [isDemo]);

  useEffect(() => { fetchChildren(); }, [fetchChildren]);
  useEffect(() => { if (selectedChild) fetchFees(selectedChild); }, [selectedChild, fetchFees]);

  const paidPct = stats.totalFee > 0 ? Math.round((stats.totalPaid / stats.totalFee) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader title="Fees & Receipts" subtitle="View fee balances and payment history" />

      {children.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {children.map((c) => (
            <button key={c.id} onClick={() => setSelectedChild(c)}
              className={`px-4 py-2 rounded-2xl text-sm font-bold whitespace-nowrap transition-all ${selectedChild?.id === c.id ? "bg-[var(--primary)] text-[var(--on-primary)]" : "bg-[var(--surface-container)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"}`}>
              {c.first_name} {c.last_name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Fee", value: `UGX ${stats.totalFee.toLocaleString()}`, icon: "receipt_long", color: "text-[var(--on-surface)]" },
          { label: "Paid", value: `UGX ${stats.totalPaid.toLocaleString()}`, icon: "check_circle", color: "text-emerald-600" },
          { label: "Balance", value: `UGX ${stats.balance.toLocaleString()}`, icon: stats.balance > 0 ? "warning" : "verified", color: stats.balance > 0 ? "text-red-600" : "text-emerald-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardBody className="flex items-center gap-4">
              <MaterialIcon icon={s.icon} className={`text-3xl ${s.color}`} />
              <div>
                <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">{s.label}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody>
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-bold text-[var(--on-surface)]">Payment Progress</p>
            <p className="text-sm font-black text-[var(--primary)]">{paidPct}%</p>
          </div>
          <div className="h-3 w-full bg-[var(--surface-container-highest)] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${paidPct >= 100 ? "bg-emerald-500" : paidPct >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${paidPct}%` }} />
          </div>
        </CardBody>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardBody>
            <h2 className="font-bold text-[var(--on-surface)] mb-4">Fee Structure</h2>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-[var(--surface-container)] rounded-xl animate-pulse" />)}</div>
            ) : feeStructure.length === 0 ? (
              <p className="text-sm text-[var(--on-surface-variant)] text-center py-4">No fee structure set</p>
            ) : (
              <div className="space-y-2">
                {feeStructure.map((f) => (
                  <div key={f.id} className="flex justify-between items-center p-3 bg-[var(--surface-container-low)] rounded-2xl">
                    <div>
                      <p className="font-bold text-sm text-[var(--on-surface)]">{f.name}</p>
                      {f.term && <p className="text-[10px] text-[var(--on-surface-variant)]">{f.term}</p>}
                    </div>
                    <p className="font-black text-sm text-[var(--on-surface)]">UGX {Number(f.amount).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="font-bold text-[var(--on-surface)] mb-4">Payment History</h2>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-[var(--surface-container)] rounded-xl animate-pulse" />)}</div>
            ) : payments.length === 0 ? (
              <p className="text-sm text-[var(--on-surface-variant)] text-center py-4">No payments recorded yet</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {payments.map((p) => (
                  <div key={p.id} className="p-3 bg-[var(--surface-container-low)] rounded-2xl">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-sm text-emerald-600">UGX {Number(p.amount_paid).toLocaleString()}</p>
                        <p className="text-[10px] text-[var(--on-surface-variant)]">{p.fee_structure?.name || "Payment"} · {p.payment_method}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-[var(--on-surface-variant)]">{new Date(p.payment_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                        {p.receipt_number && <p className="text-[10px] font-mono text-[var(--on-surface-variant)]">{p.receipt_number}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
