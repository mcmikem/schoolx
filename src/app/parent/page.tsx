"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { calculateStudentFeePosition } from "@/lib/operations";
import { buildAuthLoginAttempts } from "@/lib/auth-login";
import { withSupabaseLockRetry } from "@/lib/supabase-lock";

const PARENT_SELECTED_CHILD_KEY = "parent_selected_child_id";

function MaterialIcon({
  icon,
  className,
  style,
  children,
}: {
  icon?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className || ""}`}
      style={style}
    >
      {icon || children}
    </span>
  );
}

export default function ParentPortal() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [studentData, setStudentData] = useState<any>(null);
  const [parentName, setParentName] = useState("");

  useEffect(() => {
    async function restoreSessionFromAuth() {
      try {
        const { data: authData, error: authError } =
          await withSupabaseLockRetry(async () => await supabase.auth.getUser());
        if (authError || !authData.user) {
          return;
        }

        const { data: parentUser, error: parentError } = await supabase
          .from("users")
          .select("id, full_name")
          .eq("auth_id", authData.user.id)
          .eq("role", "parent")
          .single();

        if (parentError || !parentUser) {
          return;
        }

        const { data: children, error: childrenError } = await supabase
          .from("parent_students")
          .select("students(*, classes(name, level))")
          .eq("parent_id", parentUser.id);

        if (childrenError || !children || children.length === 0) {
          return;
        }

        const validChildren = children
          .map((c: any) => c.students)
          .filter(Boolean);
        const selectedChildId = localStorage.getItem(PARENT_SELECTED_CHILD_KEY);
        const restoredStudent =
          validChildren.find((c: any) => c.id === selectedChildId) ||
          validChildren[0];

        if (!restoredStudent) {
          return;
        }

        setStudentData(restoredStudent);
        setParentName(parentUser.full_name);
        localStorage.setItem(PARENT_SELECTED_CHILD_KEY, restoredStudent.id);
      } catch {
        localStorage.removeItem(PARENT_SELECTED_CHILD_KEY);
      }
    }

    restoreSessionFromAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let authData: { user: { id: string } } | null = null;
      let authError: { message?: string } | null = null;

      for (const attempt of buildAuthLoginAttempts(phone)) {
        const result =
          attempt.type === "email"
            ? await withSupabaseLockRetry(() =>
                supabase.auth.signInWithPassword({
                  email: attempt.value,
                  password,
                }),
              )
            : await withSupabaseLockRetry(() =>
                supabase.auth.signInWithPassword({
                  phone: attempt.value,
                  password,
                }),
              );

        if (!result.error && result.data.user) {
          authData = result.data as { user: { id: string } };
          authError = null;
          break;
        }

        authError = result.error;
      }

      if (authError || !authData?.user) {
        setError("Invalid credentials");
        setLoading(false);
        return;
      }

      const { data: parentUser, error: parentError } = await supabase
        .from("users")
        .select("id, full_name")
        .eq("auth_id", authData.user.id)
        .eq("role", "parent")
        .single();

      if (parentError || !parentUser) {
        await supabase.auth.signOut();
        setError("Parent access is not configured for this account");
        setLoading(false);
        return;
      }

      // Get children
      const { data: children } = await supabase
        .from("parent_students")
        .select("students(*, classes(name, level))")
        .eq("parent_id", parentUser.id);

      if (!children || children.length === 0) {
        await supabase.auth.signOut();
        setError("No linked student was found for this account");
        setLoading(false);
        return;
      }

      const validChildren = children
        .map((c: any) => c.students)
        .filter(Boolean);
      const firstChild = validChildren[0];
      localStorage.setItem(PARENT_SELECTED_CHILD_KEY, firstChild.id);
      setStudentData(firstChild);
      setParentName(parentUser.full_name);
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const switchChild = (child: any) => {
    setStudentData(child);
    localStorage.setItem(PARENT_SELECTED_CHILD_KEY, child.id);
  };

  const handleLogout = async () => {
    localStorage.removeItem(PARENT_SELECTED_CHILD_KEY);
    await supabase.auth.signOut();
    setStudentData(null);
    setParentName("");
    setPhone("");
    setPassword("");
  };

  // Show dashboard if logged in
  if (studentData) {
    return (
      <ParentDashboard
        student={studentData}
        parentName={parentName}
        onLogout={handleLogout}
        onSwitchChild={switchChild}
      />
    );
  }

  return (
    <PageErrorBoundary>
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "var(--navy)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <MaterialIcon
              icon="family_restroom"
              style={{ fontSize: 32, color: "#fff" }}
            />
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--t1)",
              marginBottom: 8,
            }}
          >
            Parent Portal
          </h1>
          <p style={{ color: "var(--t3)" }}>View your child&apos;s progress</p>
        </div>

        <div
          style={{
            background: "var(--surface)",
            borderRadius: 16,
            padding: 24,
            boxShadow: "var(--sh2)",
          }}
        >
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="parent-phone"
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 6,
                  color: "var(--t2)",
                }}
              >
                Phone Number
              </label>
              <input
                id="parent-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07xx xxx xxx or +256xx xxx xxx"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  fontSize: 15,
                  background: "var(--bg)",
                  color: "var(--t1)",
                }}
                required
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label
                htmlFor="parent-password"
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 6,
                  color: "var(--t2)",
                }}
              >
                Password
              </label>
              <input
                id="parent-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  fontSize: 15,
                  background: "var(--bg)",
                  color: "var(--t1)",
                }}
                required
              />
            </div>

            {error && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "#fef2f2",
                  color: "#dc2626",
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 10,
                border: "none",
                background: "var(--navy)",
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <p
            style={{
              textAlign: "center",
              marginTop: 16,
              fontSize: 12,
              color: "var(--t4)",
            }}
          >
            Contact school to get parent login credentials
          </p>
        </div>
      </div>
    </div>
    </PageErrorBoundary>
  );
}

function ParentDashboard({
  student,
  parentName,
  onLogout,
  onSwitchChild,
}: {
  student: any;
  parentName: string;
  onLogout: () => void;
  onSwitchChild: (child: any) => void;
}) {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChildren() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: parentUser } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .eq("role", "parent")
        .single();

      if (!parentUser) return;

      const { data } = await supabase
        .from("parent_students")
        .select("students(*, classes(name, level))")
        .eq("parent_id", parentUser.id);

      const validChildren = (data || [])
        .map((entry: any) => entry.students)
        .filter(Boolean);
      setChildren(validChildren);
    }

    fetchChildren();
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!student?.id) return;
      setLoading(true);

      const [attData, payData, gradeData, adjData] = await Promise.all([
        supabase
          .from("attendance")
          .select("*")
          .eq("student_id", student.id)
          .order("date", { ascending: false })
          .limit(30),
        supabase
          .from("fee_payments")
          .select("*")
          .eq("student_id", student.id)
          .is("deleted_at", null)
          .order("payment_date", { ascending: false })
          .limit(10),
        supabase
          .from("grades")
          .select("*, subjects(name)")
          .eq("student_id", student.id)
          .eq("status", "published")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("fee_adjustments")
          .select("*")
          .eq("student_id", student.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      setAttendance(attData.data || []);
      setPayments(payData.data || []);
      setGrades(gradeData.data || []);
      setAdjustments(adjData.data || []);
      setLoading(false);
    }
    fetchData();
  }, [student?.id]);

  const presentDays = attendance.filter(
    (a: any) => a.status === "present",
  ).length;
  const totalDays = attendance.length;
  const attendanceRate =
    totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
  const feeStats = calculateStudentFeePosition({
    feeTotal: 0,
    payments,
    adjustments,
    openingBalance: Number(student?.opening_balance || 0),
  });
  const averageGrade =
    grades.length > 0
      ? Math.round(
          grades.reduce(
            (sum: number, item: any) => sum + Number(item.score || 0),
            0,
          ) / grades.length,
        )
      : 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header
        style={{
          background: "var(--navy)",
          padding: "16px 20px",
          color: "#fff",
        }}
      >
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcon icon="account_circle" style={{ fontSize: 24 }} />
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>Welcome, {parentName}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Parent Portal</div>
              </div>
            </div>
            <button
              onClick={onLogout}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                borderRadius: 8,
                padding: "8px 12px",
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Logout
            </button>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.15)",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              {student.first_name} {student.last_name}
            </div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              {student.classes?.name} - {student.classes?.level}
            </div>
            {children.length > 1 && (
              <div style={{ marginTop: 12 }}>
                <select
                  value={student.id}
                  onChange={(e) => {
                    const next = children.find(
                      (child: any) => child.id === e.target.value,
                    );
                    if (next) onSwitchChild(next);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "none",
                    fontSize: 13,
                  }}
                >
                  {children.map((child: any) => (
                    <option key={child.id} value={child.id}>
                      {child.first_name} {child.last_name} -{" "}
                      {child.classes?.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>
        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 12,
              padding: 16,
              textAlign: "center",
            }}
          >
            <div
              style={{ fontSize: 28, fontWeight: 700, color: "var(--navy)" }}
            >
              {attendanceRate}%
            </div>
            <div style={{ fontSize: 12, color: "var(--t3)" }}>Attendance</div>
          </div>
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 12,
              padding: 16,
              textAlign: "center",
            }}
          >
            <div
              style={{ fontSize: 28, fontWeight: 700, color: "var(--green)" }}
            >
              {presentDays}
            </div>
            <div style={{ fontSize: 12, color: "var(--t3)" }}>Days Present</div>
          </div>
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 12,
              padding: 16,
              textAlign: "center",
            }}
          >
            <div
              style={{ fontSize: 28, fontWeight: 700, color: "var(--navy)" }}
            >
              {averageGrade}%
            </div>
            <div style={{ fontSize: 12, color: "var(--t3)" }}>
              Average Grade
            </div>
          </div>
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 12,
              padding: 16,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: feeStats.balance > 0 ? "#dc2626" : "var(--green)",
              }}
            >
              {Math.round(feeStats.balance / 1000)}K
            </div>
            <div style={{ fontSize: 12, color: "var(--t3)" }}>Balance</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            marginBottom: 24,
          }}
        >
          <a
            href="#fees"
            style={{
              background: "var(--surface)",
              borderRadius: 12,
              padding: 16,
              textAlign: "center",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <MaterialIcon
              icon="receipt_long"
              style={{ fontSize: 24, color: "var(--navy)" }}
            />
            <div style={{ fontSize: 11, marginTop: 4, color: "var(--t2)" }}>
              Fees
            </div>
          </a>
          <a
            href="#attendance"
            style={{
              background: "var(--surface)",
              borderRadius: 12,
              padding: 16,
              textAlign: "center",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <MaterialIcon
              icon="how_to_reg"
              style={{ fontSize: 24, color: "var(--navy)" }}
            />
            <div style={{ fontSize: 11, marginTop: 4, color: "var(--t2)" }}>
              Attendance
            </div>
          </a>
          <a
            href="#grades"
            style={{
              background: "var(--surface)",
              borderRadius: 12,
              padding: 16,
              textAlign: "center",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <MaterialIcon
              icon="menu_book"
              style={{ fontSize: 24, color: "var(--navy)" }}
            />
            <div style={{ fontSize: 11, marginTop: 4, color: "var(--t2)" }}>
              Grades
            </div>
          </a>
        </div>

        {/* Recent Attendance */}
        <div
          id="attendance"
          style={{
            background: "var(--surface)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 12,
              color: "var(--t1)",
            }}
          >
            Recent Attendance
          </div>
          {loading ? (
            <div
              style={{ textAlign: "center", padding: 20, color: "var(--t3)" }}
            >
              Loading...
            </div>
          ) : attendance.length === 0 ? (
            <div
              style={{ textAlign: "center", padding: 20, color: "var(--t3)" }}
            >
              No attendance records
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {attendance.slice(0, 7).map((att: any) => (
                <div
                  key={att.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--t2)" }}>
                    {new Date(att.date).toLocaleDateString("en-UG", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 20,
                      background:
                        att.status === "present"
                          ? "#dcfce7"
                          : att.status === "absent"
                            ? "#fee2e2"
                            : "#fef3c7",
                      color:
                        att.status === "present"
                          ? "#166534"
                          : att.status === "absent"
                            ? "#dc2626"
                            : "#92400e",
                    }}
                  >
                    {att.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          id="grades"
          style={{
            background: "var(--surface)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 12,
              color: "var(--t1)",
            }}
          >
            Recent Grades
          </div>
          {grades.length === 0 ? (
            <div
              style={{ textAlign: "center", padding: 20, color: "var(--t3)" }}
            >
              No grade records
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {grades.slice(0, 5).map((grade: any) => (
                <div
                  key={grade.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--t2)" }}>
                    {grade.subjects?.name || "Subject"}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--navy)",
                    }}
                  >
                    {Math.round(Number(grade.score || 0))}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div
          id="fees"
          style={{
            background: "var(--surface)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 12,
              color: "var(--t1)",
            }}
          >
            Recent Payments
          </div>
          {payments.length === 0 ? (
            <div
              style={{ textAlign: "center", padding: 20, color: "var(--t3)" }}
            >
              No payment records
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {payments.slice(0, 5).map((pay: any) => (
                <div
                  key={pay.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--t2)" }}>
                    {new Date(pay.payment_date).toLocaleDateString()}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--green)",
                    }}
                  >
                    UGX {Number(pay.amount_paid).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            background: "var(--surface)",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 12,
              color: "var(--t1)",
            }}
          >
            Fee Adjustments
          </div>
          {adjustments.length === 0 ? (
            <div
              style={{ textAlign: "center", padding: 20, color: "var(--t3)" }}
            >
              No fee adjustments
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {adjustments.slice(0, 5).map((adj: any) => (
                <div
                  key={adj.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--t2)",
                        textTransform: "capitalize",
                      }}
                    >
                      {String(adj.adjustment_type).replace("_", " ")}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--t3)" }}>
                      {adj.notes || "No notes"}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color:
                        adj.adjustment_type === "penalty"
                          ? "#dc2626"
                          : "var(--navy)",
                    }}
                  >
                    UGX {Number(adj.amount || 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
