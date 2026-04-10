"use client";

import { useState, useRef, useEffect } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { supabase } from "@/lib/supabase";
import AdmissionLetter from "@/components/students/AdmissionLetter";
import MaterialIcon from "@/components/MaterialIcon";
import { cardClassName } from "@/lib/utils";
import { useReactToPrint } from "react-to-print";
import { useSearchParams } from "next/navigation";

export default function AdmissionPackagePage() {
  const { school } = useAuth();
  const { academicYear } = useAcademic();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId");
  
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
  });

  useEffect(() => {
    if (studentId) {
      loadStudent(studentId);
    }
  }, [studentId]);

  const loadStudent = async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("*, classes(name, stream)")
      .eq("id", id)
      .single();

    if (data) setStudent(data);
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 mb-1">
             <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary-800">
               <MaterialIcon icon="history_edu" />
             </div>
             <h1 className="text-3xl font-black text-slate-800 tracking-tight">Admission Package</h1>
          </div>
          <p className="text-slate-500 font-medium">Generate official enrollment documents</p>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={handlePrint}
            disabled={!student}
            className="flex items-center gap-2 px-6 py-3 bg-primary-800 text-white rounded-2xl font-bold shadow-lg shadow-primary-800/20 hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100"
          >
            <MaterialIcon icon="print" />
            Print Admission Package
          </button>
        </div>
      </div>

      {!student && (
        <div className={cardClassName + " p-12 text-center"}>
           <MaterialIcon icon="search" style={{ fontSize: 48 }} className="text-slate-200 mb-4" />
           <p className="text-slate-500 font-bold">Search for a student to generate their admission letter.</p>
           <div className="mt-4 max-w-md mx-auto relative">
              <input 
                type="text" 
                placeholder="Student Name or Number..." 
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-100"
              />
              <MaterialIcon icon="person_search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
           </div>
        </div>
      )}

      {student && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
           <div className="lg:col-span-1 space-y-6">
              <div className={cardClassName + " p-6"}>
                 <h3 className="font-bold text-slate-800 mb-4 uppercase tracking-widest text-[11px]">Student Context</h3>
                 <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl mb-6">
                   <div className="w-12 h-12 rounded-full bg-primary-800 text-white flex items-center justify-center font-black text-lg">
                     {student.first_name[0]}{student.last_name[0]}
                   </div>
                   <div>
                     <p className="font-bold text-slate-800">{student.first_name} {student.last_name}</p>
                     <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{student.student_number || "Draft"}</p>
                   </div>
                 </div>

                 <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <span className="text-xs text-slate-500">Academic Year</span>
                       <span className="text-xs font-bold text-slate-800">{academicYear || '2026'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-xs text-slate-500">Term</span>
                       <span className="text-xs font-bold text-slate-800">Term 1</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-xs text-slate-500">Assigned Class</span>
                       <span className="text-xs font-bold text-slate-800">{student.classes?.name || 'Unassigned'}</span>
                    </div>
                 </div>
              </div>

              <div className="p-6 bg-amber-50 rounded-[28px] border border-amber-100">
                 <div className="flex items-start gap-3 mt-1">
                    <MaterialIcon icon="lightbulb" className="text-amber-500" />
                    <div>
                      <p className="text-[11px] font-black uppercase text-amber-700 tracking-wider mb-1">Expert Tip</p>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Ensure the parent's name and contact information are correct before printing, as these are used for the official salutation.
                      </p>
                    </div>
                 </div>
              </div>
           </div>

           <div className="lg:col-span-3">
              <div className="overflow-x-auto bg-slate-100 p-8 rounded-[32px] border border-slate-200 border-dashed min-h-[800px] flex justify-center">
                 <div ref={printRef}>
                    <AdmissionLetter 
                      student={student} 
                      school={school || { name: "SkoolMate Official Academy" }} 
                      academicYear={academicYear || "2026"} 
                    />
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
