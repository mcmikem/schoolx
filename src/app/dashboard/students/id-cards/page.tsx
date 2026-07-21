"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import StudentIDCard from "@/components/students/StudentIDCard";
import MaterialIcon from "@/components/MaterialIcon";
import { useSearchParams } from "next/navigation";
import { DEMO_STUDENTS } from "@/lib/demo-data";
import { logger } from "@/lib/logger";

export default function IDCardGenerator() {
  const { school: authSchool, isDemo, refreshSchoolFromAPI } = useAuth();
  const searchParams = useSearchParams();
  const studentId = searchParams?.get("studentId") || null;

  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshSchoolFromAPI?.().catch((err) => logger.warn("[id-cards] refreshSchoolFromAPI failed", err));
  }, [refreshSchoolFromAPI]);

  const loadSingleStudent = useCallback(
    async (id: string) => {
      setLoading(true);
      if (isDemo) {
        const demoS = DEMO_STUDENTS.find((s) => s.id === id) || DEMO_STUDENTS[0];
        setStudents([{ ...demoS, classes: { name: "P.5", stream: "North" } }]);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.from("students").select("*, classes(name, stream)").eq("id", id).single();

      if (data) setStudents([data]);
      setLoading(false);
    },
    [isDemo],
  );

  useEffect(() => {
    if (studentId) {
      loadSingleStudent(studentId);
    }
  }, [studentId, loadSingleStudent]);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=800,height=600,noopener,noreferrer");
    if (!printWindow) {
      logger.warn("Popup blocked");
      return;
    }

    const content = printRef.current;
    if (!content) {
      logger.warn("No content to print");
      return;
    }

    const origin = window.location.origin;
    const bodyHtml = content.innerHTML.replace(/(src|href)=(["'])\//g, (match, attr, quote) => {
      return `${attr}=${quote}${origin}/`;
    });

    const styleTags = Array.from(document.querySelectorAll("link[rel=stylesheet], style"))
      .map((el) => el.outerHTML)
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>${styleTags}</head>
        <body>${bodyHtml}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const searchStudents = async () => {
    if (search.length < 3) return;
    setLoading(true);
    setSearched(true);
    if (isDemo) {
      const filtered = DEMO_STUDENTS.filter(
        (s) =>
          s.first_name.toLowerCase().includes(search.toLowerCase()) ||
          s.last_name.toLowerCase().includes(search.toLowerCase()),
      );
      setSearchResults(filtered.map((s) => ({ ...s, classes: { name: "P.5", stream: "North" } })));
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("students")
      .select("*, classes(name, stream)")
      .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,student_number.ilike.%${search}%`)
      .limit(20);

    if (data) setSearchResults(data);
    setLoading(false);
  };

  const addStudent = (student: any) => {
    if (students.find((s) => s.id === student.id)) return;
    setStudents((prev) => [...prev, student]);
    setSearchResults([]);
    setSearch("");
    setSearched(false);
  };

  const removeStudent = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <PageErrorBoundary>
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Identity Center</h1>
            <p className="text-slate-500 font-medium">Generate professional student ID cards</p>
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
                <MaterialIcon icon="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="mb-4 space-y-1 max-h-[200px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1">
                  {searchResults.map((s) => {
                    const alreadyAdded = students.some((sel) => sel.id === s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => addStudent(s)}
                        disabled={alreadyAdded}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-slate-800 truncate">
                            {s.first_name} {s.last_name}
                          </p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">{s.student_number}</p>
                        </div>
                        <MaterialIcon
                          icon={alreadyAdded ? "check_circle" : "add_circle"}
                          className={alreadyAdded ? "text-green-500" : "text-primary-700"}
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {searched && searchResults.length === 0 && !loading && (
                <p className="text-xs text-slate-400 text-center py-2 mb-4">No students found.</p>
              )}

              {/* Selected students */}
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                {students.length > 0 ? (
                  students.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-primary-50 border border-primary-100 group"
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
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-all"
                      >
                        <MaterialIcon icon="close" style={{ fontSize: 16 }} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-xs text-slate-400 py-10">Search and tap a student to add them.</p>
                )}
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 min-h-[600px] bg-slate-100/50">
              <div className="mb-8 flex justify-between items-center text-slate-400">
                <h3 className="font-bold uppercase tracking-widest text-[11px]">Identity Preview</h3>
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
                    <div key={s.id} className="print:mb-[10mm] print:break-inside-avoid">
                      <StudentIDCard student={s} school={authSchool || { name: "SkoolMate Official School" }} />
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center space-y-4">
                    <div className="w-20 h-20 bg-white rounded-[24px] shadow-sm flex items-center justify-center mx-auto text-slate-200">
                      <MaterialIcon icon="id_card" style={{ fontSize: 40 }} />
                    </div>
                    <p className="text-slate-400 font-medium">No cards to preview.</p>
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
