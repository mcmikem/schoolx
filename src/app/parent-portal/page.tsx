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
import { withTimeout } from "@/lib/hooks/utils";
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
  const [feeStructureItems, setFeeStructureItems] = useState<ParentPortalFeeStructureItem[]>([]);
  const [feePayments, setFeePayments] = useState<ParentPortalPayment[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [childDataLoading, setChildDataLoading] = useState(false);

  const feeStats = useMemo(
    () => calculateFeeStats(feeStructureItems, feePayments),
    [feeStructureItems, feePayments],
  );

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
        setFeeStructureItems([{ id: "demo-fee", name: "Tuition", amount: 1200000, term: "Term 1" }]);
        setFeePayments([{ id: "demo-pay", amount_paid: 1080000, payment_date: new Date().toISOString(), payment_method: "Cash", payment_reference: "DEMO-001" }]);
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
                .or(`parent_phone.eq.${normalized},parent_phone2.eq.${normalized}`);

              if (!matchedStudents?.length && last9) {
                const { data: fuzzyMatches } = await supabase
                  .from("students")
                  .select("id, parent_phone, parent_phone2, school_id")
                  .eq("status", "active");
                matchedStudents = fuzzyMatches?.filter(
                  (s) =>
                    s.parent_phone?.slice(-9) === last9 ||
                    s.parent_phone2?.slice(-9) === last9,
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

          // NOTE: Removed fetching of school-wide notices to avoid leaking school information to parents.
          // If parent-specific notices are needed, implement a separate endpoint or filter.
          setNotices([]);

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
      if (!scopedChild) { setChildDataLoading(false); return; }
      try {
        const timoutFallback = { data: null, error: new Error("Request timed out") };
        const attRes = await withTimeout(
          supabase.from("attendance").select("id, date, status, remarks").eq("student_id", scopedChild.id).limit(10),
          15000,
          timoutFallback as any,
        );
        const gradesRes = await withTimeout(
          supabase.from("grades").select("id, score, max_score, grade, term, exam_type, teacher_comment, subjects(name)").eq("student_id", scopedChild.id).limit(6),
          15000,
          timoutFallback as any,
        );

        const modernFeeTermsRes = await withTimeout(
          supabase.from("student_fee_terms").select("id, final_amount, academic_year, fee_terms(name)").eq("student_id", scopedChild.id).order("created_at", { ascending: false }),
          15000,
          timoutFallback as any,
        );
        const modernPaymentsRes = await withTimeout(
          supabase.from("fee_payments").select("id, amount, payment_date, payment_method, transaction_reference, student_fee_terms!inner(student_id, fee_terms(name))").eq("student_fee_terms.student_id", scopedChild.id).order("payment_date", { ascending: false }),
          15000,
          timoutFallback as any,
        );
        const legacyPaymentsRes = await withTimeout(
          supabase.from("fee_payments").select("id, amount_paid, payment_date, payment_method, payment_reference").eq("student_id", scopedChild.id),
          15000,
          timoutFallback as any,
        );
        const legacyFeeTermsRes = await withTimeout(
          supabase.from("fee_structure").select("*").eq("school_id", scopedChild.school_id).is("deleted_at", null).or(`class_id.is.null,class_id.eq.${scopedChild.class_id}`),
          15000,
          timoutFallback as any,
        );

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
        <div className="w-full max-w-md rounded-2xl border border-[#e5ecf4] bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-[#ffefe8] text-[#c2472b] flex items-center justify-center">
            <MaterialIcon icon="lock" />
          </div>
          <h2 className="text-lg font-bold text-[#17325f]">Parent portal access unavailable</h2>
          <p className="mt-2 text-sm text-[#60748f]">Please contact your school if you believe this is a mistake.</p>
          <Link href="/dashboard" className="mt-4 inline-flex rounded-xl bg-[#17325f] px-4 py-2 text-sm font-semibold text-white">
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const childPhotoUrl = (selectedChild as any)?.photo_url || (selectedChild as any)?.avatar_url || null;
  const childInitials = selectedChild ? `${selectedChild.first_name[0]}${selectedChild.last_name[0]}` : "";
  const todayDate = new Date().toISOString().split("T")[0];
  const todayAttendance = attendance.find((record) => record.date === todayDate) ?? attendance[0];
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
          <div className="max-w-2xl mx-auto">
            {loading ? (
              <div className="flex items-center justify-center min-h-[300px]">
                <OwlMascot size={52} premium ring glow animated />
              </div>
            ) : children.length === 0 ? (
              <div className="text-center py-10">
                <OwlMascot size={56} premium ring glow animated />
                <h3 className="text-lg font-bold mt-4">No learners linked yet</h3>
                <p className="text-sm text-[var(--t3)] mt-1">Your phone on file: {user?.phone || 'N/A'}</p>
                <p className="text-sm text-[var(--t3)]">Contact the school office to link your account.</p>
              </div>
            ) : (
              <>
                {/* Section 1: Child selector — large visual cards */}
                <div className="flex gap-3 overflow-x-auto pb-2 mb-6">
                  {children.map(child => {
                    const isSelected = selectedChild?.id === child.id;
                    return (
                      <button
                        key={child.id}
                        onClick={() => setSelectedChild(child)}
                        className={`shrink-0 rounded-[24px] border-2 p-4 min-w-[140px] text-left transition-all ${
                          isSelected ? 'border-[#17325f] bg-[#f0f6ff] shadow-md' : 'border-[#e5ecf4] bg-white'
                        }`}
                      >
                        <div className="h-14 w-14 rounded-full bg-[#17325f] flex items-center justify-center text-xl font-bold text-white mx-auto mb-2 overflow-hidden">
                          {child.photo_url ? (
                            <Image
                              src={child.photo_url}
                              alt={`${child.first_name} ${child.last_name}`}
                              width={56}
                              height={56}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{(child.first_name?.[0] || child.last_name?.[0] || '?')}</span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-[#17325f] text-center">{child.first_name} {child.last_name}</p>
                        <p className="text-[11px] text-[#7f91aa] text-center">{child.class_name}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Section 2: Today's status — visual cards */}
                {selectedChild && (
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {/* Attendance today */}
                    <div className={`rounded-[24px] p-5 text-center ${attendanceStatus === 'present' ? 'bg-[#e1f3ee]' : 'bg-[#f6f9fc]'}`}>
                      <span className={`material-symbols-outlined text-4xl ${attendanceStatus === 'present' ? 'text-[#1f8a70]' : 'text-[#b0c4db]'}`}>
                        {attendanceStatus === 'present' ? 'check_circle' : 'help'}
                      </span>
                      <p className="text-sm font-bold text-[#17325f] mt-2">Today: {attendanceStatus === 'present' ? 'Present' : 'Not recorded'}</p>
                    </div>

                    {/* Fee balance */}
                    <div className={`rounded-[24px] p-5 text-center ${feeStats.balance > 0 ? 'bg-[#ffefe8]' : 'bg-[#e1f3ee]'}`}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f91aa]">Fee Balance</p>
                      <p className={`text-xl font-bold mt-1 ${feeStats.balance > 0 ? 'text-[#c2472b]' : 'text-[#1f8a70]'}`}>
                        {feeStats.balance > 0 ? `UGX ${feeStats.balance?.toLocaleString()}` : 'Cleared'}
                      </p>
                      <p className="text-[11px] text-[#7f91aa] mt-1">of UGX {feeStats.totalFee?.toLocaleString()}</p>
                    </div>
                  </div>
                )}

                {/* Section 3: Quick actions + exceptions */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 grid grid-cols-3 gap-3">
                    <Link href={`/parent-portal/fees${selectedChild ? `?child=${selectedChild.id}` : ''}`} className="rounded-[20px] bg-white border border-[#e5ecf4] p-4 text-center hover:bg-[#f8fbff] transition-colors">
                      <span className="material-symbols-outlined text-[28px] text-[#17325f]">payments</span>
                      <p className="text-xs font-bold text-[#17325f] mt-2">Pay fees</p>
                    </Link>
                    <Link href={`/parent-portal/attendance${selectedChild ? `?child=${selectedChild.id}` : ''}`} className="rounded-[20px] bg-white border border-[#e5ecf4] p-4 text-center hover:bg-[#f8fbff] transition-colors">
                      <span className="material-symbols-outlined text-[28px] text-[#17325f]">how_to_reg</span>
                      <p className="text-xs font-bold text-[#17325f] mt-2">Attendance</p>
                    </Link>
                    <Link href={`/parent-portal/academics${selectedChild ? `?child=${selectedChild.id}` : ''}`} className="rounded-[20px] bg-white border border-[#e5ecf4] p-4 text-center hover:bg-[#f8fbff] transition-colors">
                      <span className="material-symbols-outlined text-[28px] text-[#17325f]">grade</span>
                      <p className="text-xs font-bold text-[#17325f] mt-2">Grades</p>
                    </Link>
                  </div>

                  <div className="rounded-[20px] border border-[#e5ecf4] bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f91aa]">Exceptions First</p>
                    <div className="space-y-2 mt-3">
                      <div className={`rounded-xl border p-3 ${hasFeeBalance ? 'border-[#f5d0c5] bg-[#ffefe8]' : 'border-[#d8efe7] bg-[#f3fbf8]'}`}>
                        <p className="text-xs font-semibold text-[#17325f]">Fees</p>
                        <p className={`text-sm font-bold mt-1 ${hasFeeBalance ? 'text-[#c2472b]' : 'text-[#1f8a70]'}`}>
                          {hasFeeBalance ? `Balance UGX ${feeStats.balance.toLocaleString()}` : 'No fee balance'}
                        </p>
                      </div>
                      <div className={`rounded-xl border p-3 ${urgentUnreads ? 'border-[#f5deb3] bg-[#fff8eb]' : 'border-[#e5ecf4] bg-[#f8fbff]'}`}>
                        <p className="text-xs font-semibold text-[#17325f]">School alerts</p>
                        <p className="text-sm font-bold mt-1 text-[#17325f]">
                          {urgentUnreads ? `${unreadCount} unread notification(s)` : 'All notifications read'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
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
