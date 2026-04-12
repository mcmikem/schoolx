"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { cardClassName } from "@/lib/utils";

export default function BatchReportsPage() {
  const { school } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [term, setTerm] = useState<string>(currentTerm?.toString() || "1");
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!school?.id) return;
    supabase
      .from("classes")
      .select("id, name, stream")
      .eq("school_id", school.id)
      .then(({ data }) => setClasses(data || []));
  }, [school?.id]);

  const loadStudents = async () => {
    if (!selectedClass) return;
    setLoading(true);
    const { data } = await supabase
      .from("students")
      .select("id, first_name, last_name, student_number")
      .eq("class_id", selectedClass)
      .eq("status", "active");
    setStudents(data || []);
    setSelected((data || []).map((s: any) => s.id));
    setLoading(false);
  };

  const toggleStudent = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    setSelected(
      selected.length === students.length ? [] : students.map((s) => s.id),
    );
  };

  const handleGenerate = () => {
    // In production: trigger jsPDF batch generation for each student
    alert(
      `Generating ${selected.length} report cards for Term ${term}, ${academicYear}.\n\nThis will open a print preview for batch printing.`,
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            Batch Report Cards
          </h1>
          <p className="text-slate-500 font-medium tracking-tight">
            Generate and print report cards for an entire class at once
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={selected.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-2xl font-bold shadow-lg hover:scale-105 transition-all disabled:opacity-40 disabled:scale-100"
        >
          <MaterialIcon icon="print" />
          Print {selected.length} Cards
        </button>
      </div>

      {/* Config */}
      <div className={cardClassName + " p-8"}>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">
          Batch Configuration
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
              Academic Year
            </label>
            <input
              readOnly
              value={academicYear}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-600 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
              Term
            </label>
            <select
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm outline-none"
            >
              <option value="1">Term 1</option>
              <option value="2">Term 2</option>
              <option value="3">Term 3</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
              Class
            </label>
            <div className="flex gap-3">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm outline-none"
              >
                <option value="">Choose class...</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.stream || ""}
                  </option>
                ))}
              </select>
              <button
                onClick={loadStudents}
                disabled={!selectedClass || loading}
                className="px-4 py-3 bg-slate-800 text-white rounded-2xl font-bold text-sm hover:scale-105 transition-all disabled:opacity-40"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                ) : (
                  <MaterialIcon icon="search" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Student List */}
      {students.length > 0 && (
        <div className={cardClassName + " overflow-hidden"}>
          <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected.length === students.length}
                onChange={toggleAll}
                className="w-4 h-4 rounded accent-slate-800 cursor-pointer"
              />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {students.length} Students Found
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100">
              <MaterialIcon
                icon="check_circle"
                className="text-emerald-500"
                style={{ fontSize: 16 }}
              />
              <span className="text-xs font-bold text-slate-600">
                {selected.length} selected
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-50">
            {students.map((student, i) => (
              <label
                key={student.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(student.id)}
                  onChange={() => toggleStudent(student.id)}
                  className="w-4 h-4 rounded accent-slate-800 cursor-pointer shrink-0"
                />
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-black text-xs text-slate-500 shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800">
                    {student.first_name} {student.last_name}
                  </p>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    {student.student_number}
                  </p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="px-3 py-1 bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest rounded-full">
                    Preview
                  </span>
                </div>
              </label>
            ))}
          </div>

          <div className="p-6 bg-slate-50/50 border-t border-slate-50 flex justify-between items-center">
            <p className="text-xs text-slate-400 font-medium italic">
              Each report card will be generated as a separate page in a single
              print job
            </p>
            <button
              onClick={handleGenerate}
              disabled={selected.length === 0}
              className="flex items-center gap-2 px-8 py-3 bg-slate-800 text-white rounded-2xl font-bold shadow-lg hover:scale-105 transition-all disabled:opacity-40"
            >
              <MaterialIcon icon="print" />
              Print All ({selected.length})
            </button>
          </div>
        </div>
      )}

      {students.length === 0 && selectedClass && !loading && (
        <div className={cardClassName + " p-20 text-center"}>
          <MaterialIcon
            icon="group_off"
            style={{ fontSize: 48 }}
            className="text-slate-200 mb-4"
          />
          <p className="text-slate-400 font-medium">
            No active students found in this class.
          </p>
        </div>
      )}
    </div>
  );
}
