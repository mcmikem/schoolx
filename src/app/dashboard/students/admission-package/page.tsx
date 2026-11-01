"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { supabase } from "@/lib/supabase";
import { writePrintDocument } from "@/lib/print-window";
import AdmissionLetter from "@/components/students/AdmissionLetter";
import MaterialIcon from "@/components/MaterialIcon";
import { useReactToPrint } from "react-to-print";
import { useSearchParams } from "next/navigation";
import { DEMO_STUDENTS } from "@/lib/demo-data";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/index";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AdmissionPackagePage() {
  const { school, isDemo } = useAuth();
  const { academicYear } = useAcademic();
  const searchParams = useSearchParams();
  const studentId = searchParams?.get("studentId") || null;

  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [letterConfig, setLetterConfig] = useState({
    admissionFee: "150,000",
    termStart: "Term 1, May 2026",
    requirements: "2 reams of paper, mathematical sets, and the prescribed school uniform",
  });

  const reactPrint = useReactToPrint({
    contentRef: printRef,
  });

  const handlePrint = useCallback(() => {
    if (reactPrint) {
      reactPrint();
      return;
    }

    if (!printRef.current || typeof window === "undefined") {
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      return;
    }

    // The letter is lifted from live DOM, so it needs the app's stylesheets to
    // look right -- pass their markup through headHtml rather than cloning
    // nodes into a document that document.open() has left without a body.
    writePrintDocument(printWindow, "Admission Letter", printRef.current.innerHTML, {
      headHtml: Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map((el) => el.outerHTML)
        .join(""),
    });
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }, [reactPrint]);

  const loadStudent = useCallback(
    async (id: string) => {
      setLoading(true);
      if (isDemo) {
        const demoS = DEMO_STUDENTS.find((s) => s.id === id) || DEMO_STUDENTS[0];
        setStudent({ ...demoS, classes: { name: "P.5", stream: "North" } });
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.from("students").select("*, classes(name, stream)").eq("id", id).single();

      if (error) {
        logger.error("Failed to load student for admission letter", error);
        setStudent(null);
      }
      if (data) setStudent(data);
      setLoading(false);
    },
    [isDemo],
  );

  useEffect(() => {
    if (studentId) {
      loadStudent(studentId);
    }
  }, [studentId, loadStudent]);

  const handleSearch = useCallback(
    async (term: string) => {
      setSearchTerm(term);
      if (!term.trim()) {
        setSearchResults([]);
        return;
      }
      if (isDemo) {
        const filtered = DEMO_STUDENTS.filter(
          (s) =>
            `${s.first_name} ${s.last_name}`.toLowerCase().includes(term.toLowerCase()) ||
            (s.student_number || "").toLowerCase().includes(term.toLowerCase()),
        );
        setSearchResults(filtered.slice(0, 5));
        return;
      }
      if (!school?.id) return;
      setSearchLoading(true);
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name, student_number, classes(name, stream)")
        .eq("school_id", school.id)
        .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,student_number.ilike.%${term}%`)
        .limit(5);
      if (error) {
        logger.error("Admission search failed", error);
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }
      setSearchResults(data || []);
      setSearchLoading(false);
    },
    [isDemo, school?.id],
  );

  const handleDownloadPdf = async () => {
    if (!student) return;
    setDownloadingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });

      const lines = [
        school?.name || "SkoolMate School",
        `Admission Letter - ${new Date().toLocaleDateString("en-UG")}`,
        "",
        `Student: ${student.first_name} ${student.last_name}`,
        `Student Number: ${student.student_number || "Pending"}`,
        `Class: ${student.classes?.name || "Unassigned"}`,
        `Parent/Guardian: ${student.parent_name || "Parent/Guardian"}`,
        `Academic Year: ${academicYear}`,
        "",
        `Term Start: ${letterConfig.termStart}`,
        `Admission Fee: UGX ${letterConfig.admissionFee}`,
        "",
        "Requirements:",
        letterConfig.requirements,
      ];

      doc.setFontSize(12);
      doc.text(lines, 14, 20);
      doc.save(`admission-letter-${student.student_number || student.id}.pdf`);
    } catch (error) {
      logger.error("Admission PDF download failed", error);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <PageErrorBoundary>
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        <PageHeader
          title="Admission Package"
          subtitle="Generate official enrollment documents"
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadPdf}
                disabled={!student || downloadingPdf}
                icon={<MaterialIcon icon="download" />}
              >
                {downloadingPdf ? "Generating..." : "Download PDF"}
              </Button>
              <Button onClick={handlePrint} disabled={!student} icon={<MaterialIcon icon="print" />}>
                Print Admission Package
              </Button>
            </div>
          }
        />

        {!student && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center">
            <MaterialIcon icon="search" style={{ fontSize: 48 }} className="text-[var(--t4)] mb-4" />
            <p className="text-[var(--t3)] font-bold">Search for a student to generate their admission letter.</p>
            <div className="mt-4 max-w-md mx-auto relative">
              <input
                type="text"
                placeholder="Student Name or Number..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[var(--surface-container-low)] border border-[var(--border)] rounded-xl outline-none focus:ring-2 focus:ring-primary-100"
              />
              <MaterialIcon
                icon="person_search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t3)]"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--border)] rounded-xl shadow-lg z-10 overflow-hidden">
                  {searchResults.map((s: any) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        loadStudent(s.id);
                        setSearchResults([]);
                        setSearchTerm("");
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-[var(--surface-container-low)] border-b border-[var(--border)] last:border-0 transition-colors"
                    >
                      <p className="font-semibold text-[var(--t1)] text-sm">
                        {s.first_name} {s.last_name}
                      </p>
                      <p className="text-xs text-[var(--t3)]">
                        {s.student_number}{" "}
                        {s.classes ? `• ${s.classes.name}${s.classes.stream ? ` ${s.classes.stream}` : ""}` : ""}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {searchLoading && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--border)] rounded-xl shadow-lg z-10 p-4 text-sm text-[var(--t3)] text-center">
                  Searching…
                </div>
              )}
            </div>
          </div>
        )}

        {student && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <h3 className="font-bold text-[var(--t1)] mb-4 uppercase tracking-widest text-xs">Student Context</h3>
                <div className="flex items-center gap-3 p-3 bg-[var(--surface-container-low)] rounded-2xl mb-6">
                  <div className="w-12 h-12 rounded-full bg-primary-800 text-white flex items-center justify-center font-black text-lg">
                    {student.first_name[0]}
                    {student.last_name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-[var(--t1)]">
                      {student.first_name} {student.last_name}
                    </p>
                    <p className="text-xs font-black uppercase tracking-wider text-[var(--t3)]">
                      {student.student_number || "Draft"}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--t3)]">Academic Year</span>
                    <span className="text-xs font-bold text-[var(--t1)]">{academicYear}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--t3)]">Term</span>
                    <span className="text-xs font-bold text-[var(--t1)]">Term 1</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--t3)]">Assigned Class</span>
                    <span className="text-xs font-bold text-[var(--t1)]">{student.classes?.name || "Unassigned"}</span>
                  </div>
                </div>
              </div>

              {/* Letter Template Customization */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <h3 className="font-bold text-[var(--t1)] mb-3 uppercase tracking-widest text-xs">Customise Letter</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold uppercase text-[var(--t3)] mb-1 block">
                      Admission Fee (UGX)
                    </label>
                    <input
                      type="text"
                      value={letterConfig.admissionFee}
                      onChange={(e) => setLetterConfig((p) => ({ ...p, admissionFee: e.target.value }))}
                      className="input text-sm"
                      placeholder="150,000"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-[var(--t3)] mb-1 block">Term Start</label>
                    <input
                      type="text"
                      value={letterConfig.termStart}
                      onChange={(e) => setLetterConfig((p) => ({ ...p, termStart: e.target.value }))}
                      className="input text-sm"
                      placeholder="Term 1, May 2026"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-[var(--t3)] mb-1 block">Requirements</label>
                    <textarea
                      value={letterConfig.requirements}
                      onChange={(e) => setLetterConfig((p) => ({ ...p, requirements: e.target.value }))}
                      className="input text-sm"
                      rows={3}
                      placeholder="Items to bring..."
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 bg-amber-50 rounded-[28px] border border-amber-100">
                <div className="flex items-start gap-3 mt-1">
                  <MaterialIcon icon="lightbulb" className="text-amber-500" />
                  <div>
                    <p className="text-xs font-black uppercase text-amber-700 tracking-wider mb-1">Expert Tip</p>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Ensure the parent's name and contact information are correct before printing, as these are used
                      for the official salutation.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="overflow-x-auto bg-[var(--surface-container)] p-8 rounded-[32px] border border-[var(--border)] border-dashed min-h-[800px] flex justify-center">
                <div ref={printRef}>
                  <AdmissionLetter
                    student={student}
                    school={school || { name: "SkoolMate Official Academy" }}
                    academicYear={academicYear}
                    admissionFee={letterConfig.admissionFee}
                    termStart={letterConfig.termStart}
                    requirements={letterConfig.requirements}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageErrorBoundary>
  );
}
