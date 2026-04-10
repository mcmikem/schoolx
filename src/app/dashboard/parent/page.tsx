"use client";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { calculateStudentFeePosition } from "@/lib/operations";

export default function ParentPortal() {
  const { user, school } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const [loading, setLoading] = useState(true);
  const [linkedStudents, setLinkedStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [linkedStudent, setLinkedStudent] = useState<any>(null);

  const [attendance, setAttendance] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [feeStructure, setFeeStructure] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [canteenSales, setCanteenSales] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      if (!user?.id || !school?.id) return;

      setLoading(true);
      try {
        const { data: parentLinks } = await supabase
          .from("parent_students")
          .select("*, students(*, classes(*))")
          .eq("parent_id", user.id)
          .order("created_at", { ascending: true });

        const students = (parentLinks || [])
          .map((link: any) => link.students)
          .filter(Boolean);
        setLinkedStudents(students);

        const activeStudent =
          students.find((student: any) => student.id === selectedStudentId) ||
          students[0];
        setSelectedStudentId(activeStudent?.id || "");

        if (activeStudent) {
          setLinkedStudent(activeStudent);

          const [attRes, gradesRes, payRes, fsRes, adjRes, canteenRes] =
            await Promise.all([
              supabase
                .from("attendance")
                .select("*")
                .eq("student_id", activeStudent.id)
                .order("date", { ascending: false })
                .limit(14),
              supabase
                .from("grades")
                .select("*, subjects(name)")
                .eq("student_id", activeStudent.id)
                .eq("term", currentTerm)
                .eq("academic_year", academicYear)
                .eq("status", "published")
                .is("deleted_at", null),
              supabase
                .from("fee_payments")
                .select("*")
                .eq("student_id", activeStudent.id)
                .is("deleted_at", null)
                .order("payment_date", { ascending: false }),
              supabase
                .from("fee_structure")
                .select("*")
                .eq("school_id", school.id)
                .eq("academic_year", academicYear)
                .is("deleted_at", null),
              supabase
                .from("fee_adjustments")
                .select("*")
                .eq("student_id", activeStudent.id)
                .is("deleted_at", null)
                .order("created_at", { ascending: false }),
              supabase
                .from("canteen_sales")
                .select("*")
                .eq("student_id", activeStudent.id)
                .order("created_at", { ascending: false })
                .limit(5),
            ]);

          setAttendance(attRes.data || []);
          setGrades(gradesRes.data || []);
          setPayments(payRes.data || []);
          setFeeStructure(fsRes.data || []);
          setAdjustments(adjRes.data || []);
          setCanteenSales(canteenRes.data || []);
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user?.id, school?.id, currentTerm, academicYear, selectedStudentId]);

  const feeStats = useMemo(() => {
    const position = calculateStudentFeePosition({
      feeTotal: feeStructure.reduce(
        (sum, fee) => sum + Number(fee.amount || 0),
        0,
      ),
      payments,
      adjustments,
      openingBalance: Number(linkedStudent?.opening_balance || 0),
    });
    return {
      totalFee: position.totalExpected,
      totalPaid: position.totalPaid,
      balance: position.balance,
      status: position.status,
    };
  }, [feeStructure, payments, adjustments, linkedStudent?.opening_balance]);

  const attendanceRate = useMemo(() => {
    if (attendance.length === 0) return 0;
    const present = attendance.filter((a) => a.status === "present").length;
    return Math.round((present / attendance.length) * 100);
  }, [attendance]);

  const avgGrade = useMemo(() => {
    if (grades.length === 0) return 0;
    const total = grades.reduce((sum, g) => sum + Number(g.score), 0);
    return Math.round(total / grades.length);
  }, [grades]);

  const getGradeColor = (grade: string) => {
    if (grade?.startsWith("D"))
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (grade?.startsWith("C"))
      return "bg-blue-100 text-blue-700 border-blue-200";
    if (grade?.startsWith("P"))
      return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-red-100 text-red-700 border-red-200";
  };

  const getGradeLetter = (score: number) => {
    if (score >= 80) return "D1";
    if (score >= 70) return "D2";
    if (score >= 65) return "C3";
    if (score >= 60) return "C4";
    if (score >= 55) return "C5";
    if (score >= 50) return "C6";
    if (score >= 45) return "P7";
    if (score >= 40) return "P8";
    return "F9";
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 w-full animate-pulse space-y-6 max-w-6xl mx-auto">
        <div className="h-10 bg-[var(--surface-container)] rounded-xl w-64"></div>
        <div className="h-40 bg-[var(--surface-container)] rounded-3xl"></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="h-32 bg-[var(--surface-container)] rounded-3xl"></div>
          <div className="h-32 bg-[var(--surface-container)] rounded-3xl"></div>
          <div className="h-32 bg-[var(--surface-container)] rounded-3xl"></div>
        </div>
      </div>
    );
  }

  if (!linkedStudent) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-[var(--t1)] tracking-tight">
            Parent Portal
          </h1>
          <p className="text-[var(--t3)] mt-2">
            Welcome! No children are currently linked to your account.
          </p>
        </div>
        <div className="glass-premium rounded-3xl p-12 text-center">
          <MaterialIcon
            icon="family_restroom"
            className="text-6xl text-[var(--border)] mb-4"
          />
          <h3 className="text-xl font-bold text-[var(--t1)]">
            No Linked Students
          </h3>
          <p className="text-[var(--t3)] mt-2 max-w-md mx-auto">
            Please contact the school administration to link your child&apos;s
            academic profile to your parent account.
          </p>
        </div>
      </div>
    );
  }

  const studentName = `${linkedStudent.first_name} ${linkedStudent.last_name}`;
  const initials =
    `${linkedStudent.first_name?.[0] || ""}${linkedStudent.last_name?.[0] || ""}`.toUpperCase();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full animate-fade-in">
      {/* Header and Child Selector */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black text-[var(--t1)] tracking-tight mb-2">
            Parent Portal
          </h1>
          <p className="text-[var(--t2)] text-base">
            Comprehensive academic and financial overview.
          </p>
        </div>

        {linkedStudents.length > 1 && (
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-black uppercase tracking-widest text-[var(--t3)] mb-2">
              Viewing Profile For
            </label>
            <div className="relative">
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full sm:w-64 appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-bold text-[var(--t1)] shadow-[var(--sh1)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
              >
                {linkedStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.first_name} {student.last_name}
                  </option>
                ))}
              </select>
              <MaterialIcon
                icon="expand_more"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--t3)] pointer-events-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Student identity Card */}
      <div className="glass-premium rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[var(--primary)]/10 to-transparent rounded-full -mr-32 -mt-32 blur-3xl" />

        <div className="flex items-center gap-6 relative z-10">
          <div className="w-20 h-20 rounded-[24px] bg-gradient-to-br from-[var(--primary)] to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/20 text-white flex-shrink-0">
            <span className="text-2xl font-black tracking-widest">
              {initials}
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-[var(--t1)] tracking-tight">
              {studentName}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-[var(--t2)] font-medium">
              <span className="bg-[var(--surface-container)] px-3 py-1 rounded-full border border-[var(--border)]">
                {linkedStudent.classes?.name || "Unassigned"}
              </span>
              <span className="bg-[var(--surface-container)] px-3 py-1 rounded-full border border-[var(--border)]">
                {linkedStudent.student_number || "No ID"}
              </span>
              <span className="text-[var(--t3)]">•</span>
              <span className="text-[var(--primary)] font-bold">
                Term {currentTerm}, {academicYear}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full sm:w-auto relative z-10">
          <div className="bg-[var(--surface-container)] p-4 rounded-2xl border border-[var(--border)] text-center min-w-[120px]">
            <p className="text-[10px] font-black uppercase text-[var(--t3)] tracking-widest mb-1">
              Attendance
            </p>
            <p
              className={`text-2xl font-black ${attendanceRate >= 90 ? "text-emerald-600" : attendanceRate >= 75 ? "text-amber-500" : "text-red-500"}`}
            >
              {attendanceRate}%
            </p>
          </div>
          <div className="bg-[var(--surface-container)] p-4 rounded-2xl border border-[var(--border)] text-center min-w-[120px]">
            <p className="text-[10px] font-black uppercase text-[var(--t3)] tracking-widest mb-1">
              Avg Grade
            </p>
            <p className="text-2xl font-black text-[var(--primary)]">
              {avgGrade}%
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Financials */}
        <div className="space-y-8">
          {/* Tuition Fee Tracker */}
          <section className="glass-premium rounded-3xl p-6 sm:p-8 border-t-4 border-t-[var(--primary)]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-[var(--t1)] flex items-center gap-2">
                <MaterialIcon
                  icon="account_balance"
                  className="text-[var(--primary)]"
                />
                Tuition & Fees Status
              </h2>
              <span
                className={`px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-widest border ${
                  feeStats.status === "paid"
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                    : "bg-amber-50 text-amber-600 border-amber-200"
                }`}
              >
                {feeStats.status.replace("_", " ")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-[10px] font-black uppercase text-[var(--t3)] tracking-widest mb-1">
                  Total Paid
                </p>
                <p className="text-xl font-bold text-[var(--t1)]">
                  UGX {feeStats.totalPaid.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase text-[var(--t3)] tracking-widest mb-1">
                  Total Fee
                </p>
                <p className="text-xl font-bold text-[var(--t1)]">
                  UGX {feeStats.totalFee.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="h-4 bg-[var(--surface-container)] rounded-full overflow-hidden mb-6 relative border border-[var(--border)]">
              <div
                className="h-full bg-gradient-to-r from-[var(--primary)] to-blue-400 transition-all duration-1000 ease-in-out relative"
                style={{
                  width: `${feeStats.totalFee > 0 ? Math.min((feeStats.totalPaid / feeStats.totalFee) * 100, 100) : 0}%`,
                }}
              >
                <div
                  className="absolute inset-0 bg-white/20"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)",
                    backgroundSize: "1rem 1rem",
                  }}
                ></div>
              </div>
            </div>

            <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">
                  Outstanding Balance
                </p>
                <p className="text-2xl font-black text-red-600">
                  UGX {feeStats.balance.toLocaleString()}
                </p>
              </div>
              <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-red-600/20 transition-all active:scale-95 flex items-center gap-2">
                <MaterialIcon icon="payment" style={{ fontSize: 18 }} />
                Pay Now
              </button>
            </div>
          </section>

          {/* Canteen Wallet & Expenses */}
          <section className="glass-premium rounded-3xl p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-lg font-black text-[var(--t1)] flex items-center gap-2">
                <MaterialIcon icon="wallet" className="text-emerald-500" />
                Student Canteen Wallet
              </h2>
            </div>

            <div className="flex items-center justify-between bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5 mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">
                  Available Balance
                </p>
                <p className="text-3xl font-black text-emerald-700">
                  UGX {Number(linkedStudent.balance || 0).toLocaleString()}
                </p>
              </div>
              <button className="bg-emerald-500 hover:bg-emerald-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-md shadow-emerald-500/20 transition-all active:scale-95">
                <MaterialIcon icon="add" />
              </button>
            </div>

            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--t3)] mb-4">
                Recent Canteen Purchases
              </h3>
              {canteenSales.length === 0 ? (
                <p className="text-sm text-[var(--t3)] italic text-center py-4 bg-[var(--surface-container-low)] rounded-xl border border-[var(--border)]">
                  No recent purchases.
                </p>
              ) : (
                <div className="space-y-3">
                  {canteenSales.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between p-3 border border-[var(--border)] rounded-xl hover:bg-[var(--surface-container-low)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[var(--surface-container)] flex items-center justify-center text-[var(--primary)]">
                          <MaterialIcon
                            icon="storefront"
                            style={{ fontSize: 20 }}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[var(--t1)]">
                            {new Date(sale.created_at).toLocaleDateString(
                              "en-UG",
                              {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </p>
                          <p className="text-[10px] uppercase font-bold text-[var(--t4)] tracking-widest">
                            {sale.items?.length || 1} Item(s)
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-black text-red-500">
                        - UGX {Number(sale.total_amount).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Academics */}
        <div className="space-y-8">
          {/* Term Grades */}
          <section className="glass-premium rounded-3xl p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-[var(--t1)] flex items-center gap-2">
                <MaterialIcon icon="school" className="text-[var(--accent)]" />
                Current Term Grades
              </h2>
            </div>

            {grades.length === 0 ? (
              <div className="text-[var(--t3)] text-center py-12 bg-[var(--surface-container-low)] rounded-2xl border border-[var(--border)] border-dashed">
                <MaterialIcon
                  icon="assignment"
                  className="text-4xl text-[var(--border)] mb-3"
                />
                <p className="text-sm font-medium">
                  Report cards haven't been published yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {grades.map((grade: any, i: number) => {
                  const letter = getGradeLetter(grade.score);
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/30 rounded-2xl transition-all shadow-sm group"
                    >
                      <div className="truncate pr-4">
                        <p className="font-bold text-[var(--t1)] text-sm mb-1 truncate">
                          {grade.subjects?.name || "Unknown"}
                        </p>
                        <p className="text-[10px] uppercase font-black text-[var(--t3)] tracking-widest">
                          Score: {Math.round(grade.score)}%
                        </p>
                      </div>
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border shadow-sm shrink-0 transition-transform group-hover:scale-105 ${getGradeColor(letter)}`}
                      >
                        {letter}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Attendance Heatmap */}
          <section className="glass-premium rounded-3xl p-6 sm:p-8">
            <h2 className="text-lg font-black text-[var(--t1)] flex items-center gap-2 mb-6">
              <MaterialIcon
                icon="event_available"
                className="text-purple-500"
              />
              14-Day Attendance
            </h2>

            {attendance.length === 0 ? (
              <p className="text-sm text-[var(--t3)] italic text-center py-8">
                No attendance records recorded recently.
              </p>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-4 custom-scrollbar">
                {attendance.map((day: any, i: number) => {
                  const isPresent = day.status === "present";
                  const isAbsent = day.status === "absent";
                  return (
                    <div
                      key={i}
                      className="flex-shrink-0 text-center flex flex-col items-center"
                    >
                      <div
                        className={`w-12 h-16 rounded-2xl flex items-center justify-center border shadow-sm transition-transform hover:-translate-y-1 ${
                          isPresent
                            ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                            : isAbsent
                              ? "bg-red-50 border-red-100 text-red-600"
                              : "bg-amber-50 border-amber-100 text-amber-600"
                        }`}
                      >
                        <MaterialIcon
                          icon={
                            isPresent
                              ? "check"
                              : isAbsent
                                ? "close"
                                : "schedule"
                          }
                          style={{ fontSize: 24, fontWeight: "bold" }}
                        />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--t3)] mt-3">
                        {new Date(day.date).toLocaleDateString("en-UG", {
                          weekday: "short",
                        })}
                      </span>
                      <span className="text-[11px] font-bold text-[var(--t2)] mt-0.5">
                        {new Date(day.date).toLocaleDateString("en-UG", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
