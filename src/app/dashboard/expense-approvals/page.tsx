"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { useToast } from "@/components/Toast";
import { getErrorMessage } from "@/lib/validation";

type Expense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  requested_by?: string;
};

export default function ExpenseApprovalsPage() {
  const { school, user, isDemo } = useAuth();
  const toast = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [processing, setProcessing] = useState<string | null>(null);

  const DEMO_EXPENSES: Expense[] = [
    { id: "demo-exp-1", category: "utilities", description: "School electricity bill", amount: 250000, status: "pending", created_at: new Date().toISOString() },
    { id: "demo-exp-2", category: "supplies", description: "Science lab equipment", amount: 850000, status: "pending", created_at: new Date(Date.now() - 86400000).toISOString() },
  ];

  const fetchExpenses = useCallback(async () => {
    if (!school?.id) {
      if (isDemo) {
        setExpenses(DEMO_EXPENSES);
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      let q = supabase.from("expenses").select("*").eq("school_id", school.id).order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      setExpenses((data || []).length > 0 ? data : isDemo ? DEMO_EXPENSES : []);
    } catch (err) {
      if (isDemo) {
        setExpenses(DEMO_EXPENSES);
      } else {
        toast.error(getErrorMessage(err, "Failed to load expenses"));
      }
    } finally {
      setLoading(false);
    }
  }, [school?.id, statusFilter, toast, isDemo]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const handleApproval = async (id: string, approve: boolean) => {
    if (!user?.id) return;
    setProcessing(id);
    try {
      const { error } = await supabase.from("expenses").update({
        status: approve ? "approved" : "rejected",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      toast.success(approve ? "Expense approved" : "Expense rejected");
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update expense"));
    } finally {
      setProcessing(null);
    }
  };

  const statusBadge = (s: string) => {
    const styles: Record<string, string> = {
      pending: "bg-amber-100 text-amber-700",
      approved: "bg-emerald-100 text-emerald-700",
      rejected: "bg-red-100 text-red-700",
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${styles[s] ?? "bg-gray-100 text-gray-600"}`}>{s}</span>;
  };

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <PageHeader
          title="Expense Approvals"
          subtitle="Review and approve or reject pending budget expenses"
        />

        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {(["pending", "approved", "rejected", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${statusFilter === s ? "bg-indigo-600 text-white shadow" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"}`}
            >
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-slate-50 rounded-2xl animate-pulse" />)}</div>
        ) : expenses.length === 0 ? (
          <Card>
            <CardBody>
              <div className="py-12 text-center">
                <MaterialIcon icon="check_circle" className="text-4xl text-slate-200 mb-2" />
                <p className="font-bold text-slate-400">No {statusFilter !== "all" ? statusFilter : ""} expenses</p>
                <p className="text-sm text-slate-300 mt-1">All expenses in this category have been processed</p>
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-3">
            {expenses.map((exp) => (
              <Card key={exp.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm">{exp.description || exp.category}</span>
                        {statusBadge(exp.status)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="font-medium">{exp.category}</span>
                        <span>•</span>
                        <span>{new Date(exp.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-lg font-black text-slate-800">UGX {Number(exp.amount).toLocaleString()}</span>
                      {exp.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproval(exp.id, true)}
                            disabled={processing === exp.id}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                          >
                            {processing === exp.id ? "…" : "Approve"}
                          </button>
                          <button
                            onClick={() => handleApproval(exp.id, false)}
                            disabled={processing === exp.id}
                            className="px-3 py-1.5 bg-red-50 text-red-700 rounded-xl text-xs font-black hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            {processing === exp.id ? "…" : "Reject"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageErrorBoundary>
  );
}
