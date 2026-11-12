"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import OwlMascot from "@/components/brand/OwlMascot";
import MaterialIcon from "@/components/MaterialIcon";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { ChildSelector } from "@/components/parent-portal/ChildSelector";
import ParentMobileMoneyCheckout from "@/components/parent-portal/ParentMobileMoneyCheckout";
import { useParentPortal } from "@/components/parent-portal/ParentPortalProvider";
import ParentPortalShell from "@/components/parent-portal/ParentPortalShell";
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
  ParentPortalChild,
  ParentPortalFeeStructureItem,
  ParentPortalGradeRecord,
  ParentPortalNotice,
  ParentPortalPayment,
  pickPreferredSchemaRows,
} from "@/lib/parent-portal";
import { cacheAside } from "@/lib/cache";
import { supabase } from "@/lib/supabase";

/**
 * The child's face, with initials when the school has not uploaded a photo.
 * Plain <img> on purpose: parent photos come from storage URLs the image
 * optimiser has no allow-list for, and the shell already renders the same way.
 */
function ChildAvatar({ child, size = 56 }: { child: ParentPortalChild; size?: number }) {
  const [failed, setFailed] = useState(false);
  const photo = child.photo_url || child.avatar_url;

  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="shrink-0 rounded-2xl object-cover ring-1 ring-[var(--border)]"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-container-low)] font-semibold text-[var(--t3)] ring-1 ring-[var(--border)]"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {child.first_name?.[0]}
      {child.last_name?.[0]}
    </span>
  );
}

function ParentDashboardContent() {
  const { user, isDemo } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { children, selectedChild, loading: childrenLoading } = useParentPortal();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [showTopup, setShowTopup] = useState(false);
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
        const noticeData = await cacheAside(
          `notices:${schoolId}`,
          async () => {
            const { data, error } = await withTimeout(
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
            if (error || !data) return [];
            return data;
          },
          { ttl: 300 },
        );
        setNotices(noticeData as ParentPortalNotice[]);
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

  const handleWalletPaymentConfirmed = useCallback(
    async (amount: number) => {
      setWalletBalance((previous) => (previous ?? 0) + amount);
      if (selectedChild && !isDemo) {
        const { data } = await supabase
          .from("student_wallets")
          .select("balance")
          .eq("student_id", selectedChild.id)
          .maybeSingle();
        if (data) setWalletBalance(Number(data.balance || 0));
      }
    },
    [selectedChild, isDemo],
  );

  const handlePayFees = () => {
    if (!selectedChild || feeStats.balance <= 0) {
      toast.info("There is nothing left to pay right now.");
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

  const childFirstName = child?.first_name || "your child";
  const parentFirstName = user?.full_name?.trim().split(/\s+/)[0] || "";
  const attendanceTone =
    attendanceStatus === "present"
      ? "bg-[var(--green-soft)] text-[var(--green-ink)]"
      : attendanceStatus === "absent"
        ? "bg-[var(--red-soft)] text-[var(--red-ink)]"
        : attendanceStatus === "late"
          ? "bg-[var(--amber-soft)] text-[var(--amber-ink)]"
          : "bg-[var(--surface-container-low)] text-[var(--t2)]";
  const attendanceLabel = childDataLoading
    ? "Checking…"
    : attendanceStatus
      ? attendanceStatus.charAt(0).toUpperCase() + attendanceStatus.slice(1)
      : "Not recorded";
  const feePercent =
    feeStats.status !== "unknown" && feeStats.expected > 0
      ? Math.min(100, Math.round((feeStats.totalPaid / feeStats.expected) * 100))
      : 0;

  return (
    <ParentPortalShell pageTitle="Home">
      <div className="flex w-full flex-col gap-4 px-4 pb-4 pt-5 sm:gap-5 sm:px-6 sm:pt-6 lg:px-8">
        <header>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[var(--t1)] sm:text-2xl">
            Welcome back{parentFirstName ? `, ${parentFirstName}` : ""}
          </h1>
          <p className="mt-1 text-[13.5px] leading-6 text-[var(--t3)]">
            {child
              ? `Here is how things are going for ${childFirstName}${child.class_name ? ` in ${child.class_name}` : ""}.`
              : "Here is what your school has shared with you."}
          </p>
        </header>

        {childrenLoading ? (
          <div className="flex min-h-[8.5rem] items-center justify-center rounded-[18px] border border-[var(--border)] bg-[var(--surface)]">
            <div
              className="flex items-center gap-3 text-[13.5px] font-medium text-[var(--t3)]"
              role="status"
              aria-live="polite"
            >
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border2)] border-t-[var(--primary)]" />
              Getting your child&apos;s details…
            </div>
          </div>
        ) : children.length === 0 ? (
          <section className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-5 py-8 text-center shadow-[var(--sh1)] sm:px-8">
            <OwlMascot size={54} premium ring glow animated />
            <h2 className="mt-4 text-[17px] font-semibold text-[var(--t1)]">We cannot see your child yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-6 text-[var(--t3)]">
              Your phone number is not linked to your child at school. Ask the school office to add it, then come back
              and sign in again.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-600)]"
            >
              Sign in again
            </Link>
          </section>
        ) : (
          <>
            {/* Who this page is about. Identity first, because every number
                below belongs to this one child. */}
            <section
              aria-label="Your child"
              className="overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--sh1)]"
            >
              <div className="flex items-start gap-3.5 p-4 sm:gap-4 sm:p-5">
                {child && <ChildAvatar child={child} size={56} />}
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[18px] font-semibold leading-snug tracking-[-0.01em] text-[var(--t1)] sm:text-[19px]">
                    {child?.first_name} {child?.last_name}
                  </h2>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-[var(--t3)]">
                    <span className="inline-flex items-center gap-1">
                      <MaterialIcon icon="school" size={14} className="shrink-0" />
                      {child?.class_name || "Class not set"}
                    </span>
                    {child?.student_number ? (
                      <>
                        <span aria-hidden="true" className="text-[var(--t4)]">
                          ·
                        </span>
                        <span className="font-mono text-[12px]">{child.student_number}</span>
                      </>
                    ) : null}
                  </p>
                  <span
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium ${attendanceTone}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        attendanceStatus === "present"
                          ? "bg-[var(--green)]"
                          : attendanceStatus === "absent"
                            ? "bg-[var(--red)]"
                            : attendanceStatus === "late"
                              ? "bg-[var(--amber)]"
                              : "bg-[var(--t4)]"
                      }`}
                    />
                    {attendanceLabel} today
                  </span>
                </div>
              </div>
              {children.length > 1 && (
                <div className="border-t border-[var(--border)] px-4 py-3 sm:px-5">
                  <p className="mb-2 text-[11.5px] text-[var(--t4)]">You are following more than one child</p>
                  <ChildSelector label="child" />
                </div>
              )}
            </section>

            {/* Money first after identity: it is the one thing a parent is
                usually checking for. Statement, not an advert. */}
            <section
              aria-label="School fees"
              className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--sh1)] sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--t3)]">School fees</p>
                  <p className="mt-1 text-[26px] font-semibold leading-none tracking-[-0.02em] text-[var(--t1)]">
                    {childDataLoading ? (
                      <span className="text-[var(--t3)]">Checking…</span>
                    ) : feeStats.status === "unknown" ? (
                      <span className="text-[18px] font-medium text-[var(--t2)]">No statement yet</span>
                    ) : hasFeeBalance ? (
                      `UGX ${feeStats.balance.toLocaleString()}`
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400">Fully paid</span>
                    )}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-5 text-[var(--t3)]">
                    {feeStats.status === "unknown"
                      ? `The school has not shared a fee statement for ${childFirstName} yet.`
                      : hasFeeBalance
                        ? `Left to pay${nextDue ? ` · due ${nextDue.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}` : ""}`
                        : "Nothing outstanding. Thank you for keeping up to date."}
                  </p>
                </div>
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-container-low)] text-[var(--t3)]"
                  aria-hidden="true"
                >
                  <MaterialIcon icon="receipt_long" size={20} />
                </span>
              </div>

              {feeStats.status !== "unknown" && (
                <div className="mt-3.5">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-container-low)]">
                    <div
                      className={`h-full rounded-full ${hasFeeBalance ? "bg-[var(--primary)]" : "bg-emerald-500"}`}
                      style={{ width: `${feePercent}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-[var(--t4)]">
                    UGX {feeStats.totalPaid.toLocaleString()} paid of UGX {feeStats.expected.toLocaleString()}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handlePayFees}
                className="mt-3.5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-600)]"
              >
                {hasFeeBalance ? "Pay fees" : "See fee details"}
              </button>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <article className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--sh1)]">
                <p className="text-[13px] font-medium text-[var(--t3)]">Results</p>
                <p className="mt-1 text-[17px] font-semibold text-[var(--t1)]">
                  {childDataLoading
                    ? "Checking…"
                    : grades.length
                      ? `${grades.length} result${grades.length === 1 ? "" : "s"} shared`
                      : "Nothing shared yet"}
                </p>
                <p className="mt-1 text-[12.5px] leading-5 text-[var(--t3)]">
                  Marks and report cards the school has shared with you.
                </p>
                <Link
                  href={`/parent-portal/results${selectedChild ? `?child=${selectedChild.id}` : ""}`}
                  className="mt-2 inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-[var(--primary)]"
                >
                  See progress
                  <MaterialIcon icon="arrow_forward" size={15} />
                </Link>
              </article>

              <article className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--sh1)]">
                <p className="text-[13px] font-medium text-[var(--t3)]">Pocket money</p>
                <p className="mt-1 text-[17px] font-semibold text-[var(--t1)]">
                  {walletBalance === null ? "Not available" : `UGX ${walletBalance.toLocaleString()}`}
                </p>
                <p className="mt-1 text-[12.5px] leading-5 text-[var(--t3)]">
                  For meals and snacks at the school canteen.
                </p>
                <button
                  type="button"
                  onClick={() => setShowTopup(true)}
                  disabled={!selectedChild || !isOnline}
                  className="mt-2 inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add money
                  <MaterialIcon icon="add" size={15} />
                </button>
              </article>
            </div>

            <section aria-label="More about your child" className="space-y-2.5">
              <h2 className="text-[15px] font-semibold text-[var(--t1)]">More</h2>
              <div className="divide-y divide-[var(--border)] overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--sh1)]">
                {[
                  {
                    href: "/parent-portal/attendance",
                    label: "Attendance",
                    hint: "Every day this term",
                    icon: "fact_check",
                  },
                  { href: "/parent-portal/homework", label: "Homework", hint: "What is due", icon: "assignment" },
                  { href: "/parent-portal/timetable", label: "Timetable", hint: "The school day", icon: "schedule" },
                  { href: "/parent-portal/events", label: "School calendar", hint: "Events and dates", icon: "event" },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={`${item.href}${selectedChild ? `?child=${selectedChild.id}` : ""}`}
                    className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--surface-container-low)]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-container-low)] text-[var(--t3)]">
                      <MaterialIcon icon={item.icon} size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-[var(--t1)]">{item.label}</span>
                      <span className="block truncate text-[12px] text-[var(--t4)]">{item.hint}</span>
                    </span>
                    <MaterialIcon icon="chevron_right" size={18} className="shrink-0 text-[var(--t4)]" />
                  </Link>
                ))}
              </div>
            </section>

            <section
              aria-labelledby="parent-school-updates"
              className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--sh1)] sm:p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 id="parent-school-updates" className="text-[15px] font-semibold text-[var(--t1)]">
                  From school
                </h2>
                <Link
                  href="/parent-portal/notices"
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--surface-container-low)]"
                >
                  All notices
                  <MaterialIcon icon="arrow_forward" size={15} />
                </Link>
              </div>
              {notices.length ? (
                <div className="mt-1 divide-y divide-[var(--border)]">
                  {notices.slice(0, 3).map((notice, index) => (
                    <div key={`${notice.title}-${notice.created_at}-${index}`} className="py-3 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-[14px] font-medium text-[var(--t1)]">{notice.title}</h3>
                        <time className="shrink-0 text-[11.5px] text-[var(--t4)]" dateTime={notice.created_at}>
                          {new Date(notice.created_at).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </time>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[12.5px] leading-5 text-[var(--t3)]">{notice.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-[var(--surface-container-low)] px-3 py-3.5 text-[13px] text-[var(--t3)]">
                  Nothing new from the school right now.
                </p>
              )}
              {notifications.length > 0 && (
                <Link
                  href="/parent-portal/messages"
                  className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-[12.5px] font-semibold text-[var(--primary)]"
                >
                  {urgentUnreads
                    ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}`
                    : `${notifications.length} recent update${notifications.length === 1 ? "" : "s"}`}
                  <MaterialIcon icon="arrow_forward" size={15} />
                </Link>
              )}
            </section>
          </>
        )}
      </div>

      <ParentMobileMoneyCheckout
        isOpen={showTopup}
        onClose={() => setShowTopup(false)}
        child={selectedChild}
        purpose="wallet_topup"
        isDemo={isDemo}
        onPaymentConfirmed={handleWalletPaymentConfirmed}
      />
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
