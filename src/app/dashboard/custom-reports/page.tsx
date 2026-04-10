"use client";
import { useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { TopBar } from "@/components/dashboard";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

interface DataColumn {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "currency";
  category: "student" | "finance" | "academic";
}

const AVAILABLE_COLUMNS: DataColumn[] = [
  { id: "stu_id", label: "Student ID Number", type: "text", category: "student" },
  { id: "stu_name", label: "Full Name", type: "text", category: "student" },
  { id: "stu_class", label: "Current Class", type: "text", category: "student" },
  { id: "stu_gender", label: "Gender", type: "text", category: "student" },
  { id: "stu_dob", label: "Date of Birth", type: "date", category: "student" },
  { id: "fin_balance", label: "Outstanding Fees", type: "currency", category: "finance" },
  { id: "fin_paid", label: "Total Paid", type: "currency", category: "finance" },
  { id: "fin_wallet", label: "Canteen Wallet", type: "currency", category: "finance" },
  { id: "aca_attendance", label: "Attendance %", type: "number", category: "academic" },
  { id: "aca_average", label: "Term Average", type: "number", category: "academic" },
];

export default function CustomReportsBuilder() {
  const { school } = useAuth();
  const toast = useToast();
  
  const [selectedColumns, setSelectedColumns] = useState<DataColumn[]>([
    AVAILABLE_COLUMNS[0],
    AVAILABLE_COLUMNS[1],
    AVAILABLE_COLUMNS[2],
  ]);

  const [reportTitle, setReportTitle] = useState("Untitled Custom Report");

  const unselectedColumns = AVAILABLE_COLUMNS.filter(
    (col) => !selectedColumns.find((sc) => sc.id === col.id)
  );

  const addColumn = (col: DataColumn) => {
    setSelectedColumns([...selectedColumns, col]);
  };

  const removeColumn = (id: string) => {
    setSelectedColumns(selectedColumns.filter((c) => c.id !== id));
  };

  const handleExport = () => {
    toast.success(`Exporting "${reportTitle}" to Excel layout...`);
    setTimeout(() => {
      toast.info("Download started via Background Job Queue");
    }, 1500);
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg)] w-full">
      <TopBar pageTitle="Report Builder Canvas" onSignOut={() => {}} />

      <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
          
          <div className="glass-premium rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border-l-4 border-indigo-500 shadow-xl shadow-indigo-500/5 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-indigo-500/10 to-transparent z-0 pointer-events-none opacity-50" />
            <div className="relative z-10 flex-1">
              <input 
                 className="text-3xl font-black tracking-tight text-[var(--t1)] bg-transparent border-0 outline-none w-full md:w-3/4 mb-1 border-b-2 border-transparent hover:border-[var(--border)] focus:border-indigo-500 transition-colors placeholder:text-[var(--t4)]"
                 value={reportTitle}
                 onChange={(e) => setReportTitle(e.target.value)}
                 placeholder="Report Title"
              />
              <p className="text-[var(--t3)] font-medium">
                Drag and drop or click data attributes to build your customized PDF or Excel export.
              </p>
            </div>
            <button
              onClick={handleExport}
              className="relative z-10 bg-[var(--surface-container)] text-[var(--t1)] border-[1.5px] border-[var(--border)] hover:border-indigo-500 px-6 py-3 rounded-2xl shadow-sm font-bold transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap"
            >
              <MaterialIcon icon="download" className="text-indigo-500" /> 
              Export Data Target
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
             
             {/* Data Dictionary Sidebar */}
             <div className="glass-premium rounded-3xl p-6 lg:col-span-1 shadow-sm sticky top-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-[var(--t2)] mb-4 flex items-center gap-2">
                   <MaterialIcon icon="dataset" style={{fontSize: 18}} className="text-indigo-400" />
                   Data Atlas
                </h3>
                
                <div className="space-y-4">
                  {['student', 'finance', 'academic'].map(category => {
                    const categoryCols = unselectedColumns.filter(c => c.category === category);
                    if (categoryCols.length === 0) return null;
                    return (
                      <div key={category} className="mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--t3)] mb-2 px-1">
                          {category} Metadata
                        </p>
                        <div className="space-y-2">
                           {categoryCols.map((col) => (
                             <button
                               key={col.id}
                               onClick={() => addColumn(col)}
                               className="w-full text-left bg-[var(--surface)] hover:bg-[var(--surface-container-low)] border border-[var(--border)] hover:border-indigo-400 p-3 rounded-xl transition-all shadow-sm flex items-center justify-between group active:scale-95"
                             >
                               <span className="text-sm font-bold text-[var(--t1)] line-clamp-1">{col.label}</span>
                               <MaterialIcon icon="add" className="text-[var(--t4)] group-hover:text-indigo-500" style={{fontSize: 16}} />
                             </button>
                           ))}
                        </div>
                      </div>
                    )
                  })}
                  {unselectedColumns.length === 0 && (
                    <div className="text-center py-6 border-2 border-dashed border-[var(--border)] rounded-xl">
                      <p className="text-xs text-[var(--t3)] font-medium">All points utilized.</p>
                    </div>
                  )}
                </div>
             </div>

             {/* Live Canvas Preview */}
             <div className="glass-premium rounded-3xl lg:col-span-3 flex flex-col border border-[var(--border)] bg-white/40 shadow-sm overflow-hidden">
                <div className="p-4 bg-[var(--surface)] border-b border-[var(--border)] flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-xs font-bold text-[var(--t3)] px-2 bg-[var(--bg)] rounded-md border border-[var(--border)]">Live Canvas View</span>
                </div>
                
                <div className="p-6 sm:p-8 flex-1 overflow-x-auto custom-scrollbar">
                   {selectedColumns.length === 0 ? (
                      <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border)] rounded-3xl text-[var(--t4)]">
                         <MaterialIcon icon="view_column" style={{fontSize: 48, marginBottom: 12}} className="opacity-50" />
                         <p className="text-sm font-bold tracking-tight">Report Canvas is Empty</p>
                         <p className="text-xs mt-1 opacity-70">Add attributes from the Data Atlas.</p>
                      </div>
                   ) : (
                      <table className="w-full min-w-max border-collapse">
                        <thead>
                          <tr>
                            {selectedColumns.map((col, index) => (
                              <th key={col.id} className="relative group text-left px-4 py-3 bg-[var(--surface-container)]/80 text-[11px] font-black uppercase tracking-widest text-[var(--t2)] border-y border-[var(--border)] first:border-l first:rounded-tl-2xl last:border-r last:rounded-tr-2xl hover:bg-[var(--surface-container)] transition-colors">
                                <div className="flex items-center justify-between gap-4">
                                   <span>{col.label}</span>
                                   <button 
                                     onClick={() => removeColumn(col.id)}
                                     className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--red)] p-1 hover:bg-[var(--red)]/10 rounded"
                                   >
                                     <MaterialIcon icon="close" style={{fontSize: 14}} />
                                   </button>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[1, 2, 3, 4, 5].map((row) => (
                            <tr key={row} className="border-b border-[var(--border)] hover:bg-[var(--surface-container-low)]/50 transition-colors group">
                              {selectedColumns.map((col) => (
                                <td key={col.id} className="px-4 py-4 text-sm font-medium text-[var(--t1)]">
                                   <div className="h-2 w-full bg-[var(--surface-container)] rounded animate-pulse group-hover:bg-[var(--border)]" style={{maxWidth: col.type === 'date' ? '80px' : col.type === 'number' ? '40px' : '150px'}} />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                   )}
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
