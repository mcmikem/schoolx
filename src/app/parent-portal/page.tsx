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
  const [notices, setNotices] = useState<ParentPortalNotice[]>([]);
  const [attendance, setAttendance] = useState<ParentPortalAttendanceRecord[]>(
    [],
  );
  const [grades, setGrades] = useState<ParentPortalGradeRecord[]>([]);
  const [feeStats, setFeeStats] = useState({ totalPaid: 0, totalFee: 0, balance: 0, status: 'unknown' });

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
          console.error("Fetch children error:", err);
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
        const [attRes, gradesRes] = await Promise.all([
          supabase.from("attendance").select("id, date, status, remarks").eq("student_id", scopedChild.id).limit(10),
          supabase.from("grades").select("id, score, max_score, grade, term, exam_type, teacher_comment, subjects(name)").eq("student_id", scopedChild.id).limit(6),
        ]);

        const [modernFeeTermsRes, modernPaymentsRes, legacyPaymentsRes, legacyFeeTermsRes] =
          await Promise.all([
            supabase
              .from("student_fee_terms")
              .select("id, final_amount, academic_year, fee_terms(name)")
              .eq("student_id", scopedChild.id)
              .order("created_at", { ascending: false }),
            supabase
              .from("fee_payments")
              .select(
                "id, amount, payment_date, payment_method, transaction_reference, student_fee_terms!inner(student_id, fee_terms(name))",
              )
              .eq("student_fee_terms.student_id", scopedChild.id)
              .order("payment_date", { ascending: false }),
            supabase
              .from("fee_payments")
              .select(
                "id, amount_paid, payment_date, payment_method, payment_reference",
              )
              .eq("student_id", scopedChild.id),
            supabase
              .from("fee_structure")
              .select("*")
              .eq("school_id", scopedChild.school_id)
              .is("deleted_at", null)
              .or(`class_id.is.null,class_id.eq.${scopedChild.class_id}`),
          ]);

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
          (attRes.data || []).map((record) => ({
            id: record.id,
            date: record.date,
            status: record.status,
            notes: record.remarks ?? null,
          })),
        );
        setGrades(normalizeGrades(gradesRes.data || []));
        setFeeStats(calculateFeeStats(normalizedFeeStructure, normalizedPayments));
      } catch (err) {
        console.error("Fetch student data error:", err);
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

  return (
    <div className="bg-motif flex min-h-screen bg-[radial-gradient(circle_at_top,#edf4ff_0%,#f6f4ec_58%,#f1ece2_100%)]">
      <SidebarShell onNavigate={() => closeSidebar()} />
      <SidebarOverlay />

      <main
        id="main-content"
        className="main-content mobile-container ml-[var(--sidebar-width)] flex-1 flex flex-col min-h-screen w-[calc(100%-var(--sidebar-width))] overflow-hidden"
      >
        <TopBar pageTitle="Parent Portal" onSignOut={handleSignOut} />

        <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="relative overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(130deg,#f9fcff_0%,#edf4ff_44%,#f8f9ff_100%)] p-5 shadow-[0_24px_62px_rgba(15,23,42,0.08)] sm:p-6">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-10 top-0 h-48 w-48 rounded-full bg-[#bfe9e1]/25 blur-3xl" />
                <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-[#d9e6ff]/70 blur-3xl" />
              </div>
              <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7f91aa]">
                    Parent command desk
                  </p>
                  <h1 className="mt-2 font-['Sora'] text-3xl font-semibold tracking-[-0.05em] text-[#17325f]">
                    Monitor progress in one glance
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-[#60748f]">
                    Keep track of attendance, fee status, reports, and school updates with a calmer, cleaner parent experience.
                  </p>
                </div>
                <div className="rounded-[22px] border border-white/70 bg-white/80 px-4 py-3 text-right shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7a8ca6]">Today</p>
                  <p className="mt-1 text-sm font-semibold text-[#17325f]">
                    {new Date().toLocaleDateString("en-UG", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
              </div>
            </section>

            {/* ... children logic ... */}
            {children.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => setSelectedChild(child)}
                    className={`rounded-full border px-4 py-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                      selectedChild?.id === child.id
                        ? "bg-[linear-gradient(180deg,#17325f_0%,#24507f_100%)] text-white border-transparent shadow-[0_14px_28px_rgba(23,50,95,0.25)]"
                        : "bg-white/90 text-[var(--t2)] border-[var(--border)] hover:border-[var(--primary)]"
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-slate-200/90 flex items-center justify-center text-[10px]">
                      {child.first_name[0]}
                      {child.last_name[0]}
                    </div>
                    <span className="text-sm font-semibold">
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
                  <div className="h-full rounded-[30px] border border-white/70 bg-white/82 p-6 text-center shadow-[0_20px_44px_rgba(15,23,42,0.08)]">
                    <div className="w-24 h-24 rounded-[32px] bg-[linear-gradient(145deg,#17325f_0%,#2b679f_100%)] mx-auto mb-4 flex items-center justify-center ring-4 ring-white/80 shadow-[0_18px_36px_rgba(23,50,95,0.24)]">
                      <MaterialIcon
                        icon="child_care"
                        className="text-4xl text-white"
                      />
                    </div>
                    <h3 className="font-['Sora'] text-xl font-semibold tracking-[-0.03em] text-[#17325f]">
                      {selectedChild.first_name} {selectedChild.last_name}
                    </h3>
                    <p className="text-[#3a6996] font-semibold text-sm mb-6">
                      {selectedChild.class_name}
                    </p>

                    <div className="space-y-3 text-left">
                      <div className="p-3 rounded-2xl bg-[#f4f8fc] flex items-center gap-3 border border-[#e8eff7]">
                        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                          <MaterialIcon
                            icon="event_available"
                            className="text-[var(--green)]"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-[var(--t3)] leading-none">
                            Attendance
                          </p>
                          <p className="text-sm font-bold text-[var(--t1)]">
                            {isDemo ? (selectedChild.attendance || "98%") : (attendance.length > 0 ? `${Math.round((attendance.filter(a => a.status === 'present').length / attendance.length) * 100)}%` : "—")}
                          </p>
                        </div>
                      </div>
                      <div className="p-3 rounded-2xl bg-[#f4f8fc] flex items-center gap-3 border border-[#e8eff7]">
                        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                          <MaterialIcon
                            icon="payments"
                            className="text-[var(--primary)]"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-[var(--t3)] leading-none">
                            Fees Balance
                          </p>
                          <p className="text-sm font-bold text-[var(--t1)]">
                            {isDemo ? (selectedChild.fees_balance || "Clear") : (feeStats.balance > 0 ? `UGX ${feeStats.balance.toLocaleString()}` : "Clear")}
                          </p>
                        </div>
                      </div>
                      <div className="p-3 rounded-2xl bg-[#f4f8fc] flex items-center gap-3 border border-[#e8eff7]">
                        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                          <MaterialIcon
                            icon="history_edu"
                            className="text-[var(--orange)]"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-[var(--t3)] leading-none">
                            Next Exam
                          </p>
                          <p className="text-sm font-bold text-[var(--t1)]">
                            {selectedChild.next_exam || "No exam scheduled"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions & Recent Updates */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Wallet Card */}
                  <div className="col-span-2 p-5 rounded-[30px] bg-[linear-gradient(145deg,#17325f_0%,#224c7a_100%)] text-white relative overflow-hidden shadow-[0_24px_48px_rgba(23,50,95,0.28)]">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-16 -mt-16" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[2px] opacity-50">Canteen Wallet</p>
                          <p className="text-xs font-bold opacity-70 mt-0.5">{selectedChild?.first_name}'s Pocket Money</p>
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                          <MaterialIcon icon="account_balance_wallet" />
                        </div>
                      </div>
                      <p className="text-3xl font-black tracking-tight mb-1">
                        {walletBalance !== null ? `UGX ${walletBalance.toLocaleString()}` : "—"}
                      </p>
                      <p className="text-[10px] opacity-40 font-bold mb-4">Available Balance</p>
                      <button
                        onClick={() => setShowTopup(true)}
                        className="px-5 py-2.5 bg-white text-slate-900 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
                      >
                        + Add Funds
                      </button>
                    </div>
                  </div>

                    <button
                      onClick={handlePayFees}
                      disabled={topupLoading || feeStats.balance <= 0}
                      className="p-5 rounded-[28px] bg-white/85 text-[var(--primary)] flex flex-col lg:flex-row items-center justify-center gap-3 hover:shadow-lg transition-all border border-[#dce6f3] active:scale-95 group disabled:opacity-50"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                        <MaterialIcon
                          icon={topupLoading ? "sync" : "receipt_long"}
                          className={`text-2xl ${topupLoading ? 'animate-spin' : ''}`}
                        />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {feeStats.balance <= 0 ? "Fees Fully Paid" : "Open Fee Statement"}
                      </span>
                    </button>
                    <Link
                      href="/parent-portal/academics"
                      className="p-5 rounded-[28px] bg-white/85 text-[var(--green)] flex flex-col lg:flex-row items-center justify-center gap-3 hover:shadow-lg transition-all border border-[#dce6f3] active:scale-95 group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                        <MaterialIcon icon="description" className="text-2xl" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Academic Reports
                      </span>
                    </Link>
                  </div>

                  <div className="rounded-[30px] border border-white/70 bg-white/84 p-6 shadow-[0_18px_38px_rgba(15,23,42,0.07)]">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="font-bold text-[var(--t1)]">
                        Recent Notices
                      </h4>
                      <Link
                        href="/parent-portal/notices"
                        className="text-[var(--primary)] text-xs font-bold uppercase tracking-wider hover:underline"
                      >
                        View All
                      </Link>
                    </div>

                    <div className="space-y-4">
                      {notices.length === 0 ? (
                        <p className="text-xs text-[var(--t3)] italic py-4">No recent notices from the school.</p>
                      ) : (
                        notices.map((notice, i) => (
                        <div
                          key={i}
                          className="flex gap-4 p-4 rounded-[22px] bg-[#f7faff] hover:bg-slate-50 transition-colors border border-[#eaf1f8] group"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex-shrink-0 flex items-center justify-center border border-slate-50 group-hover:shadow-md transition-all">
                            <MaterialIcon
                              icon={notice.icon || "campaign"}
                              style={{ color: notice.color || "var(--primary)" }}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[var(--t1)]">
                              {notice.title}
                            </p>
                            <p className="text-[10px] text-[var(--t3)] mb-1 font-bold">
                              {new Date(notice.created_at).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-[var(--t2)] leading-relaxed">
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
              <div className="text-center py-20 card-premium">
                <div className="w-20 h-20 rounded-full bg-slate-50 mx-auto flex items-center justify-center mb-4">
                  <MaterialIcon
                    icon="search"
                    className="text-4xl text-slate-200"
                  />
                </div>
                <p className="text-[var(--t3)] font-medium">
                  No students linked to your account.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Top-up Modal */}
        {showTopup && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <MaterialIcon icon="add_card" />
                  </div>
                  <button onClick={() => setShowTopup(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                    <MaterialIcon icon="close" className="text-slate-400" />
                  </button>
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-1">Add Pocket Money</h3>
                <p className="text-sm text-slate-400 font-medium mb-8">Funds will be available immediately in {selectedChild?.first_name}'s digital wallet</p>

                <div className="space-y-6">
                  <input
                    type="number"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    placeholder="Amount (UGX)"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-black outline-none focus:ring-4 focus:ring-slate-200"
                  />
                  <div className="flex gap-2">
                    {[5000, 10000, 20000, 50000].map((a) => (
                      <button
                        key={a}
                        onClick={() => setTopupAmount(a.toString())}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:border-slate-800 hover:text-slate-800 transition-all"
                      >
                        +{a / 1000}k
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleTopup}
                    disabled={!topupAmount || topupLoading}
                    className="w-full py-5 bg-slate-900 text-white rounded-[28px] font-black uppercase tracking-[2px] hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
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
