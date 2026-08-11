"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SidebarShell from "@/components/dashboard/SidebarShell";
import TopBar from "@/components/dashboard/TopBar";
import MaterialIcon from "@/components/MaterialIcon";
import OwlMascot from "@/components/brand/OwlMascot";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { useParentPortalGuard } from "@/lib/hooks/useParentPortalGuard";
import { useToast } from "@/components/Toast";
import { logger } from "@/lib/logger";
import { normalizeAuthPhone } from "@/lib/validation";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import {
  calculateFeeStats,
  mapParentStudentLinks,
  normalizeFeeTermItems,
  normalizePayments,
  normalizeGrades,
  pickPreferredSchemaRows,
  ParentPortalAttendanceRecord,
  ParentPortalChild,
  ParentPortalFeeStructureItem,
  ParentPortalGradeRecord,
  ParentPortalNotice,
  ParentPortalPayment,
  resolveSelectedChild,
} from "@/lib/parent-portal";

function ParentDashboardContent() {
  const { user, isDemo, signOut } = useAuth();
  const { isAuthorized, isChecking } = useParentPortalGuard();
  const { close: closeSidebar } = useSidebar();
  const router = useRouter();
  const toast = useToast();
  const [children, setChildren] = useState<ParentPortalChild[]>([]);
  const [selectedChild, setSelectedChild] = useState<ParentPortalChild | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
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
    async function fetchChildren() {
      if (isDemo) {
        const demoChildren = [
          {
            id: "child-1",
            first_name: "Isaac",
            last_name: "Mugisha",
            class_name: "P.5 Blue",
            attendance: "94%",
            fees_balance: "120,000 UGX",
            next_exam: "Mid-Term Exams (April 15)",
            avatar_url: null,
          },
        ];
        setChildren(demoChildren);
        setSelectedChild(demoChildren[0]);
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
        setLoading(false);
        return;
      }

      if (user) {
        try {
          const parentId = user.id;
          // Fetch linked children
          const { data: parentLinks } = await supabase
            .from("parent_students")
            .select("student:students(*, class:classes(name))")
            .eq("parent_id", parentId);

          let list = mapParentStudentLinks(parentLinks || []);

          // Auto-link: if no links found, try matching parent phone to students
          if (list.length === 0 && user.phone) {
            const normalized = normalizeAuthPhone(user.phone);
            if (normalized) {
              const last9 = normalized.slice(-9);

              let { data: matchedStudents } = await supabase
                .from("students")
                .select("id, parent_phone, parent_phone2, school_id")
                .eq("status", "active")
                // Restrict auto-link matching to the parent's school to avoid
                // linking across schools when phone numbers overlap.
                .eq("school_id", user.school_id || "")
                .or(`parent_phone.eq.${normalized},parent_phone2.eq.${normalized}`);

              if (!matchedStudents?.length && last9) {
                const { data: fuzzyMatches } = await supabase
                  .from("students")
                  .select("id, parent_phone, parent_phone2, school_id")
                  .eq("status", "active")
                  .eq("school_id", user.school_id || "");
                matchedStudents =
                  fuzzyMatches?.filter(
                    (s) => s.parent_phone?.slice(-9) === last9 || s.parent_phone2?.slice(-9) === last9,
                  ) || null;
              }

              if (matchedStudents && matchedStudents.length > 0) {
                const links = matchedStudents.map((s) => ({
                  parent_id: parentId,
                  student_id: s.id,
                  relationship: "parent",
                }));
                const { data: linkData, error: linkErr } = await supabase
                  .from("parent_students")
                  .insert(links)
                  .select("student:students(*, class:classes(name))");

                if (!linkErr && linkData) {
                  const { data: newLinks } = await supabase
                    .from("parent_students")
                    .select("student:students(*, class:classes(name))")
                    .eq("parent_id", parentId);
                  if (newLinks) list = mapParentStudentLinks(newLinks);
                } else if (linkErr) {
                  logger.warn("[parent-portal] auto-link insert failed:", linkErr);
                }
              }
            }
          }

          setChildren(list);

          // Fetch notices intended for parents only (filtered by target_audience)
          try {
            const schoolId = list[0]?.school_id;
            if (schoolId) {
              const { data: noticeData, error: noticeErr } = await supabase
                .from("notices")
                .select("title, content, created_at, category")
                .eq("school_id", schoolId)
                .in("target_audience", ["all", "parents"])
                .order("created_at", { ascending: false })
                .limit(5);

              if (!noticeErr && noticeData) {
                setNotices(noticeData);
              }
            }
          } catch (noticeErr) {
            logger.warn("Failed to fetch parent notices:", noticeErr);
            setNotices([]);
          }
        } catch (err) {
          logger.error("Fetch children error:", err);
        } finally {
          setLoading(false);
        }
      }
    }

    fetchChildren();
  }, [user, isDemo]);

  useEffect(() => {
    setSelectedChild((current) => resolveSelectedChild(children, current?.id));
  }, [children]);

  // Fetch student specific data when selected child changes
  useEffect(() => {
    if (!selectedChild || isDemo) return;
    const selectedChildId = selectedChild.id;
    setChildDataLoading(true);

    async function fetchStudentData() {
      const scopedChild = resolveSelectedChild(children, selectedChildId);
      if (!scopedChild) {
        setChildDataLoading(false);
        return;
      }
      try {
        const attRes = await withTimeout(
          supabase.from("attendance").select("id, date, status, remarks").eq("student_id", scopedChild.id).limit(10),
          15000,
          timeoutFallback(),
        );
        const gradesRes = await withTimeout(
          supabase
            .from("grades")
            .select("id, score, max_score, grade, term, exam_type, teacher_comment, subjects(name)")
            .eq("student_id", scopedChild.id)
            .limit(6),
          15000,
          timeoutFallback(),
        );

        const modernFeeTermsRes = await withTimeout(
          supabase
            .from("student_fee_terms")
            .select("id, final_amount, academic_year, fee_terms(name)")
            .eq("student_id", scopedChild.id)
            .order("created_at", { ascending: false }),
          15000,
          timeoutFallback(),
        );
        const modernPaymentsRes = await withTimeout(
          supabase
            .from("fee_payments")
            .select(
              "id, amount, payment_date, payment_method, transaction_reference, student_fee_terms!inner(student_id, fee_terms(name))",
            )
            .eq("student_fee_terms.student_id", scopedChild.id)
            .order("payment_date", { ascending: false }),
          15000,
          timeoutFallback(),
        );
        const legacyPaymentsRes = await withTimeout(
          supabase
            .from("fee_payments")
            .select("id, amount_paid, payment_date, payment_method, payment_reference")
            .eq("student_id", scopedChild.id),
          15000,
          timeoutFallback(),
        );
        const legacyFeeTermsRes = await withTimeout(
          supabase
            .from("fee_structure")
            .select("*")
            .eq("school_id", scopedChild.school_id)
            .is("deleted_at", null)
            .or(`class_id.is.null,class_id.eq.${scopedChild.class_id}`),
          15000,
          timeoutFallback(),
        );

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
  }, [selectedChild, isDemo, children]);

  // Fetch wallet when child changes
  useEffect(() => {
    if (!selectedChild || isDemo) {
      if (isDemo) setWalletBalance(8500); // demo balance
      return;
    }
    const scopedChild = resolveSelectedChild(children, selectedChild.id);
    if (!scopedChild) return;
    supabase
      .from("student_wallets")
      .select("balance")
      .eq("student_id", scopedChild.id)
      .maybeSingle()
      .then(({ data }) => setWalletBalance(data?.balance ?? 0));
  }, [selectedChild, isDemo, children]);

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
    if (isDemo || !user?.id) return;
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
  }, [user?.id, isDemo, toast]);

  const markNotificationRead = async (id: string) => {
    await fetch("/api/parent/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_id: id }),
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

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
      const { error } = await supabase.rpc("topup_student_wallet", {
        p_student_id: selectedChild.id,
        p_amount: parseFloat(topupAmount),
        p_description: "Top-up by Parent via Portal",
        p_ref: `PAR-${Date.now()}`,
      });
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

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <OwlMascot size={52} premium ring glow animated />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-[var(--portal-border)] bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-[var(--portal-danger-soft)] text-[var(--portal-danger)] flex items-center justify-center">
            <MaterialIcon icon="lock" />
          </div>
          <h2 className="text-lg font-bold text-[var(--portal-ink)]">Parent portal access unavailable</h2>
          <p className="mt-2 text-sm text-[var(--portal-ink-soft)]">
            Please contact your school if you believe this is a mistake.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex rounded-xl bg-[var(--portal-ink)] px-4 py-2 text-sm font-semibold text-white"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const childPhotoUrl = selectedChild?.photo_url || selectedChild?.avatar_url || null;
  const childInitials = selectedChild ? `${selectedChild.first_name[0]}${selectedChild.last_name[0]}` : "";
  const todayDate = new Date().toISOString().split("T")[0];
  const todayAttendance = attendance.find((record) => record.date === todayDate) ?? null;
  const attendanceStatus = todayAttendance?.status ?? null;
  const hasFeeBalance = feeStats.balance > 0;
  const urgentUnreads = unreadCount > 0;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SidebarShell onNavigate={() => closeSidebar()} />
      <SidebarOverlay />

      <main
        id="main-content"
        className="main-content mobile-container ml-[var(--sidebar-width)] flex-1 flex flex-col min-h-screen w-[calc(100%-var(--sidebar-width))] overflow-hidden"
      >
        <TopBar pageTitle="Parent Portal" onSignOut={handleSignOut} />

        <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-8">
            <section className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--portal-muted)]">
                    Parent Portal
                  </p>
                  <h1 className="mt-2 text-3xl font-bold text-[var(--portal-ink)]">
                    Welcome back, {user?.full_name?.split(" ")[0] || "Parent"}
                  </h1>
                  <p className="mt-3 max-w-2xl text-base text-[var(--portal-ink-soft)]">
                    Keep track of your child&apos;s attendance, fees, homework, and school updates in one place.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                  <button
                    type="button"
                    onClick={() => handleSignOut()}
                    className="rounded-2xl bg-[var(--portal-warning-soft-2)] px-4 py-3 text-sm font-semibold text-[var(--portal-warning)] transition hover:bg-[var(--portal-warning-border)]"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </section>

            {loading ? (
              <div className="flex items-center justify-center min-h-[300px]">
                <OwlMascot size={52} premium ring glow animated />
              </div>
            ) : children.length === 0 ? (
              <div className="text-center py-10 rounded-[28px] border border-[var(--portal-border)] bg-white p-8 shadow-sm">
                <OwlMascot size={56} premium ring glow animated />
                <h3 className="text-lg font-bold mt-4 text-[var(--portal-ink)]">No learners linked yet</h3>
                <p className="text-sm text-[var(--portal-ink-soft)] mt-1">Your phone on file: {user?.phone || "N/A"}</p>
                <p className="text-sm text-[var(--portal-ink-soft)] mt-2">
                  Contact the school office to link your account and access the portal.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                <section
                  aria-labelledby="learner-selector"
                  className="rounded-[28px] border border-[var(--portal-border)] bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4 pb-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.20em] text-[var(--portal-muted)]">
                        Learners
                      </p>
                      <h2 id="learner-selector" className="mt-2 text-xl font-bold text-[var(--portal-ink)]">
                        Choose a learner to view details
                      </h2>
                    </div>
                    <p className="text-sm text-[var(--portal-ink-soft)]">Tap a card to switch learner data.</p>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {children.map((child) => {
                      const isSelected = selectedChild?.id === child.id;
                      return (
                        <button
                          key={child.id}
                          onClick={() => setSelectedChild(child)}
                          className={`shrink-0 rounded-[24px] border-2 p-4 min-w-[160px] text-left transition-all ${
                            isSelected
                              ? "border-[var(--portal-ink)] bg-[var(--portal-surface-tint)] shadow-md"
                              : "border-[var(--portal-border)] bg-white hover:border-[var(--portal-border-strong)]"
                          }`}
                        >
                          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[var(--portal-ink)] text-xl font-bold text-white">
                            {child.photo_url ? (
                              <Image
                                src={child.photo_url}
                                alt={`${child.first_name} ${child.last_name}`}
                                width={56}
                                height={56}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span>{child.first_name?.[0] || child.last_name?.[0] || "?"}</span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-[var(--portal-ink)] text-center">
                            {child.first_name} {child.last_name}
                          </p>
                          <p className="text-[11px] text-[var(--portal-muted)] text-center">{child.class_name}</p>
                        </button>
                      );
                    })}
                  </div>
                </section>

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

                    <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-sm">
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
                    <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-sm">
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
                    <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-sm">
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
      </main>
    </div>
  );
}

function SidebarOverlay() {
  const { isOpen, close } = useSidebar();
  return (
    <button
      type="button"
      className={`sidebar-overlay ${isOpen ? "visible" : ""}`}
      aria-label="Close navigation"
      onClick={close}
    />
  );
}

export default function ParentPortal() {
  return (
    <PageErrorBoundary>
      <SidebarProvider>
        <ParentDashboardContent />
      </SidebarProvider>
    </PageErrorBoundary>
  );
}
