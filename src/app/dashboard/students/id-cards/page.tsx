"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import StudentIDCard from "@/components/students/StudentIDCard";
import MaterialIcon from "@/components/MaterialIcon";
import { useReactToPrint } from "react-to-print";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { DEMO_STUDENTS } from "@/lib/demo-data";

export default function IDCardGenerator() {
  const { school, isDemo } = useAuth();
  const searchParams = useSearchParams();
  const studentId = searchParams?.get("studentId") || null;

  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (studentId) {
      loadSingleStudent(studentId);
    }
  }, [studentId]);

  const loadSingleStudent = async (id: string) => {
    setLoading(true);
    if (isDemo) {
      const demoS = DEMO_STUDENTS.find(s => s.id === id) || DEMO_STUDENTS[0];
      setStudents([{ ...demoS, classes: { name: "P.5", stream: "North" } }]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("students")
      .select("*, classes(name, stream)")
      .eq("id", id)
      .single();

    if (data) setStudents([data]);
    setLoading(false);
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const searchStudents = async () => {
    if (search.length < 3) return;
    setLoading(true);
    if (isDemo) {
      const filtered = DEMO_STUDENTS.filter(s => 
        s.first_name.toLowerCase().includes(search.toLowerCase()) || 
        s.last_name.toLowerCase().includes(search.toLowerCase())
      );
      setStudents(filtered.map(s => ({ ...s, classes: { name: "P.5", stream: "North" } })));
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("students")
      .select("*, classes(name, stream)")
      .or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,student_number.ilike.%${search}%`,
      )
      .limit(20);

    if (data) setStudents(data);
    setLoading(false);
  };

  const addStudent = async (student: any) => {
    if (students.find((s) => s.id === student.id)) return;
    setStudents((prev) => [...prev, student]);
  };

  const removeStudent = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <PageErrorBoundary>
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            Identity Center
          </h1>
          <p className="text-slate-500 font-medium">
            Generate professional student ID cards
          </p>
        </div>
        <button
          onClick={handlePrint}
          disabled={students.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-primary-800 text-white rounded-2xl font-bold shadow-lg shadow-primary-800/20 hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100"
        >
          <MaterialIcon icon="print" />
          Print {students.length} Cards
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Search Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <MaterialIcon icon="person_search" className="text-primary-700" />
              Add Students
            </h3>
            <div className="relative mb-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchStudents()}
                placeholder="Search by name or ID..."
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-100 transition-all outline-none"
              />
              <MaterialIcon
                icon="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {students.length > 0 ? (
                students.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all group"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-slate-800 truncate">
                        {s.first_name} {s.last_name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
                        {s.student_number}
                      </p>
                    </div>
                    <button
                      onClick={() => removeStudent(s.id)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <MaterialIcon icon="close" style={{ fontSize: 16 }} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-center text-xs text-slate-400 py-10">
                  Search and add students to generate cards.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 min-h-[600px] bg-slate-100/50">
            <div className="mb-8 flex justify-between items-center text-slate-400">
              <h3 className="font-bold uppercase tracking-widest text-[11px]">
                Identity Preview
              </h3>
              <p className="text-[10px] font-medium italic">
                Cards are designed to standard CR80 size (85.6mm x 54mm)
              </p>
            </div>

            <div
              ref={printRef}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-y-10 gap-x-6 justify-items-center print:block print:p-0"
            >
              {students.length > 0 ? (
                students.map((s, i) => (
                  <div
                    key={s.id}
                    className="print:mb-[10mm] print:break-inside-avoid"
                  >
                    <StudentIDCard
                      student={s}
                      school={school || { name: "SkoolMate Official School" }}
                    />
                  </div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-white rounded-[24px] shadow-sm flex items-center justify-center mx-auto text-slate-200">
                    <MaterialIcon icon="id_card" style={{ fontSize: 40 }} />
                  </div>
                  <p className="text-slate-400 font-medium">
                    No cards to preview.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </PageErrorBoundary>
  );
}
