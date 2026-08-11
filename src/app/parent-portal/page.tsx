"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import OwlMascot from "@/components/brand/OwlMascot";
import { useToast } from "@/components/Toast";
import { logger } from "@/lib/logger";
import ParentPortalShell from "@/components/parent-portal/ParentPortalShell";
import { ChildSelector } from "@/components/parent-portal/ChildSelector";
import { useParentPortal } from "@/components/parent-portal/ParentPortalProvider";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import {
  calculateFeeStats,
  normalizeFeeTermItems,
  normalizePayments,
  normalizeGrades,
  pickPreferredSchemaRows,
  ParentPortalAttendanceRecord,
  ParentPortalFeeStructureItem,
  ParentPortalGradeRecord,
  ParentPortalNotice,
  ParentPortalPayment,
} from "@/lib/parent-portal";

function ParentDashboardContent() {
  const { user, isDemo } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { children, selectedChild, loading: childrenLoading } = useParentPortal();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [notices, setNotices] = useState<ParentPortalNotice[]>([]);
  const [attendance, setAttendance] = useState<ParentPortalAttendanceRecord[]>([]);
  const [grades, setGrades] = useState<ParentPortalGradeRecord[]>([]);
  const [feeStructureItems, setFeeStructureItems] = useState<ParentPortalFeeStructureItem[]>([]);
  const [feePayments, setFeePayments] = useState<ParentPortalPayment[]>([]);
  const [notifications, setNotifications] = useState<ParentPortalNotice[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [childDataLoading, setChildDataLoading] = useState(false);

  const feeStats = useMemo(() => calculateFeeStats(feeStructureItems, feePayments), [feeStructureItems, feePayments]);

  useEffect(() => {
    async function fetchNotices() {
      if (isDemo) {
        setNotices([
          {
            title: "Easter Break",
            content: "School will be closed from Friday to Monday. Happy Holidays!",
            created_at: new Date().toISOString(),
          },
          {
            title: "Visitation Day",
            content: "Parents are invited to check student progress this Saturday.",
            created_at: new Date().toISOString(),
          },
        ]);
        return;
      }

      const schoolId = children[0]?.school_id;
      if (!schoolId) {
        setNotices([]);
        return;
      }
      try {
        const { data: noticeData, error: noticeErr } = await withTimeout(
          supabase
            .from("notices")
            .select("title, content, created_at, category")
            .eq("school_id", schoolId)
            .in("target_audience", ["all", "parents"])
            .order("created_at", { ascending: false })
            .limit(5),
          12000,
          timeoutFallback(),
        );

        if (!noticeErr && noticeData) {
          setNotices(noticeData);
        }
      } catch (noticeErr) {
        logger.warn("Failed to fetch parent notices:", noticeErr);
        setNotices([]);
      }
    }
    fetchNotices();
  }, [children, isDemo]);

  // Fetch student specific data when selected child changes
  useEffect(() => {
    if (!selectedChild) return;
    if (isDemo) {
      setFeeStructureItems([{ id: "demo-fee", name: "Tuition", amount: 1200000, term: "Term 1" }]);
      setFeePayments([
        {
          id: "demo-pay",
          amount_paid: 1080000,
          payment_date: new Date().toISOString(),
          payment_method: "Cash",
          payment_reference: "DEMO-001",
        },
      ]);
      return;
    }
    const selectedChildId = selectedChild.id;
    setChildDataLoading(true);

    async function fetchStudentData() {
      const scopedChild = selectedChild;
      if (!scopedChild) {
        setChildDataLoading(false);
        return;
      }
      try {
        const [attRes, gradesRes, modernFeeTermsRes, modernPaymentsRes, legacyPaymentsRes, legacyFeeTermsRes] =
          await Promise.all([
            withTimeout(
              supabase
                .from("attendance")
                .select("id, date, status, remarks")
                .eq("student_id", scopedChild.id)
                .limit(10),
              12000,
              timeoutFallback(),
            ),
            withTimeout(
              supabase
                .from("grades")
                .select("id, score, max_score, grade, term, exam_type, teacher_comment, subjects(name)")
                .eq("student_id", scopedChild.id)
                .limit(6),
              12000,
              timeoutFallback(),
            ),
            withTimeout(
              supabase
                .from("student_fee_terms")
                .select("id, final_amount, academic_year, fee_terms(name)")
                .eq("student_id", scopedChild.id)
                .order("created_at", { ascending: false }),
              12000,
              timeoutFallback(),
            ),
            withTimeout(
              supabase
                .from("fee_payments")
                .select(
                  "id, amount, payment_date, payment_method, transaction_reference, student_fee_terms!inner(student_id, fee_terms(name))",
                )
                .eq("student_fee_terms.student_id", scopedChild.id)
                .order("payment_date", { ascending: false }),
              12000,
              timeoutFallback(),
            ),
            withTimeout(
              supabase
                .from("fee_payments")
                .select("id, amount_paid, payment_date, payment_method, payment_reference")
                .eq("student_id", scopedChild.id),
              12000,
              timeoutFallback(),
            ),
            withTimeout(
              supabase
                .from("fee_structure")
                .select("*")
                .eq("school_id", scopedChild.school_id)
                .is("deleted_at", null)
                .or(`class_id.is.null,class_id.eq.${scopedChild.class_id}`),
              12000,
              timeoutFallback(),
            ),
          ]);

        const normalizedFeeStructure = pickPreferredSchemaRows({
          modernRows: normalizeFeeTermItems((modernFeeTermsRes.data || []) as never[]),
          modernError: modernFeeTermsRes.error,
          legacyRows: legacyFeeTermsRes.data || [],
          legacyError: legacyFeeTermsRes.error,
        });

        const normalizedPayments = pickPreferredSchemaRows({
          modernRows: normalizePayments((modernPaymentsRes.data || []) as never[]),
          modernError: modernPaymentsRes.error,
          legacyRows: normalizePayments((legacyPaymentsRes.data || []) as never[]),
          legacyError: legacyPaymentsRes.error,
        });

        setAttendance(
          (attRes.data || []).map((record: { id: string; date: string; status: string; remarks?: string }) => ({
            id: record.id,
            date: record.date,
            status: record.status as ParentPortalAttendanceRecord["status"],
            notes: record.remarks ?? null,
          })),
        );
        setGrades(normalizeGrades(gradesRes.data || []));
        setFeeStructureItems(normalizedFeeStructure);
        setFeePayments(normalizedPayments);
      } catch (err) {
        logger.error("Fetch student data error:", err);
      } finally {
        setChildDataLoading(false);
      }
    }
    fetchStudentData();
  }, [selectedChild, isDemo]);

  // Fetch wallet when child changes
  useEffect(() => {
    if (!selectedChild || isDemo) {
      if (isDemo) setWalletBalance(8500); // demo balance
      return;
    }
    const scopedChild = selectedChild;
    if (!scopedChild) return;
    withTimeout(
      supabase.from("student_wallets").select("balance").eq("student_id", scopedChild.id).maybeSingle(),
      12000,
      timeoutFallback(),
    ).then(({ data }) => setWalletBalance(data?.balance ?? 0));
  }, [selectedChild, isDemo, children]);

  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Fetch notifications
  useEffect(() => {
    if (isDemo) {
      setNotifications([
        {
          id: "1",
          type: "grade_posted",
          title: "New Grade Posted",
          content: "Math exam results ready",
          message: "Math exam results ready",
          is_read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: "2",
          type: "payment_received",
          title: "Payment Received",
          content: "UGX 50,000 received",
          message: "UGX 50,000 received",
          is_read: true,
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ]);
      setUnreadCount(1);
      return;
    }
    fetch("/api/parent/notifications?limit=10")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setNotifications(data.notifications || []);
          setUnreadCount((data.notifications || []).filter((n: any) => !n.is_read).length);
        }
      })
      .catch((err) => logger.warn("[parent-portal] Failed to fetch notifications", err));
  }, [isDemo]);

  useEffect(() => {
    // Realtime push is expensive/flaky on slow mobile networks — only keep the
    // socket open while the device is online.
    if (isDemo || !user?.id || !isOnline) return;
    const channel = supabase
      .channel("parent-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "parent_notifications",
          filter: `parent_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Record<string, unknown>;
          setNotifications((prev) => [newNotification as unknown as ParentPortalNotice, ...prev]);
          setUnreadCount((prev) => prev + 1);
          toast.info(String(newNotification.title || "New notification"));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isDemo, toast, isOnline]);

  const handleTopup = async () => {
    if (!selectedChild || !topupAmount) return;
    setTopupLoading(true);
    if (isDemo) {
      await new Promise((r) => setTimeout(r, 1000));
      setWalletBalance((prev) => (prev ?? 0) + parseFloat(topupAmount));
      setTopupAmount("");
      setShowTopup(false);
      setTopupLoading(false);
      return;
    }
    try {
      const { error } = await withTimeout(
        supabase.rpc("topup_student_wallet", {
          p_student_id: child.id,
          p_amount: parseFloat(topupAmount),
          p_description: "Top-up by Parent via Portal",
          p_ref: `PAR-${Date.now()}`,
        }),
        12000,
        timeoutFallback(),
      );
      if (error) throw error;
      setWalletBalance((prev) => (prev ?? 0) + parseFloat(topupAmount));
      setTopupAmount("");
      setShowTopup(false);
      toast.success("Pocket money added successfully.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Top-up failed");
    } finally {
      setTopupLoading(false);
    }
  };

  const handlePayFees = () => {
    if (!selectedChild || feeStats.balance <= 0) {
      toast.info("No outstanding fees for this learner.");
      return;
    }
    router.push("/parent-portal/fees");
  };

  const todayDate = new Date().toISOString().split("T")[0];
  const child = selectedChild ?? children[0] ?? null;
  const todayAttendance = attendance.find((record) => record.date === todayDate) ?? null;
  const attendanceStatus = todayAttendance?.status ?? null;
  const hasFeeBalance = feeStats.balance > 0;
  const urgentUnreads = unreadCount > 0;

  return (
    <ParentPortalShell pageTitle="Parent Portal">
      <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          <section className="portal-glass rounded-[28px] p-6 shadow-none">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {child?.photo_url ? (
                  <img
                    src={child.photo_url}
                    alt={child.first_name}
                    loading="lazy"
                    decoding="async"
                    className="h-14 w-14 shrink-0 rounded-full border border-[var(--portal-border)] object-cover"
                  />
                ) : child ? (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--portal-surface-blue)] text-lg font-bold text-[var(--portal-ink)]">
                    {child.first_name?.[0]}
                    {child.last_name?.[0]}
                  </div>
                ) : null}
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--portal-muted)]">
                    Parent Portal
                  </p>
                  <h1 className="mt-2 text-3xl font-bold text-[var(--portal-ink)]">
                    {child
                      ? `Welcome back — ${child.first_name}`
                      : `Welcome back, ${user?.full_name?.split(" ")[0] || "Parent"}`}
                  </h1>
                  <p className="mt-3 max-w-2xl text-base text-[var(--portal-ink-soft)]">
                    Keep track of your child&apos;s attendance, fees, homework, and school updates in one place.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => selectedChild && router.push(`/parent-portal/fees?child=${selectedChild.id}`)}
                  className="rounded-2xl bg-[var(--portal-surface-blue)] px-4 py-3 text-sm font-semibold text-[var(--portal-ink)] transition hover:bg-[var(--portal-border)]"
                >
                  Pay fees
                </button>
                <button
                  type="button"
                  onClick={() => selectedChild && router.push(`/parent-portal/attendance?child=${selectedChild.id}`)}
                  className="rounded-2xl bg-[var(--portal-surface-alt)] px-4 py-3 text-sm font-semibold text-[var(--portal-ink)] transition hover:bg-[var(--portal-surface-blue-2)]"
                >
                  Attendance
                </button>
              </div>
            </div>
          </section>

          {childrenLoading ? (
            <div className="flex items-center justify-center min-h-[300px]">
              <OwlMascot size={52} premium ring glow animated />
            </div>
          ) : children.length === 0 ? (
            <div className="text-center py-10 rounded-[28px] portal-glass p-8 shadow-none">
              <OwlMascot size={56} premium ring glow animated />
              <h3 className="text-lg font-bold mt-4 text-[var(--portal-ink)]">No learners linked yet</h3>
              <p className="text-sm text-[var(--portal-ink-soft)] mt-1">Your phone on file: {user?.phone || "N/A"}</p>
              <p className="text-sm text-[var(--portal-ink-soft)] mt-2">
                Contact the school office to link your account and access the portal.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              <ChildSelector />

              <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
                <div className="grid gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <article
                      className={`rounded-[28px] border p-5 ${attendanceStatus === "present" ? "bg-[var(--portal-success-soft)] border-[var(--portal-success-border)]" : "bg-[var(--portal-surface-gray)] border-[var(--portal-surface-gray-3)]"}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.20em] text-[var(--portal-muted)]">
                            Attendance
                          </p>
                          <p className="mt-3 text-xl font-bold text-[var(--portal-ink)]">
                            {attendanceStatus === "present" ? "Present" : "Not recorded"}
                          </p>
                        </div>
                        <span
                          className={`material-symbols-outlined text-4xl ${attendanceStatus === "present" ? "text-[var(--portal-success)]" : "text-[var(--portal-muted-strong)]"}`}
                        >
                          {attendanceStatus === "present" ? "check_circle" : "help"}
                        </span>
                      </div>
                    </article>
                    <article
                      className={`rounded-[28px] border p-5 ${hasFeeBalance ? "bg-[var(--portal-danger-soft)] border-[var(--portal-danger-border)]" : "bg-[var(--portal-success-soft)] border-[var(--portal-success-soft-2)]"}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.20em] text-[var(--portal-muted)]">
                            Fee Balance
                          </p>
                          <p
                            className={`mt-3 text-xl font-bold ${hasFeeBalance ? "text-[var(--portal-danger)]" : "text-[var(--portal-success)]"}`}
                          >
                            {hasFeeBalance ? `UGX ${feeStats.balance?.toLocaleString()}` : "Cleared"}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-4xl text-[var(--portal-ink)]">payments</span>
                      </div>
                      <p className="mt-3 text-sm text-[var(--portal-ink-soft)]">
                        Total fee: UGX {feeStats.totalFee?.toLocaleString()}
                      </p>
                    </article>
                  </div>

                  <article className="rounded-[28px] portal-glass p-6 shadow-none">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.20em] text-[var(--portal-muted)]">
                          Quick Actions
                        </p>
                        <p className="mt-2 text-sm text-[var(--portal-ink-soft)]">
                          Jump to the most important sections for this learner.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePayFees()}
                        className="rounded-2xl bg-[var(--portal-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-primary-deep)]"
                      >
                        View fee details
                      </button>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <Link
                        href={`/parent-portal/attendance${selectedChild ? `?child=${selectedChild.id}` : ""}`}
                        className="flex items-center gap-3 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-4 text-sm font-semibold text-[var(--portal-ink)] hover:border-[var(--portal-border-strong)]"
                      >
                        <span className="material-symbols-outlined text-[26px]">how_to_reg</span>
                        Attendance
                      </Link>
                      <Link
                        href={`/parent-portal/homework${selectedChild ? `?child=${selectedChild.id}` : ""}`}
                        className="flex items-center gap-3 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-4 text-sm font-semibold text-[var(--portal-ink)] hover:border-[var(--portal-border-strong)]"
                      >
                        <span className="material-symbols-outlined text-[26px]">assignment</span>
                        Homework
                      </Link>
                      <Link
                        href={`/parent-portal/academics${selectedChild ? `?child=${selectedChild.id}` : ""}`}
                        className="flex items-center gap-3 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-4 text-sm font-semibold text-[var(--portal-ink)] hover:border-[var(--portal-border-strong)]"
                      >
                        <span className="material-symbols-outlined text-[26px]">grade</span>
                        Grades
                      </Link>
                      <button
                        type="button"
                        onClick={() => setShowTopup(true)}
                        className="flex items-center gap-3 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-4 text-sm font-semibold text-[var(--portal-ink)] hover:border-[var(--portal-border-strong)]"
                      >
                        <span className="material-symbols-outlined text-[26px]">wallet</span>
                        Add pocket money
                      </button>
                    </div>
                  </article>
                </div>

                <aside className="space-y-4">
                  <article className="rounded-[28px] portal-glass p-6 shadow-none">
                    <p className="text-sm font-semibold uppercase tracking-[0.20em] text-[var(--portal-muted)]">
                      Important alerts
                    </p>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl bg-[var(--portal-warning-soft)] p-4">
                        <p className="text-sm font-semibold text-[var(--portal-warning)]">
                          {urgentUnreads ? `You have ${unreadCount} unread notification(s)` : "No new notifications"}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[var(--portal-success-faint)] p-4">
                        <p className="text-sm text-[var(--portal-ink)]">
                          {hasFeeBalance ? "Please settle your fee balance soon." : "Fee account is up to date."}
                        </p>
                      </div>
                    </div>
                  </article>
                  <article className="rounded-[28px] portal-glass p-6 shadow-none">
                    <p className="text-sm font-semibold uppercase tracking-[0.20em] text-[var(--portal-muted)]">
                      Next steps
                    </p>
                    <ol className="mt-3 space-y-3 text-sm text-[var(--portal-ink-soft)]">
                      <li>• Check today's attendance</li>
                      <li>• Review recent notifications</li>
                      <li>• Pay any outstanding fees</li>
                    </ol>
                  </article>
                </aside>
              </section>
            </div>
          )}
        </div>
      </div>

      {/* Top-up Modal */}
      {showTopup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto shadow-lg">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center">
                  <MaterialIcon icon="add_card" />
                </div>
                <button onClick={() => setShowTopup(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                  <MaterialIcon icon="close" className="text-gray-400" />
                </button>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">Add Pocket Money</h3>
              <p className="text-base text-gray-500 font-medium mb-8">
                Funds will be available immediately in {selectedChild?.first_name}&apos;s digital wallet
              </p>

              <div className="space-y-6">
                <input
                  type="number"
                  inputMode="numeric"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  placeholder="Amount (UGX)"
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-xl text-2xl font-bold outline-none focus:ring-2 focus:ring-blue-900"
                />
                <div className="flex gap-2 flex-wrap">
                  {[1000, 2000, 5000, 10000, 20000].map((a) => (
                    <button
                      key={a}
                      onClick={() => setTopupAmount(a.toString())}
                      className="flex-1 min-w-[64px] py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:border-blue-900 hover:text-blue-900 transition-colors"
                    >
                      +{a / 1000}k
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleTopup}
                  disabled={!topupAmount || topupLoading}
                  className="w-full py-4 bg-blue-900 text-white rounded-xl font-bold uppercase tracking-wide hover:bg-blue-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {topupLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <MaterialIcon icon="bolt" /> Confirm Top-up
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ParentPortalShell>
  );
}

export default function ParentPortal() {
  return (
    <PageErrorBoundary>
      <ParentDashboardContent />
    </PageErrorBoundary>
  );
}
