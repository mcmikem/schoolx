"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useRef, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { useStudents } from "@/lib/hooks";

interface BankStatementRow {
  date: string;
  description: string;
  amount: number;
  reference: string;
  matched_student_id?: string;
  matched_student_name?: string;
  confidence: "high" | "medium" | "low" | "none";
}

export default function BankReconciliationPage() {
  const { school } = useAuth();
  const { students } = useStudents(school?.id);
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [statementData, setStatementData] = useState<BankStatementRow[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "matched" | "unmatched">("all");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    try {
      // Simulate reading a CSV bank statement
      // In a real app, use PapaParse or similar
      const text = await file.text();
      const rows = text.split("\n").slice(1); // Skip header
      
      const parsed: BankStatementRow[] = rows.map((row, index) => {
        const columns = row.split(",");
        const description = columns[1] || "";
        const amount = parseFloat(columns[2] || "0");
        const date = columns[0] || "";
        const reference = columns[3] || `REF-${index}`;

        // BASIC MATCHING LOGIC (The "Magic")
        let matchedStudent = null;
        let confidence: BankStatementRow["confidence"] = "none";

        if (description) {
          const descLower = description.toLowerCase();
          
          // Try student number first (High Confidence)
          matchedStudent = students.find(s => 
            s.student_number && descLower.includes(s.student_number.toLowerCase())
          );
          
          if (matchedStudent) {
            confidence = "high";
          } else {
            // Try full name (Medium Confidence)
            matchedStudent = students.find(s => 
              descLower.includes(s.first_name.toLowerCase()) && 
              descLower.includes(s.last_name.toLowerCase())
            );
            if (matchedStudent) confidence = "medium";
          }
        }

        return {
          date,
          description,
          amount,
          reference,
          matched_student_id: matchedStudent?.id,
          matched_student_name: matchedStudent ? `${matchedStudent.first_name} ${matchedStudent.last_name}` : undefined,
          confidence
        };
      }).filter(r => r.amount > 0);

      setStatementData(parsed);
      toast.success(`Successfully loaded ${parsed.length} transactions from statement`);
    } catch (err) {
      toast.error("Failed to parse statement");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmReconciliation = async () => {
    const matched = statementData.filter(r => r.matched_student_id);
    if (matched.length === 0) {
      toast.error("No matches to reconcile");
      return;
    }

    setIsProcessing(true);
    try {
      // Batch record payments in Supabase
      const payments = matched.map(r => ({
        school_id: school?.id,
        student_id: r.matched_student_id,
        amount_paid: r.amount,
        payment_date: r.date,
        payment_method: "bank_transfer",
        reference_number: r.reference,
        remarks: `Reconciled from bank statement: ${r.description}`
      }));

      const { error } = await supabase.from("fee_payments").insert(payments);
      if (error) throw error;

      toast.success(`Successfully reconciled ${matched.length} payments!`);
      setStatementData([]);
    } catch (err) {
      toast.error("Reconciliation failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredData = useMemo(() => {
    if (activeFilter === "matched") return statementData.filter(r => r.matched_student_id);
    if (activeFilter === "unmatched") return statementData.filter(r => !r.matched_student_id);
    return statementData;
  }, [statementData, activeFilter]);

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8">
        <PageHeader 
          title="Bank Reconciliation" 
          subtitle="Match bank statements with student fee accounts automatically"
        />

        {statementData.length === 0 ? (
          <Card className="border-dashed border-2 border-indigo-200 bg-indigo-50/30">
            <CardBody className="p-12 text-center">
              <div className="w-20 h-20 rounded-3xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-6">
                <MaterialIcon icon="account_balance" className="text-4xl" />
              </div>
              <h2 className="text-2xl font-black text-[var(--primary)] mb-2">Upload Bank Statement</h2>
              <p className="text-sm text-[var(--t3)] mb-8 max-w-sm mx-auto">
                Upload your bank CSV export. Our AI will automatically identify students based on names or registration numbers in the transaction descriptions.
              </p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".csv" 
                className="hidden" 
              />
              <Button size="lg" onClick={() => fileInputRef.current?.click()} loading={isAnalyzing}>
                <MaterialIcon icon="upload" />
                Choose Statement File (CSV)
              </Button>
              <div className="mt-8 flex justify-center gap-6">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--t3)]">
                  <MaterialIcon icon="check_circle" className="text-emerald-500 text-sm" />
                  Stanbic Bank
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--t3)]">
                  <MaterialIcon icon="check_circle" className="text-emerald-500 text-sm" />
                  Centenary Bank
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--t3)]">
                  <MaterialIcon icon="check_circle" className="text-emerald-500 text-sm" />
                  Absa / DFCU
                </div>
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-[var(--border)]">
                <div className="text-[10px] font-black uppercase text-[var(--t4)] mb-1">Total Transactions</div>
                <div className="text-2xl font-black">{statementData.length}</div>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                <div className="text-[10px] font-black uppercase text-emerald-600 mb-1">Auto-Matched</div>
                <div className="text-2xl font-black text-emerald-700">{statementData.filter(r => r.matched_student_id).length}</div>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
                <div className="text-[10px] font-black uppercase text-amber-600 mb-1">Unmatched</div>
                <div className="text-2xl font-black text-amber-700">{statementData.filter(r => !r.matched_student_id).length}</div>
              </div>
              <div className="p-4 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                <div className="text-[10px] font-black uppercase opacity-70 mb-1">Total Value</div>
                <div className="text-2xl font-black">UGX {statementData.reduce((s, r) => s + r.amount, 0).toLocaleString()}</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button 
                  onClick={() => setActiveFilter("all")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-white border text-slate-500 hover:bg-slate-50'}`}
                >All</button>
                <button 
                  onClick={() => setActiveFilter("matched")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeFilter === 'matched' ? 'bg-emerald-600 text-white' : 'bg-white border text-slate-500 hover:bg-slate-50'}`}
                >Matched</button>
                <button 
                  onClick={() => setActiveFilter("unmatched")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeFilter === 'unmatched' ? 'bg-amber-600 text-white' : 'bg-white border text-slate-500 hover:bg-slate-50'}`}
                >Unmatched</button>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setStatementData([])}>Clear</Button>
                <Button onClick={handleConfirmReconciliation} loading={isProcessing}>
                  <MaterialIcon icon="verified" />
                  Confirm Reconciliation
                </Button>
              </div>
            </div>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Date & Ref</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Bank Description</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Amount</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Student Match</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400 text-right">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredData.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <div className="text-xs font-bold text-slate-800">{row.date}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{row.reference}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-medium text-slate-600 truncate max-w-[300px]" title={row.description}>
                            {row.description}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-black text-indigo-700">UGX {row.amount.toLocaleString()}</div>
                        </td>
                        <td className="p-4">
                          {row.matched_student_name ? (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                                {row.matched_student_name.charAt(0)}
                              </div>
                              <div className="text-xs font-bold text-slate-800">{row.matched_student_name}</div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                              <MaterialIcon icon="help_outline" className="text-sm" />
                              No automatic match
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                            row.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                            row.confidence === 'medium' ? 'bg-blue-100 text-blue-700' :
                            row.confidence === 'low' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-400'
                          }`}>
                            {row.confidence || 'None'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </PageErrorBoundary>
  );
}
