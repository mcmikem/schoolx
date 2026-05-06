"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SidebarShell from "@/components/dashboard/SidebarShell";
import TopBar from "@/components/dashboard/TopBar";
import MaterialIcon from "@/components/MaterialIcon";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { useParentPortalGuard } from "@/lib/hooks/useParentPortalGuard";
import { useToast } from "@/components/Toast";
import { logger } from "@/lib/logger";
import {
  calculateFeeStats,
  mapParentStudentLinks,
  normalizeFeeTermItems,
  normalizePayments,
  normalizeGrades,
  pickPreferredSchemaRows,
  ParentPortalAttendanceRecord,
  ParentPortalChild,
  ParentPortalGradeRecord,
  ParentPortalNotice,
  resolveSelectedChild,
} from "@/lib/parent-portal";

function ParentDashboardContent() {
  const { user, isDemo, signOut } = useAuth();
  const { isAuthorized, isChecking } = useParentPortalGuard();
  const { close: closeSidebar } = useSidebar();
  const router = useRouter();
  const toast = useToast();
  const [children, setChildren] = useState<ParentPortalChild[]>([]);
  const [selectedChild, setSelectedChild] = useState<ParentPortalChild | null>(
    null,
  );
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [notices, setNotices] = useState<ParentPortalNotice[]>([]);
  const [attendance, setAttendance] = useState<ParentPortalAttendanceRecord[]>(
    [],
  );
  const [grades, setGrades] = useState<ParentPortalGradeRecord[]>([]);
  const [feeStats, setFeeStats] = useState({ totalPaid: 0, totalFee: 0, balance: 0, status: 'unknown' });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

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
          { title: "Easter Break", content: "School will be closed from Friday to Monday. Happy Holidays!", created_at: new Date().toISOString() },
          { title: "Visitation Day", content: "Parents are invited to check student progress this Saturday.", created_at: new Date().toISOString() }
        ]);
        setFeeStats({
           totalPaid: 1080000,
           totalFee: 1200000,
           balance: 120000,
           status: 'pending'
        });
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

          const list = mapParentStudentLinks(parentLinks || []);
          setChildren(list);

          // Fetch Global Notices
          const schoolId = list[0]?.school_id || null;
          if (schoolId) {
            const { data: noticesData } = await supabase
              .from("notices")
              .select("*")
              .eq("school_id", schoolId)
              .eq("is_active", true)
              .order("created_at", { ascending: false })
              .limit(5);
            setNotices(noticesData || []);
          } else {
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

    async function fetchStudentData() {
      const scopedChild = resolveSelectedChild(children, selectedChildId);
      if (!scopedChild) return;
      try {
        const attRes = await Promise.resolve(supabase.from("attendance").select("id, date, status, remarks").eq("student_id", scopedChild.id).limit(10)).catch((err: unknown) => { logger.error("Attendance fetch error:", err); return { data: null, error: err }; });
        const gradesRes = await Promise.resolve(supabase.from("grades").select("id, score, max_score, grade, term, exam_type, teacher_comment, subjects(name)").eq("student_id", scopedChild.id).limit(6)).catch((err: unknown) => { logger.error("Grades fetch error:", err); return { data: null, error: err }; });

        const modernFeeTermsRes = await Promise.resolve(supabase
          .from("student_fee_terms")
          .select("id, final_amount, academic_year, fee_terms(name)")
          .eq("student_id", scopedChild.id)
          .order("created_at", { ascending: false })).catch((err: unknown) => { logger.error("Fee terms fetch error:", err); return { data: null, error: err }; });
        const modernPaymentsRes = await Promise.resolve(supabase
          .from("fee_payments")
          .select(
            "id, amount, payment_date, payment_method, transaction_reference, student_fee_terms!inner(student_id, fee_terms(name))",
          )
          .eq("student_fee_terms.student_id", scopedChild.id)
          .order("payment_date", { ascending: false })).catch((err: unknown) => { logger.error("Modern payments fetch error:", err); return { data: null, error: err }; });
        const legacyPaymentsRes = await Promise.resolve(supabase
          .from("fee_payments")
          .select(
            "id, amount_paid, payment_date, payment_method, payment_reference",
          )
          .eq("student_id", scopedChild.id)).catch((err: unknown) => { logger.error("Legacy payments fetch error:", err); return { data: null, error: err }; });
        const legacyFeeTermsRes = await Promise.resolve(supabase
          .from("fee_structure")
          .select("*")
          .eq("school_id", scopedChild.school_id)
          .is("deleted_at", null)
          .or(`class_id.is.null,class_id.eq.${scopedChild.class_id}`)).catch((err: unknown) => { logger.error("Fee structure fetch error:", err); return { data: null, error: err }; });

        const normalizedFeeStructure = pickPreferredSchemaRows({
          modernRows: normalizeFeeTermItems(
            (modernFeeTermsRes.data || []) as never[],
          ),
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
        setFeeStats(calculateFeeStats(normalizedFeeStructure, normalizedPayments));
      } catch (err) {
        logger.error("Fetch student data error:", err);
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
        { id: "1", type: "grade_posted", title: "New Grade Posted", message: "Math exam results ready", is_read: false, created_at: new Date().toISOString() },
        { id: "2", type: "payment_received", title: "Payment Received", message: "UGX 50,000 received", is_read: true, created_at: new Date(Date.now() - 86400000).toISOString() },
      ]);
      setUnreadCount(1);
      return;
    }
    fetch("/api/parent/notifications?limit=10")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setNotifications(data.notifications || []);
          setUnreadCount((data.notifications || []).filter((n: any) => !n.is_read).length);
        }
      })
      .catch(() => {});
  }, [isDemo]);

  const markNotificationRead = async (id: string) => {
    await fetch("/api/parent/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_id: id }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleTopup = async () => {
    if (!selectedChild || !topupAmount) return;
    setTopupLoading(true);
    if (isDemo) {
      await new Promise(r => setTimeout(r, 1000));
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

  if (isChecking || !isAuthorized) {
    return null;
  }

  const childPhotoUrl = (selectedChild as any)?.photo_url || (selectedChild as any)?.avatar_url || null;
  const childInitials = selectedChild ? `${selectedChild.first_name[0]}${selectedChild.last_name[0]}` : "";

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
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Welcome back
                  </h1>
                  {selectedChild && (
                    <p className="mt-1 text-lg font-semibold text-gray-700">
                      {selectedChild.first_name} {selectedChild.last_name}
                    </p>
                  )}
                  <p className="mt-2 max-w-2xl text-base text-gray-600">
                    Follow your child&apos;s attendance, fees, grades, and school news — all in one place.
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-right">
                  <p className="text-sm font-semibold text-gray-500">Today</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    {new Date().toLocaleDateString("en-UG", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                  className="relative rounded-xl border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50"
                >
                  <MaterialIcon icon="notifications" className="text-xl text-gray-600" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>
            </section>

            {/* Notifications Dropdown */}
            {showNotificationsDropdown && (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={async () => {
                        await fetch("/api/parent/notifications", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ mark_all_read: true }),
                        });
                        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
                        setUnreadCount(0);
                      }}
                      className="text-sm text-[var(--primary)] hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No notifications</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {notifications.slice(0, 5).map((n: any) => (
                      <div
                        key={n.id}
                        className={`p-3 rounded-xl cursor-pointer ${n.is_read ? "bg-gray-50" : "bg-blue-50 border border-blue-100"}`}
                        onClick={() => {
                          if (!n.is_read) markNotificationRead(n.id);
                          if (n.action_url) router.push(n.action_url);
                          setShowNotificationsDropdown(false);
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <MaterialIcon
                            icon={
                              n.type === "grade_posted" ? "grade" :
                              n.type === "payment_received" ? "payments" :
                              n.type === "attendance_alert" ? "warning" :
                              n.type === "report_card" ? "description" :
                              "notifications"
                            }
                            className={`text-lg ${n.is_read ? "text-gray-400" : "text-blue-600"}`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{n.title}</p>
                            <p className="text-xs text-gray-600 truncate">{n.message}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(n.created_at).toLocaleDateString("en-UG")}
                            </p>
                          </div>
                          {!n.is_read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Child selector */}
            {children.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => setSelectedChild(child)}
                    className={`rounded-full border px-5 py-3 transition-colors flex items-center gap-2 whitespace-nowrap text-base ${
                      selectedChild?.id === child.id
                        ? "bg-blue-900 text-white border-transparent"
                        : "bg-white text-gray-700 border-gray-200 hover:border-blue-900"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold">
                      {child.first_name[0]}
                      {child.last_name[0]}
                    </div>
                    <span className="font-semibold">
                      {child.first_name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {selectedChild ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Child Profile Card */}
                <div className="lg:col-span-1">
                  <div className="h-full rounded-2xl border border-gray-200 bg-white p-6 text-center">
                    <div className="w-40 h-40 rounded-full bg-blue-900 mx-auto mb-4 flex items-center justify-center overflow-hidden">
                      {childPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={childPhotoUrl}
                          alt={`${selectedChild.first_name} ${selectedChild.last_name}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-5xl font-bold text-white">
                          {childInitials}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {selectedChild.first_name} {selectedChild.last_name}
                    </h3>
                    <p className="text-base font-semibold text-gray-600 mb-6">
                      {selectedChild.class_name}
                    </p>

                    <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-left space-y-1">
                      <p className="text-xs text-gray-500">Student Number</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {selectedChild.student_number || "Not assigned yet"}
                      </p>
                      <p className="text-xs text-gray-500 pt-1">Guardian Contact</p>
                      <p className="text-sm text-gray-800">
                        {selectedChild.parent_name || "Parent/Guardian"}
                        {selectedChild.parent_phone ? ` · ${selectedChild.parent_phone}` : ""}
                      </p>
                      {selectedChild.parent_phone2 && (
                        <p className="text-xs text-gray-600">Alt: {selectedChild.parent_phone2}</p>
                      )}
                    </div>

                    <div className="space-y-3 text-left">
                      <div className="p-4 rounded-xl bg-gray-50 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                          <MaterialIcon
                            icon="event_available"
                            className="text-green-600"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-500">
                            Attendance
                          </p>
                          <p className="text-base font-bold text-gray-900">
                            {isDemo ? (selectedChild.attendance || "98%") : (attendance.length > 0 ? `${Math.round((attendance.filter(a => a.status === 'present').length / attendance.length) * 100)}%` : "—")}
                          </p>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-gray-50 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                          <MaterialIcon
                            icon="payments"
                            className="text-blue-700"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-500">
                            Fees Balance
                          </p>
                          <p className="text-base font-bold text-gray-900">
                            {isDemo ? (selectedChild.fees_balance || "Clear") : (feeStats.balance > 0 ? `UGX ${feeStats.balance.toLocaleString()}` : "Clear")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions & School Notices */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Wallet Card */}
                    <div className="col-span-2 p-6 rounded-2xl bg-blue-900 text-white">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-bold uppercase tracking-wide opacity-70">Canteen Wallet</p>
                          <p className="text-sm font-semibold opacity-90 mt-0.5">{selectedChild?.first_name}&apos;s Pocket Money</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                          <MaterialIcon icon="account_balance_wallet" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold tracking-tight mb-1">
                        {walletBalance !== null ? `UGX ${walletBalance.toLocaleString()}` : "—"}
                      </p>
                      <p className="text-sm opacity-60 font-semibold mb-4">Available Balance</p>
                      <button
                        onClick={() => setShowTopup(true)}
                        className="px-6 py-3 bg-white text-blue-900 rounded-xl font-bold text-sm uppercase tracking-wide hover:bg-gray-100 transition-colors"
                      >
                        + Add Funds
                      </button>
                    </div>

                    <button
                      onClick={handlePayFees}
                      disabled={topupLoading || feeStats.balance <= 0}
                      className="p-6 rounded-2xl bg-white text-blue-900 flex flex-col lg:flex-row items-center justify-center gap-3 border border-gray-200 hover:border-blue-900 transition-colors disabled:opacity-50"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                        <MaterialIcon
                          icon={topupLoading ? "sync" : "receipt_long"}
                          className={`text-2xl ${topupLoading ? 'animate-spin' : ''}`}
                        />
                      </div>
                      <span className="text-sm font-bold uppercase tracking-wide">
                        {feeStats.balance <= 0 ? "Fees Fully Paid" : "Open Fee Statement"}
                      </span>
                    </button>
                    <Link
                      href="/parent-portal/academics"
                      className="p-6 rounded-2xl bg-white text-green-700 flex flex-col lg:flex-row items-center justify-center gap-3 border border-gray-200 hover:border-green-700 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                        <MaterialIcon icon="description" className="text-2xl" />
                      </div>
                      <span className="text-sm font-bold uppercase tracking-wide">
                        Academic Reports
                      </span>
                    </Link>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-lg font-bold text-gray-900">
                        School Notices
                      </h4>
                      <Link
                        href="/parent-portal/notices"
                        className="text-blue-700 text-sm font-bold uppercase tracking-wide hover:underline"
                      >
                        View All
                      </Link>
                    </div>

                    <div className="space-y-4">
                      {notices.length === 0 ? (
                        <p className="text-base text-gray-500 italic py-4">No recent notices from the school.</p>
                      ) : (
                        notices.map((notice, i) => (
                        <div
                          key={i}
                          className="flex gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100"
                        >
                          <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex-shrink-0 flex items-center justify-center">
                            <MaterialIcon
                              icon={notice.icon || "campaign"}
                              style={{ color: notice.color || "var(--primary)" }}
                            />
                          </div>
                          <div>
                            <p className="text-base font-bold text-gray-900">
                              {notice.title}
                            </p>
                            <p className="text-sm text-gray-500 mb-1 font-semibold">
                              {new Date(notice.created_at).toLocaleDateString()}
                            </p>
                            <p className="text-base text-gray-700 leading-relaxed">
                              {notice.content || notice.desc}
                            </p>
                          </div>
                        </div>
                      )))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 rounded-2xl border border-gray-200 bg-white">
                <div className="w-20 h-20 rounded-full bg-gray-100 mx-auto flex items-center justify-center mb-4">
                  <MaterialIcon
                    icon="search"
                    className="text-4xl text-gray-300"
                  />
                </div>
                <p className="text-base text-gray-600 font-medium">
                  No learners are linked to your account yet.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Please contact the school office to connect your child.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Top-up Modal */}
        {showTopup && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-lg">
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
                <p className="text-base text-gray-500 font-medium mb-8">Funds will be available immediately in {selectedChild?.first_name}&apos;s digital wallet</p>

                <div className="space-y-6">
                  <input
                    type="number"
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
                    {topupLoading
                      ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><MaterialIcon icon="bolt" /> Confirm Top-up</>
                    }
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
