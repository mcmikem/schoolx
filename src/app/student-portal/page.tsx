"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/hooks/utils";
import { useRouter } from "next/navigation";
import MaterialIcon from "@/components/MaterialIcon";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";

interface StudentRecord {
  id: string;
  first_name: string;
  last_name: string;
  student_number: string;
  gender: string;
  class_id: string;
  status: string;
  classes?: { name: string; level: string };
}

export default function StudentPortalPage() {
  const { user, school, authInitialized, isDemo, signOut } = useAuth();
  const router = useRouter();
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<{ present: number; total: number }>({ present: 0, total: 0 });
  const [notices, setNotices] = useState<{ id: string; title: string; content: string; created_at: string }[]>([]);

  useEffect(() => {
    if (!authInitialized) return;
    if (!user && !isDemo) {
      router.replace("/login");
      return;
    }
    if (user && !isDemo && user.role !== "student") {
      router.replace("/dashboard");
      return;
    }
  }, [authInitialized, user, isDemo, router]);

  const fetchStudentData = useCallback(async () => {
    if (!user?.id || !school?.id) return;

    try {
      if (isDemo) {
        setStudent({
          id: "demo-student",
          first_name: "John",
          last_name: "Kato",
          student_number: "S-2025-001",
          gender: "M",
          class_id: "",
          status: "active",
          classes: { name: "S.1 Science", level: "secondary" },
        });
        setAttendance({ present: 38, total: 42 });
        setNotices([
          {
            id: "n1",
            title: "Term 2 Begins",
            content: "School opens on Monday at 7:30 AM",
            created_at: new Date().toISOString(),
          },
          {
            id: "n2",
            title: "Sports Day",
            content: "Annual sports competition this Friday",
            created_at: new Date().toISOString(),
          },
        ]);
        return;
      }

      const { data: studentData } = await withTimeout(
        supabase
          .from("students")
          .select("*, classes(name, level)")
          .eq("user_id", user.id)
          .single()
          .then((r) => {
            if (r.error) throw r.error;
            return r;
          }),
        8000,
        { data: null } as any,
      );
      setStudent(studentData);

      if (studentData) {
        const { data: attData } = await withTimeout(
          supabase.from("attendance").select("status").eq("student_id", studentData.id),
          5000,
          { data: [] } as any,
        );
        const total = (attData || []).length;
        const present = (attData || []).filter((a: { status: string }) => a.status === "present").length;
        setAttendance({ present, total });

        const { data: noticeData } = await withTimeout(
          supabase
            .from("notices")
            .select("*")
            .eq("school_id", school.id)
            .in("target_audience", ["all", "students"])
            .order("created_at", { ascending: false })
            .limit(5)
            .then((r) => {
              if (r.error) throw r.error;
              return r;
            }),
          5000,
          { data: [] } as any,
        );
        setNotices(noticeData || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [user?.id, school?.id, isDemo]);

  useEffect(() => {
    fetchStudentData();
  }, [fetchStudentData]);

  if (!authInitialized || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="p-8 max-w-md text-center">
          <MaterialIcon className="text-4xl text-red-400 mx-auto mb-3">error_outline</MaterialIcon>
          <p className="text-gray-700 font-medium mb-2">Unable to load your data</p>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <Button onClick={() => router.refresh()}>Try Again</Button>
        </Card>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="p-8 max-w-md text-center">
          <MaterialIcon className="text-4xl text-gray-300 mx-auto mb-3">person_off</MaterialIcon>
          <p className="text-gray-700 font-medium mb-2">No student record found</p>
          <p className="text-gray-500 text-sm">Please contact your school administration.</p>
        </Card>
      </div>
    );
  }

  const attPct = attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            {student.first_name[0]}
            {student.last_name[0]}
          </div>
          <div>
            <h1 className="font-semibold text-gray-900 text-sm">
              {student.first_name} {student.last_name}
            </h1>
            <p className="text-xs text-gray-500">
              {student.classes?.name || "Class"} · {student.student_number}
            </p>
          </div>
        </div>
        <button onClick={signOut} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Sign out">
          <MaterialIcon>logout</MaterialIcon>
        </button>
      </header>

      <main className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Attendance",
              value: `${attPct}%`,
              sub: `${attendance.present}/${attendance.total} days`,
              icon: "how_to_reg",
              color: "text-blue-600",
            },
            {
              label: "School",
              value: school?.name?.split(" ")[0] || "N/A",
              sub: "Active",
              icon: "school",
              color: "text-green-600",
            },
            {
              label: "Class",
              value: student.classes?.name || "N/A",
              sub: student.classes?.level || "",
              icon: "group",
              color: "text-purple-600",
            },
            {
              label: "Status",
              value: student.status === "active" ? "Active" : "Inactive",
              sub: "Good standing",
              icon: "check_circle",
              color: student.status === "active" ? "text-green-600" : "text-amber-600",
            },
          ].map((s) => (
            <Card key={s.label} className="!p-4">
              <div className="flex items-center gap-3">
                <MaterialIcon className={`text-2xl ${s.color}`}>{s.icon}</MaterialIcon>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="font-semibold text-gray-900 truncate">{s.value}</p>
                  <p className="text-xs text-gray-400">{s.sub}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                  <MaterialIcon className="text-blue-500 text-lg">campaign</MaterialIcon>
                  School Notices
                </h2>
              </div>
            </div>
            <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {notices.length === 0 ? (
                <p className="p-4 text-sm text-gray-400 text-center">No recent notices</p>
              ) : (
                notices.map((n) => (
                  <div key={n.id} className="p-3 hover:bg-gray-50">
                    <p className="font-medium text-gray-800 text-sm">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{n.content}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(n.created_at).toLocaleDateString("en-UG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                  <MaterialIcon className="text-purple-500 text-lg">trending_up</MaterialIcon>
                  Quick Links
                </h2>
              </div>
            </div>
            <div className="p-3 space-y-1">
              {[
                { icon: "calendar_month", label: "Timetable", color: "text-blue-500" },
                { icon: "menu_book", label: "My Grades", color: "text-green-500" },
                { icon: "payments", label: "Fee Statement", color: "text-amber-500" },
                { icon: "assignment", label: "Homework", color: "text-purple-500" },
              ].map((link) => (
                <button
                  key={link.label}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
                >
                  <MaterialIcon className={`text-xl ${link.color}`}>{link.icon}</MaterialIcon>
                  <span className="text-sm font-medium text-gray-700">{link.label}</span>
                  <MaterialIcon className="ml-auto text-gray-300 text-lg">chevron_right</MaterialIcon>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <Card className="p-4 bg-blue-50 border-blue-100">
          <div className="flex items-start gap-3">
            <MaterialIcon className="text-blue-500 mt-0.5">info</MaterialIcon>
            <div>
              <p className="text-sm font-medium text-blue-800">Student Portal</p>
              <p className="text-xs text-blue-600 mt-0.5">
                More features coming soon — attendance history, full grade reports, and timetable view. Stay tuned!
              </p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
