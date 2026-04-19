"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { DEMO_CLASSES, DEMO_STUDENTS } from "@/lib/demo-data";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";

interface AtRiskStudent {
  id: string;
  name: string;
  class: string;
  consecutiveAbsence: number;
  riskLevel: "at_risk" | "likely_dropout";
  lastContact: string | null;
}

interface InterventionLog {
  id: string;
  student_id: string;
  student_name: string;
  reason: string;
  action_taken: string;
  logged_at: string;
}

type DropoutReasonOption =
  | "Financial difficulties"
  | "Family relocation"
  | "Pregnancy"
  | "Early marriage"
  | "Child labor"
  | "Illness/Disability"
  | "Lost interest"
  | "Death"
  | "Unknown";

function buildDemoAtRiskStudents(): AtRiskStudent[] {
  const demoEntries = [
    { studentId: "1", consecutiveAbsence: 8 },
    { studentId: "2", consecutiveAbsence: 4 },
    { studentId: "11", consecutiveAbsence: 3 },
  ];

  return demoEntries.reduce<AtRiskStudent[]>((accumulator, entry) => {
      const student = DEMO_STUDENTS.find((item) => item.id === entry.studentId);
      if (!student) return accumulator;

      accumulator.push({
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        class:
          DEMO_CLASSES.find((classItem) => classItem.id === student.class_id)?.name ||
          "-",
        consecutiveAbsence: entry.consecutiveAbsence,
        riskLevel: entry.consecutiveAbsence >= 7 ? "likely_dropout" : "at_risk",
        lastContact: null,
      });

      return accumulator;
    }, []);
}

export default function DropoutTrackingPage() {
  const { school, isDemo } = useAuth();
  const toast = useToast();
  const [students, setStudents] = useState<AtRiskStudent[]>([]);
  const [logs, setLogs] = useState<InterventionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDropoutModal, setShowDropoutModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<AtRiskStudent | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [dropoutReason, setDropoutReason] = useState<DropoutReasonOption | "">("");
  const [saving, setSaving] = useState(false);

  const fetchAtRiskStudents = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);

    if (isDemo) {
      setStudents(buildDemoAtRiskStudents());
      setLogs([]);
      setLoading(false);
      return;
    }

    // Fetch students with 3+ consecutive absences in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const { data: absences, error } = await supabase
      .from("attendance")
      .select(
        "student_id, date, status, students(first_name, last_name, classes(name))",
      )
      .eq("school_id", school.id)
      .eq("status", "absent")
      .gte("date", thirtyDaysAgo)
      .order("student_id")
      .order("date", { ascending: false });

    if (error) {
      toast.error("Failed to load attendance data");
      setLoading(false);
      return;
    }

    // Group by student and count consecutive absences
    const studentMap = new Map<
      string,
      { name: string; class: string; dates: string[] }
    >();
    for (const row of absences || []) {
      const sid = row.student_id;
      const student = row.students as any;
      if (!studentMap.has(sid)) {
        studentMap.set(sid, {
          name: student
            ? `${student.first_name} ${student.last_name}`
            : "Unknown",
          class: student?.classes?.name || "—",
          dates: [],
        });
      }
      studentMap.get(sid)!.dates.push(row.date);
    }

    const atRisk: AtRiskStudent[] = [];
    for (const entry of Array.from(studentMap.entries())) {
      const sid = entry[0];
      const data = entry[1];
      const sortedDates = data.dates.sort((a: string, b: string) =>
        b.localeCompare(a),
      );
      // Count consecutive absence streak from most recent date
      let streak = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diff = Math.round(
          (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (diff <= 2)
          streak++; // allow weekends
        else break;
      }
      if (streak >= 3) {
        atRisk.push({
          id: sid,
          name: data.name,
          class: data.class,
          consecutiveAbsence: streak,
          riskLevel: streak >= 7 ? "likely_dropout" : "at_risk",
          lastContact: null,
        });
      }
    }

    setStudents(
      atRisk.sort((a, b) => b.consecutiveAbsence - a.consecutiveAbsence),
    );

    // Fetch intervention logs
    const { data: logData } = await supabase
      .from("dropout_interventions")
      .select("*")
      .eq("school_id", school.id)
      .order("logged_at", { ascending: false })
      .limit(20);
    setLogs(logData || []);
    setLoading(false);
  }, [isDemo, school?.id, toast]);

  useEffect(() => {
    fetchAtRiskStudents();
  }, [fetchAtRiskStudents]);

  const logIntervention = async () => {
    if (!selectedStudent || !reason || !school?.id) return;

    if (isDemo) {
      const newLog: InterventionLog = {
        id: `demo-log-${Date.now()}`,
        student_id: selectedStudent.id,
        student_name: selectedStudent.name,
        reason,
        action_taken: actionTaken,
        logged_at: new Date().toISOString(),
      };
      setLogs((prev) => [newLog, ...prev]);
      setShowModal(false);
      setReason("");
      setActionTaken("");
      toast.success("Intervention logged successfully");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("dropout_interventions").insert({
      school_id: school.id,
      student_id: selectedStudent.id,
      student_name: selectedStudent.name,
      reason,
      action_taken: actionTaken,
      logged_at: new Date().toISOString(),
    });
    if (error) toast.error("Failed to log intervention");
    else {
      toast.success("Intervention logged successfully");
      setShowModal(false);
      setReason("");
      setActionTaken("");
      fetchAtRiskStudents();
    }
    setSaving(false);
  };

  const handleContactParent = () => {
    if (!selectedStudent) return;
    toast.success(`Parent contact initiated for ${selectedStudent.name}`);
  };

  const handleMarkDropout = async () => {
    if (!selectedStudent || !dropoutReason) return;

    if (isDemo) {
      setStudents((prev) => prev.filter((student) => student.id !== selectedStudent.id));
      setLogs((prev) => [
        {
          id: `demo-dropout-${Date.now()}`,
          student_id: selectedStudent.id,
          student_name: selectedStudent.name,
          reason: dropoutReason,
          action_taken: "Marked as dropout",
          logged_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setShowDropoutModal(false);
      setDropoutReason("");
      setSelectedStudent(null);
      toast.success("Student marked as dropout");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("students")
      .update({
        status: "dropped",
        dropout_reason: dropoutReason,
        dropout_date: new Date().toISOString().split("T")[0],
      })
      .eq("id", selectedStudent.id)
      .eq("school_id", school?.id);

    if (error) {
      toast.error("Failed to mark student as dropout");
    } else {
      toast.success("Student marked as dropout");
      setShowDropoutModal(false);
      setDropoutReason("");
      setSelectedStudent(null);
      fetchAtRiskStudents();
    }
    setSaving(false);
  };

  const likelyDropout = students.filter(
    (s) => s.riskLevel === "likely_dropout",
  );
  const atRiskOnly = students.filter((s) => s.riskLevel === "at_risk");

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Dropout Tracking"
        subtitle="Students with high consecutive absence streaks"
      />

      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Likely Dropout",
            value: likelyDropout.length,
            color: "bg-red-500",
            icon: "warning",
          },
          {
            label: "At Risk",
            value: atRiskOnly.length,
            color: "bg-amber-500",
            icon: "error_outline",
          },
          {
            label: "Interventions Logged",
            value: logs.length,
            color: "bg-blue-600",
            icon: "assignment_turned_in",
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardBody className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-2xl ${s.color} text-white flex items-center justify-center shrink-0`}
              >
                <MaterialIcon icon={s.icon} />
              </div>
              <div>
                <p className="text-2xl font-black text-[var(--on-surface)]">
                  {s.value}
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">
                  {s.label}
                </p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody>
          <h2 className="font-bold text-[var(--on-surface)] mb-4 flex items-center gap-2">
            <MaterialIcon icon="warning" className="text-red-500" />
            Students Requiring Immediate Attention
          </h2>
          {loading ? (
            <div className="text-center py-8 text-[var(--on-surface-variant)]">
              Analysing attendance data…
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12">
              <MaterialIcon
                icon="check_circle"
                className="text-5xl text-emerald-400 mb-3"
              />
              <p className="font-bold text-[var(--on-surface-variant)]">
                No at-risk students detected
              </p>
              <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                All students have regular attendance
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {students.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between p-4 rounded-2xl border ${s.riskLevel === "likely_dropout" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm ${s.riskLevel === "likely_dropout" ? "bg-red-500" : "bg-amber-500"}`}
                    >
                      {s.consecutiveAbsence}d
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{s.name}</p>
                      <p className="text-xs text-slate-500">
                        {s.class} · {s.consecutiveAbsence} consecutive days
                        absent
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${s.riskLevel === "likely_dropout" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
                    >
                      {s.riskLevel === "likely_dropout"
                        ? "Likely Dropout"
                        : "At Risk"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedStudent(s);
                        handleContactParent();
                      }}
                    >
                      Contact
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedStudent(s);
                        setShowModal(true);
                      }}
                    >
                      Intervention
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedStudent(s);
                        setShowDropoutModal(true);
                      }}
                    >
                      Dropout
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {logs.length > 0 && (
        <Card>
          <CardBody>
            <h2 className="font-bold text-[var(--on-surface)] mb-4">
              Recent Interventions
            </h2>
            <div className="space-y-3">
              {logs.map((l) => (
                <div
                  key={l.id}
                  className="flex gap-4 p-3 bg-[var(--surface-container-low)] rounded-xl"
                >
                  <MaterialIcon
                    icon="assignment_turned_in"
                    className="text-blue-500 mt-0.5 shrink-0"
                  />
                  <div>
                    <p className="font-bold text-sm text-[var(--on-surface)]">
                      {l.student_name}
                    </p>
                    <p className="text-xs text-[var(--on-surface-variant)]">
                      {l.reason}
                    </p>
                    {l.action_taken && (
                      <p className="text-xs text-[var(--primary)] mt-1">
                        Action: {l.action_taken}
                      </p>
                    )}
                    <p className="text-[10px] text-[var(--on-surface-variant)] mt-1">
                      {new Date(l.logged_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {showModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-3xl w-full max-w-md shadow-2xl p-8 space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-[var(--on-surface)]">
                Log Intervention
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-[var(--surface-container)] rounded-xl"
              >
                <MaterialIcon icon="close" />
              </button>
            </div>
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
              <p className="font-bold text-amber-800">{selectedStudent.name}</p>
              <p className="text-xs text-amber-600">
                {selectedStudent.class} · {selectedStudent.consecutiveAbsence}{" "}
                days absent
              </p>
            </div>
            <div>
              <label
                htmlFor="dropout-intervention-reason"
                className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2"
              >
                Reason for Absence
              </label>
              <textarea
                id="dropout-intervention-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="e.g. Family financial difficulties, illness..."
                className="w-full px-4 py-3 bg-[var(--surface-container)] border border-[var(--border)] rounded-2xl text-sm font-medium outline-none resize-none"
              />
            </div>
            <div>
              <label
                htmlFor="dropout-intervention-action"
                className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2"
              >
                Action Taken
              </label>
              <textarea
                id="dropout-intervention-action"
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                rows={2}
                placeholder="e.g. Called parent, referred to counselor..."
                className="w-full px-4 py-3 bg-[var(--surface-container)] border border-[var(--border)] rounded-2xl text-sm font-medium outline-none resize-none"
              />
            </div>
            <Button
              onClick={logIntervention}
              disabled={!reason || saving}
              className="w-full"
              loading={saving}
            >
              Save Intervention
            </Button>
          </div>
        </div>
      )}

      {showDropoutModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-3xl w-full max-w-md shadow-2xl p-8 space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-[var(--on-surface)]">
                Mark as Dropout
              </h2>
              <button
                onClick={() => setShowDropoutModal(false)}
                className="p-2 hover:bg-[var(--surface-container)] rounded-xl"
              >
                <MaterialIcon icon="close" />
              </button>
            </div>
            <div className="p-3 bg-red-50 rounded-2xl border border-red-200">
              <p className="font-bold text-red-800">{selectedStudent.name}</p>
              <p className="text-xs text-red-600">
                {selectedStudent.class} · {selectedStudent.consecutiveAbsence} consecutive days absent
              </p>
            </div>
            <div>
              <label
                htmlFor="dropout-reason"
                className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2"
              >
                Reason for Dropout
              </label>
              <select
                id="dropout-reason"
                value={dropoutReason}
                onChange={(e) => setDropoutReason(e.target.value as DropoutReasonOption | "")}
                className="w-full px-4 py-3 bg-[var(--surface-container)] border border-[var(--border)] rounded-2xl text-sm font-medium outline-none"
              >
                <option value="">Select reason...</option>
                <option value="Financial difficulties">Financial difficulties</option>
                <option value="Family relocation">Family relocation</option>
                <option value="Pregnancy">Pregnancy</option>
                <option value="Early marriage">Early marriage</option>
                <option value="Child labor">Child labor</option>
                <option value="Illness/Disability">Illness/Disability</option>
                <option value="Lost interest">Lost interest</option>
                <option value="Death">Death</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setShowDropoutModal(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={handleMarkDropout}
                disabled={!dropoutReason || saving}
                loading={saving}
              >
                Mark as Dropout
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageErrorBoundary>
  );
}
