"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { DEMO_ATTENDANCE } from "@/lib/demo-data";

interface AtRiskStudent {
  id: string;
  first_name: string;
  last_name: string;
  gender: string;
  student_number: string;
  class_id: string;
  class_name: string;
  parent_name: string;
  parent_phone: string;
  consecutive_absent: number;
  last_attendance_date: string | null;
  risk_level: "at_risk" | "likely_dropout";
}

interface DropoutsTabProps {
  school: any;
  user: any;
  isDemo: boolean;
  students: any[];
  classes: any[];
  updateStudent: (id: string, data: any) => Promise<any>;
}

export default function DropoutsTab({
  school,
  user,
  isDemo,
  students,
  classes,
  updateStudent,
}: DropoutsTabProps) {
  const toast = useToast();
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("all");
  const [showDropoutModal, setShowDropoutModal] = useState<string | null>(null);
  const [dropoutReason, setDropoutReason] = useState("");
  const [sendingSms, setSendingSms] = useState<string | null>(null);

  const fetchAtRiskStudents = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      if (isDemo) {
        const activeStudents = students.filter((s) => s.status === "active");
        const demoRiskList: AtRiskStudent[] = activeStudents
          .slice(0, 4)
          .map((student, index) => ({
            id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            gender: student.gender,
            student_number: student.student_number || "",
            class_id: student.class_id,
            class_name: student.classes?.name || "-",
            parent_name: student.parent_name || "",
            parent_phone: student.parent_phone || "",
            consecutive_absent: index === 0 ? 32 : index === 1 ? 21 : index === 2 ? 16 : 14,
            last_attendance_date: index === 0 ? null : DEMO_ATTENDANCE.find(r => r.student_id === student.id && r.status !== 'absent')?.date || null,
            risk_level: index === 0 ? "likely_dropout" : "at_risk",
          }));
        setAtRiskStudents(demoRiskList);
        return;
      }
      
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];
      
      const { data: attendanceData, error } = await supabase
        .from("attendance")
        .select("student_id, date, status")
        .gte("date", thirtyDaysAgoStr)
        .order("date", { ascending: false });
        
      if (error) throw error;
      
      const studentAtt: Record<string, { date: string; status: string }[]> = {};
      attendanceData?.forEach((record: any) => {
        if (!studentAtt[record.student_id]) studentAtt[record.student_id] = [];
        studentAtt[record.student_id].push({ date: record.date, status: record.status });
      });

      const activeStudents = students.filter((s) => s.status === "active");
      const atRiskList: AtRiskStudent[] = [];

      for (const student of activeStudents) {
        const records = studentAtt[student.id];
        if (!records || records.length === 0) {
           // If no attendance records at all in 30 days, likely dropout
           atRiskList.push({
             ...student,
             class_name: student.classes?.name || "-",
             consecutive_absent: 30,
             last_attendance_date: null,
             risk_level: "likely_dropout",
           });
           continue;
        }

        let consecutiveAbsent = 0;
        let lastAttendanceDate: string | null = null;
        for (const rec of records) {
          if (rec.status === "absent") consecutiveAbsent++;
          else {
            lastAttendanceDate = rec.date;
            break;
          }
        }

        if (consecutiveAbsent >= 14) {
          atRiskList.push({
            id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            gender: student.gender,
            student_number: student.student_number || "",
            class_id: student.class_id,
            class_name: student.classes?.name || "-",
            parent_name: student.parent_name || "",
            parent_phone: student.parent_phone || "",
            consecutive_absent: consecutiveAbsent,
            last_attendance_date: lastAttendanceDate,
            risk_level: consecutiveAbsent >= 30 ? "likely_dropout" : "at_risk",
          });
        }
      }
      setAtRiskStudents(atRiskList.sort((a, b) => b.consecutive_absent - a.consecutive_absent));
    } catch (err) {
      console.error("Error computing at-risk students:", err);
    } finally {
      setLoading(false);
    }
  }, [school?.id, students, isDemo]);

  useEffect(() => {
    fetchAtRiskStudents();
  }, [fetchAtRiskStudents]);

  const handleContactParent = async (student: AtRiskStudent) => {
    if (!student.parent_phone) {
      toast.error("No parent phone number on file");
      return;
    }
    setSendingSms(student.id);
    try {
      const message = `Dear ${student.parent_name || "Parent/Guardian"}, your child ${student.first_name} ${student.last_name} has been absent from school for ${student.consecutive_absent} consecutive days. Please contact the school urgently.`;
      if (isDemo) {
        toast.success(`SMS queued to ${student.parent_phone}`);
        return;
      }
      await supabase.from("messages").insert({
        school_id: school?.id,
        recipient_type: "individual",
        phone: student.parent_phone,
        message,
        status: "pending",
        sent_by: user?.id,
      });
      toast.success(`SMS queued to ${student.parent_phone}`);
    } catch (err) {
      toast.error("Failed to send SMS");
    } finally {
      setSendingSms(null);
    }
  };

  const handleMarkDropout = async () => {
    if (!showDropoutModal || !dropoutReason) {
      toast.error("Please provide a reason");
      return;
    }
    try {
      await updateStudent(showDropoutModal, {
        status: "dropped",
        dropout_reason: dropoutReason,
        dropout_date: new Date().toISOString().split("T")[0],
      });
      toast.success("Student marked as dropout");
      setShowDropoutModal(null);
      setDropoutReason("");
      fetchAtRiskStudents();
    } catch (err) {
      toast.error("Failed to update student");
    }
  };

  const filteredAtRisk = classFilter === "all" 
    ? atRiskStudents 
    : atRiskStudents.filter(s => s.class_id === classFilter);

  const atRiskCount = atRiskStudents.filter(s => s.risk_level === "at_risk").length;
  const likelyDropoutCount = atRiskStudents.filter(s => s.risk_level === "likely_dropout").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-amber-500">
          <div className="text-xs font-bold uppercase text-[var(--t3)] mb-1">At Risk</div>
          <div className="text-2xl font-bold text-amber-600">{atRiskCount}</div>
          <div className="text-[10px] text-[var(--t3)]">14-29 days absent</div>
        </Card>
        <Card className="p-4 border-l-4 border-red-500">
          <div className="text-xs font-bold uppercase text-[var(--t3)] mb-1">Likely Dropout</div>
          <div className="text-2xl font-bold text-red-600">{likelyDropoutCount}</div>
          <div className="text-[10px] text-[var(--t3)]">30+ days absent</div>
        </Card>
      </div>

      <div className="flex gap-4 items-center">
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm"
        >
          <option value="all">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button variant="ghost" size="sm" onClick={fetchAtRiskStudents}>
          <MaterialIcon icon="refresh" /> Refresh
        </Button>
      </div>

      {loading ? (
        <TableSkeleton rows={5} />
      ) : (
        <Card>
          <div className="p-4 border-b border-[var(--border)]">
            <h3 className="font-semibold">{filteredAtRisk.length} students currently at risk</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--surface-container)]">
                  <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--t3)]">Student</th>
                  <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--t3)]">Class</th>
                  <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--t3)]">Days Absent</th>
                  <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--t3)]">Risk Level</th>
                  <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--t3)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAtRisk.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-[var(--t3)]">No students at risk found</td></tr>
                ) : (
                  filteredAtRisk.map((student) => (
                    <tr key={student.id} className="border-b border-[var(--border)]">
                      <td className="p-4">
                        <div className="font-bold">{student.first_name} {student.last_name}</div>
                        <div className="text-xs text-[var(--t3)]">{student.student_number}</div>
                      </td>
                      <td className="p-4"><span className="px-2 py-1 bg-gray-100 rounded text-xs">{student.class_name}</span></td>
                      <td className="p-4 font-bold text-red-600">{student.consecutive_absent} days</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${student.risk_level === 'likely_dropout' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {student.risk_level.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleContactParent(student)} disabled={sendingSms === student.id}>
                            <MaterialIcon icon="sms" /> {sendingSms === student.id ? 'Sending...' : 'Contact'}
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => setShowDropoutModal(student.id)}>
                            <MaterialIcon icon="person_off" /> Mark Dropout
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Dropout Confirmation Modal */}
      {showDropoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDropoutModal(null)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Confirm Dropout</h2>
            <p className="text-[var(--t3)] mb-4">Are you sure you want to mark this student as a dropout? This will change their status to inactive.</p>
            <div className="mb-6">
              <label className="block text-xs font-bold uppercase text-[var(--t3)] mb-2">Reason for Dropout</label>
              <textarea
                value={dropoutReason}
                onChange={(e) => setDropoutReason(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] min-h-[100px]"
                placeholder="e.g. Financial difficulties, family relocation..."
                required
              />
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setShowDropoutModal(null)}>Cancel</Button>
              <Button variant="primary" className="flex-1 bg-red-600" onClick={handleMarkDropout}>Confirm Dropout</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
