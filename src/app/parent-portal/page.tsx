"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import OwlMascot from "@/components/brand/OwlMascot";
import MaterialIcon from "@/components/MaterialIcon";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { ChildSelector } from "@/components/parent-portal/ChildSelector";
import { useParentPortal } from "@/components/parent-portal/ParentPortalProvider";
import ParentPortalShell from "@/components/parent-portal/ParentPortalShell";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import { getLocalDateString, timeoutFallback, withTimeout } from "@/lib/hooks/utils";
import { logger } from "@/lib/logger";
import {
  calculateFeeStats,
  findUnseenNotificationIds,
  nextDueDate,
  normalizeFeeTermItems,
  normalizeGrades,
  normalizePayments,
  ParentPortalAdjustment,
  ParentPortalAttendanceRecord,
  ParentPortalFeeStructureItem,
  ParentPortalGradeRecord,
  ParentPortalNotice,
  ParentPortalPayment,
  pickPreferredSchemaRows,
} from "@/lib/parent-portal";
import { supabase } from "@/lib/supabase";

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
  const [feeAdjustments, setFeeAdjustments] = useState<ParentPortalAdjustment[]>([]);
  const [notifications, setNotifications] = useState<ParentPortalNotice[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [childDataLoading, setChildDataLoading] = useState(false);

  /**
   * How often to check for new parent notifications.
   *
   * Long enough not to drain a data bundle, short enough that a parent watching
   * for their child's result does not wait noticeably. Anything slower than this
   * and the portal feels broken; anything faster and it costs more than the
   * WebSocket it replaced.
   */
  const POLL_MS = 45_000;

  const feeStats = useMemo(
    () => calculateFeeStats(feeStructureItems, feePayments, feeAdjustments),
    [feeStructureItems, feePayments, feeAdjustments],
  );
  const nextDue = useMemo(() => nextDueDate(feeStructureItems), [feeStructureItems]);

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
            .select("title, content, created_at, type")
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
      setFeeAdjustments([]);
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
    let cancelled = false;
    setChildDataLoading(true);
    setAttendance([]);
    setGrades([]);
    setFeeStructureItems([]);
    setFeePayments([]);
    setFeeAdjustments([]);

    async function fetchStudentData() {
      const scopedChild = selectedChild;
      if (!scopedChild) {
        setChildDataLoading(false);
        return;
      }
      try {
        const [
          attRes,
          gradesRes,
          modernFeeTermsRes,
          modernPaymentsRes,
          legacyPaymentsRes,
          legacyFeeTermsRes,
          adjustmentsHomeRes,
        ] = await Promise.all([
          withTimeout(
            supabase.from("attendance").select("id, date, status, remarks").eq("student_id", scopedChild.id).limit(10),
            12000,
            timeoutFallback(),
          ),
          withTimeout(
            supabase
              .from("grades")
              .select("id, score, max_score, term, assessment_type, subjects(name)")
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
                "id, amount_paid, payment_date, payment_method, payment_reference, student_fee_terms!inner(student_id, fee_terms(name))",
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
          withTimeout(
            supabase
              .from("fee_adjustments")
              .select("id, adjustment_type, amount, notes, created_at")
              .eq("student_id", scopedChild.id)
              .order("created_at", { ascending: false }),
            12000,
            { data: [], error: null } as never,
          ),
        ]);

        if (cancelled) return;

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
        setFeeAdjustments(
          (
            (adjustmentsHomeRes?.data || []) as Array<{
              id: string;
              adjustment_type: string;
              amount: number | string;
              notes?: string | null;
              created_at?: string | null;
            }>
          ).map((a) => ({
            id: a.id,
            adjustment_type: a.adjustment_type,
            amount: Number(a.amount || 0),
            notes: a.notes ?? null,
            created_at: a.created_at ?? null,
          })),
        );
      } catch (err) {
        if (!cancelled) logger.error("Fetch student data error:", err);
      } finally {
        if (!cancelled) setChildDataLoading(false);
      }
    }
    void fetchStudentData();
    return () => {
      cancelled = true;
    };
  }, [selectedChild, isDemo]);

  // Fetch wallet when child changes
  useEffect(() => {
    if (!selectedChild || isDemo) {
      if (isDemo) setWalletBalance(8500); // demo balance
      return;
    }
    const scopedChild = selectedChild;
    if (!scopedChild) return;
    let cancelled = false;
    setWalletBalance(null);
    withTimeout(
      supabase.from("student_wallets").select("balance").eq("student_id", scopedChild.id).maybeSingle(),
      12000,
      timeoutFallback(),
    ).then(({ data }) => {
      if (!cancelled) setWalletBalance(data?.balance ?? 0);
    });
    return () => {
      cancelled = true;
    };
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
    fetch("/api/parent/notifications/?limit=10")
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
    // Polling, not a live channel.
    //
    // This used to be a realtime postgres_changes subscription, which was
    // already noted as "expensive/flaky on slow mobile networks". The socket
    // transport behind it also had to ship on the critical path of every page
    // in the app -- `SupabaseClient` builds it unconditionally and no option
    // turns it off -- so one subscription for one portal was costing every
    // teacher a WebSocket client they never use. It is now aliased out
    // (next.config.js, src/lib/supabase-realtime-stub.ts).
    //
    // The trade, stated plainly: a notification arrives within POLL_MS rather
    // than instantly, and nothing arrives while the tab is closed. For a parent
    // checking their child's results on a phone, that is an acceptable price
    // for the dashboard loading at all.
    if (isDemo || !user?.id || !isOnline) return;

    let cancelled = false;
    // Only ids are kept between polls; comparing full rows would re-announce
    // every notification each tick, since rows are re-read with server defaults
    // (is_read, read_at) applied. See findUnseenNotificationIds.
    let seenIds = new Set<string>();

    const poll = async () => {
      try {
        const { data, error } = await supabase
          .from("parent_notifications")
          .select("id, title, type, message, is_read, action_url, created_at")
          .eq("parent_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);
        if (cancelled || error || !data) return;

        const rows = data as unknown as ParentPortalNotice[];
        setNotifications(rows);
        setUnreadCount(rows.filter((n) => !n.is_read).length);

        // Announce only ids never seen before. Skipped on the very first tick,
        // where seenIds is empty and every existing row would read as "new".
        if (seenIds.size > 0) {
          const { toAnnounce, seen } = findUnseenNotificationIds(seenIds, rows);
          for (const item of toAnnounce) toast.info(item.title);
          seenIds = seen;
        } else {
          seenIds = new Set(rows.map((n) => (n.id ? String(n.id) : "")).filter(Boolean));
        }
      } catch (err) {
        if (!cancelled) logger.warn("[parent-portal] notification poll failed", err);
      }
    };

    void poll();
    const timer = window.setInterval(poll, POLL_MS);

    // Coming back from a locked phone should feel immediate, not up to a poll
    // late, so re-check as soon as the tab is visible again.
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id, isDemo, toast, isOnline]);

  const handleTopup = async () => {
    const amount = Number(topupAmount);
    if (!selectedChild || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount greater than zero.");
      return;
    }
    setTopupLoading(true);
    if (isDemo) {
      await new Promise((r) => setTimeout(r, 1000));
      setWalletBalance((prev) => (prev ?? 0) + amount);
      setTopupAmount("");
      setShowTopup(false);
      setTopupLoading(false);
      return;
    }
    try {
      const { error } = await withTimeout(
        supabase.rpc("topup_student_wallet", {
          p_student_id: child.id,
          p_amount: amount,
          p_description: "Top-up by Parent via Portal",
          p_ref: `PAR-${Date.now()}`,
          // Deliberately null: recorded_by is a staff column, and this is the
          // parent paying. The description already says who acted, so the row
          // explains itself instead of carrying an unattributed gap.
          p_recorded_by: null,
        }),
        12000,
        timeoutFallback(),
      );
      if (error) throw error;
      setWalletBalance((prev) => (prev ?? 0) + amount);
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

  const todayDate = getLocalDateString();
  const child = selectedChild ?? children[0] ?? null;
  const todayAttendance = attendance.find((record) => record.date === todayDate) ?? null;
  const attendanceStatus = todayAttendance?.status ?? null;
  const hasFeeBalance = feeStats.balance > 0;
  const urgentUnreads = unreadCount > 0;

  return (
    <ParentPortalShell pageTitle="Parent Portal">
      <div className="w-full space-y-6 px-4 py-5 sm:px-6 lg:space-y-7 lg:px-8 lg:py-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary)]">Parent portal</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--t1)] sm:text-3xl">Portal Dashboard</h1>
            <p className="mt-1 text-sm text-[var(--t3)]">
              Welcome back{user?.full_name?.trim() ? `, ${user.full_name.trim().split(/\s+/)[0]}` : ""}. Here is what is
              happening at school.
            </p>
          </div>
          {urgentUnreads && (
            <Link
              href="/parent-portal/messages"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--t2)] hover:bg-[var(--surface-container-low)]"
            >
              <MaterialIcon icon="notifications" size={18} />
              {unreadCount} unread update{unreadCount === 1 ? "" : "s"}
            </Link>
          )}
        </header>

        {childrenLoading ? (
          <div className="flex min-h-40 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div
              className="flex items-center gap-3 text-sm font-medium text-[var(--t3)]"
              role="status"
              aria-live="polite"
            >
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary-200)] border-t-[var(--primary)]" />
              Loading linked learners…
            </div>
          </div>
        ) : children.length === 0 ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-10 text-center shadow-[var(--sh1)] sm:px-8">
            <OwlMascot size={52} premium ring glow animated />
            <h2 className="mt-4 text-lg font-bold text-[var(--t1)]">No learners linked yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--t3)]">
              Contact the school office to link your parent account and view attendance, fees, results, and school
              notices.
            </p>
          </section>
        ) : (
          <>
            <section
              aria-label="Choose a learner"
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--sh1)] sm:p-5"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-[var(--t1)]">Your learners</h2>
                  <p className="mt-0.5 text-xs text-[var(--t3)]">Choose a learner to see their school information.</p>
                </div>
                {child?.class_name && (
                  <span className="hidden rounded-full bg-[var(--surface-container)] px-3 py-1 text-xs font-semibold text-[var(--t2)] sm:inline-flex">
                    {child.class_name}
                  </span>
                )}
              </div>
              <ChildSelector />
              {child?.class_name && <p className="mt-2 text-xs text-[var(--t3)] sm:hidden">{child.class_name}</p>}
            </section>

            <section aria-label="Learner overview" className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--sh1)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--t3)]">
                  Today&apos;s attendance
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <MaterialIcon
                    icon={
                      attendanceStatus === "present"
                        ? "check_circle"
                        : attendanceStatus === "absent"
                          ? "cancel"
                          : attendanceStatus === "late"
                            ? "schedule"
                            : "info"
                    }
                    size={26}
                    className={
                      attendanceStatus === "present"
                        ? "text-[var(--green)]"
                        : attendanceStatus === "absent"
                          ? "text-[var(--red)]"
                          : "text-[var(--primary)]"
                    }
                  />
                  <p className="text-lg font-bold text-[var(--t1)]">
                    {childDataLoading
                      ? "Checking…"
                      : attendanceStatus
                        ? attendanceStatus.charAt(0).toUpperCase() + attendanceStatus.slice(1)
                        : "Not recorded yet"}
                  </p>
                </div>
                <p className="mt-2 text-xs text-[var(--t3)]">
                  {todayAttendance?.notes ||
                    (attendanceStatus
                      ? "Attendance recorded for today."
                      : "The school has not recorded attendance today.")}
                </p>
              </article>

              <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--sh1)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--t3)]">Academic updates</p>
                <div className="mt-3 flex items-center gap-3">
                  <MaterialIcon icon="trending_up" size={26} className="text-[var(--primary)]" />
                  <p className="text-lg font-bold text-[var(--t1)]">
                    {childDataLoading
                      ? "Loading results…"
                      : grades.length
                        ? `${grades.length} recent result${grades.length === 1 ? "" : "s"}`
                        : "No results recorded yet"}
                  </p>
                </div>
                <p className="mt-2 text-xs text-[var(--t3)]">
                  Open results to see marks and report cards shared by the school.
                </p>
              </article>
            </section>

            <section
              aria-label="Fee balance"
              className="rounded-2xl bg-[#0045ad] p-5 text-white shadow-[var(--sh2)] sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">
                    Outstanding fee balance
                  </p>
                  <p className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
                    {childDataLoading
                      ? "Updating…"
                      : feeStats.status === "unknown"
                        ? "Not available"
                        : `UGX ${feeStats.balance.toLocaleString()}`}
                  </p>
                  <p className="mt-3 text-xs text-white/80">
                    {feeStats.status === "unknown"
                      ? "The school has not shared a current fee statement."
                      : hasFeeBalance
                        ? `Paid so far: UGX ${feeStats.totalPaid.toLocaleString()}${nextDue ? ` · Next due ${nextDue.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}` : ""}`
                        : "No outstanding balance is recorded."}
                  </p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10" aria-hidden="true">
                  <MaterialIcon icon="account_balance_wallet" size={23} />
                </span>
              </div>
              <button
                type="button"
                onClick={handlePayFees}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#0045ad] transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <MaterialIcon icon="payments" size={19} />
                {hasFeeBalance ? "View and pay fees" : "View fee details"}
              </button>
            </section>

            <section aria-labelledby="parent-quick-links" className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 id="parent-quick-links" className="text-lg font-bold text-[var(--t1)]">
                    Quick links
                  </h2>
                  <p className="mt-0.5 text-sm text-[var(--t3)]">Go straight to the information you need.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  {
                    href: "/parent-portal/results",
                    label: "Results",
                    icon: "grade",
                    tone: "text-[var(--primary)] bg-[var(--primary-50)]",
                  },
                  {
                    href: "/parent-portal/homework",
                    label: "Homework",
                    icon: "assignment",
                    tone: "text-[#9a5a00] bg-[#fff5e6]",
                  },
                  {
                    href: "/parent-portal/attendance",
                    label: "Attendance",
                    icon: "history",
                    tone: "text-[#168878] bg-[#e8f7f4]",
                  },
                  {
                    href: "/parent-portal/messages",
                    label: "Messages",
                    icon: "chat_bubble",
                    tone: "text-[#6650a4] bg-[#f2effb]",
                  },
                ].map((action) => (
                  <Link
                    key={action.href}
                    href={`${action.href}${selectedChild ? `?child=${selectedChild.id}` : ""}`}
                    className="flex min-h-[112px] flex-col items-start justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm font-bold text-[var(--t1)] shadow-[var(--sh1)] transition hover:border-[var(--border2)] hover:bg-[var(--surface-container-low)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] sm:min-h-[124px] sm:p-5"
                  >
                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${action.tone}`}>
                      <MaterialIcon icon={action.icon} size={23} />
                    </span>
                    <span className="mt-3 flex w-full items-center justify-between gap-2">
                      {action.label}
                      <MaterialIcon icon="arrow_forward" size={17} className="text-[var(--t3)]" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            <section aria-label="Canteen wallet and school notices" className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
              <article className="flex flex-col justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--sh1)] sm:flex-row sm:items-center lg:flex-col lg:items-start">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-container)] text-[var(--primary)]">
                    <MaterialIcon icon="wallet" size={22} />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-[var(--t1)]">Canteen wallet</h2>
                    <p className="mt-1 text-lg font-bold text-[var(--t1)]">
                      {walletBalance === null ? "Balance not available" : `UGX ${walletBalance.toLocaleString()}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTopup(true)}
                  disabled={!selectedChild || !isOnline}
                  className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--surface-container-low)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add pocket money
                </button>
              </article>

              <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--sh1)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-[var(--t1)]">School notices</h2>
                    <p className="mt-0.5 text-xs text-[var(--t3)]">Updates shared by your school.</p>
                  </div>
                  <Link
                    href="/parent-portal/notices"
                    className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--surface-container-low)]"
                  >
                    View all <MaterialIcon icon="arrow_forward" size={16} />
                  </Link>
                </div>
                {notices.length ? (
                  <div className="mt-3 divide-y divide-[var(--border)]">
                    {notices.slice(0, 3).map((notice, index) => (
                      <div key={`${notice.title}-${notice.created_at}-${index}`} className="py-3 first:pt-2 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-semibold text-[var(--t1)]">{notice.title}</h3>
                          <time className="shrink-0 text-[11px] text-[var(--t3)]" dateTime={notice.created_at}>
                            {new Date(notice.created_at).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </time>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--t3)]">{notice.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl bg-[var(--surface-container-low)] px-3 py-4 text-sm text-[var(--t3)]">
                    No school notices to show right now.
                  </p>
                )}
                {notifications.length > 0 && (
                  <Link
                    href="/parent-portal/messages"
                    className="mt-3 inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-[var(--primary)]"
                  >
                    {unreadCount
                      ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}`
                      : `${notifications.length} recent updates`}
                    <MaterialIcon icon="arrow_forward" size={15} />
                  </Link>
                )}
              </article>
            </section>
          </>
        )}
      </div>

      <Modal
        isOpen={showTopup}
        onClose={() => setShowTopup(false)}
        title="Add Pocket Money"
        size="sm"
        className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto"
      >
        <div className="space-y-6">
          <p className="text-sm text-[var(--t3)] font-medium">
            Funds will be available immediately in {selectedChild?.first_name}&apos;s digital wallet.
          </p>
          <label htmlFor="parent-wallet-topup-amount" className="sr-only">
            Amount in Ugandan shillings
          </label>
          <input
            id="parent-wallet-topup-amount"
            type="number"
            inputMode="numeric"
            min="1"
            step="1000"
            value={topupAmount}
            onChange={(e) => setTopupAmount(e.target.value)}
            placeholder="Amount (UGX)"
            className="w-full px-6 py-4 bg-[var(--surface-container-low)] border border-[var(--border)] rounded-xl text-2xl font-bold outline-none focus:ring-2 focus:ring-blue-900"
          />
          <div className="flex gap-2 flex-wrap" aria-label="Suggested top-up amounts">
            {[1000, 2000, 5000, 10000, 20000].map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setTopupAmount(a.toString())}
                aria-label={`Set amount to ${a.toLocaleString()} Ugandan shillings`}
                className="flex-1 min-w-[64px] py-3 rounded-xl border border-[var(--border)] text-sm font-bold text-[var(--t2)] hover:border-blue-900 hover:text-blue-900 transition-colors"
              >
                +{a / 1000}k
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleTopup}
            disabled={!topupAmount || Number(topupAmount) <= 0 || topupLoading}
            className="w-full py-4 bg-blue-900 text-white rounded-xl font-bold uppercase tracking-wide hover:bg-blue-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {topupLoading ? (
              <span
                role="status"
                aria-label="Processing top-up"
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
              />
            ) : (
              <>
                <MaterialIcon icon="bolt" /> Confirm Top-up
              </>
            )}
          </button>
        </div>
      </Modal>
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
