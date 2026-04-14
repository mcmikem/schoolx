"use client";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import SidebarShell from "@/components/dashboard/SidebarShell";
import TopBar from "@/components/dashboard/TopBar";
import MaterialIcon from "@/components/MaterialIcon";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { useParentPortalGuard } from "@/lib/hooks/useParentPortalGuard";

function ParentDashboardContent() {
  const { user, isDemo, signOut } = useAuth();
  const { isAuthorized, isChecking } = useParentPortalGuard();
  const { close: closeSidebar } = useSidebar();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [notices, setNotices] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
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
          // Fetch linked children
          const { data: parentLinks } = await supabase
            .from("parent_students")
            .select("student:students(*, class:classes(name))")
            .eq("parent_id", user.id);

          const list = (parentLinks || []).map((item: any) => ({
            ...item.student,
            class_name: item.student.class?.name || "Unassigned",
          }));
          setChildren(list);
          const activeChild = list[0];
          if (activeChild) setSelectedChild(activeChild);

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

  // Fetch student specific data when selected child changes
  useEffect(() => {
    if (!selectedChild || isDemo) return;

    async function fetchStudentData() {
      try {
        const [attRes, gradesRes, payRes, fsRes] = await Promise.all([
          supabase.from("attendance").select("*").eq("student_id", selectedChild.id).limit(10),
          supabase.from("grades").select("*, subjects(name)").eq("student_id", selectedChild.id).limit(6),
          supabase.from("fee_payments").select("*").eq("student_id", selectedChild.id),
          supabase
            .from("fee_structure")
            .select("*")
            .eq("school_id", selectedChild.school_id)
            .is("deleted_at", null)
            .or(`class_id.is.null,class_id.eq.${selectedChild.class_id}`)
        ]);

        setAttendance(attRes.data || []);
        setGrades(gradesRes.data || []);

        const paid = (payRes.data || []).reduce((sum, p) => sum + Number(p.amount_paid), 0);
        const expected = (fsRes.data || []).reduce((sum, f) => sum + Number(f.amount), 0);
        setFeeStats({
          totalPaid: paid,
          totalFee: expected,
          balance: Math.max(0, expected - paid),
          status: paid >= expected ? 'paid' : 'pending'
        });
      } catch (err) {
        console.error("Fetch student data error:", err);
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
    supabase
      .from("student_wallets")
      .select("balance")
      .eq("student_id", selectedChild.id)
      .single()
      .then(({ data }) => setWalletBalance(data?.balance ?? 0));
  }, [selectedChild, isDemo]);

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
    } catch (err: any) {
      alert(err.message || "Top-up failed");
    } finally {
      setTopupLoading(false);
    }
  };

  const handlePayFees = async () => {
    if (!selectedChild || feeStats.balance <= 0) {
      alert("No outstanding fees to pay.");
      return;
    }
    if (confirm(`Confirm payment of UGX ${feeStats.balance.toLocaleString()}?`)) {
       setTopupLoading(true);
       await new Promise(r => setTimeout(r, 1500));
       setFeeStats(prev => ({ ...prev, balance: 0, totalPaid: prev.totalFee, status: 'paid' }));
       setTopupLoading(false);
       alert("Fee payment processed successfully! Your receipt has been sent to your email.");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  if (isChecking || !isAuthorized) {
    return null;
  }

  return (
    <div className="bg-motif flex min-h-screen bg-[var(--bg)]">
      <SidebarShell onNavigate={() => closeSidebar()} />
      <SidebarOverlay />

      <main
        id="main-content"
        className="main-content mobile-container ml-[var(--sidebar-width)] flex-1 flex flex-col min-h-screen w-[calc(100%-var(--sidebar-width))] overflow-hidden"
      >
        <TopBar pageTitle="Parent Portal" onSignOut={handleSignOut} />

        <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* ... children logic ... */}
            {children.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => setSelectedChild(child)}
                    className={`px-4 py-2 rounded-full border transition-all flex items-center gap-2 whitespace-nowrap ${
                      selectedChild?.id === child.id
                        ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-md"
                        : "bg-white text-[var(--t2)] border-[var(--border)] hover:border-[var(--primary)]"
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px]">
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
                  <div className="card-premium h-full p-6 text-center">
                    <div className="w-24 h-24 rounded-[32px] bg-[var(--navy-soft)] mx-auto mb-4 flex items-center justify-center ring-4 ring-[var(--surface-bright)] shadow-lg">
                      <MaterialIcon
                        icon="child_care"
                        className="text-4xl text-[var(--primary)]"
                      />
                    </div>
                    <h3 className="text-xl font-bold text-[var(--t1)]">
                      {selectedChild.first_name} {selectedChild.last_name}
                    </h3>
                    <p className="text-[var(--primary)] font-semibold text-sm mb-6">
                      {selectedChild.class_name}
                    </p>

                    <div className="space-y-3 text-left">
                      <div className="p-3 rounded-2xl bg-[var(--surface-bright)] flex items-center gap-3">
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
                      <div className="p-3 rounded-2xl bg-[var(--surface-bright)] flex items-center gap-3">
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
                      <div className="p-3 rounded-2xl bg-[var(--surface-bright)] flex items-center gap-3">
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
                            {selectedChild.next_exam || "Schedule Pending"}
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
                  <div className="col-span-2 p-5 rounded-[28px] bg-gradient-to-br from-slate-800 to-slate-900 text-white relative overflow-hidden">
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
                      className="p-5 rounded-[28px] bg-[var(--navy-soft)] text-[var(--primary)] flex flex-col lg:flex-row items-center justify-center gap-3 hover:shadow-lg transition-all border border-[var(--navy)]/5 active:scale-95 group disabled:opacity-50"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                        <MaterialIcon
                          icon={topupLoading ? "sync" : "receipt_long"}
                          className={`text-2xl ${topupLoading ? 'animate-spin' : ''}`}
                        />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {feeStats.balance <= 0 ? "Fees Fully Paid" : "Pay Fees Now"}
                      </span>
                    </button>
                    <button 
                      onClick={() => alert("Reports are being generated. You will receive an SMS and email with a link shortly.")}
                      className="p-5 rounded-[28px] bg-[var(--green-soft)] text-[var(--green)] flex flex-col lg:flex-row items-center justify-center gap-3 hover:shadow-lg transition-all border border-[var(--green)]/5 active:scale-95 group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                        <MaterialIcon icon="description" className="text-2xl" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Download Reports
                      </span>
                    </button>
                  </div>

                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="font-bold text-[var(--t1)]">
                        Recent Notices
                      </h4>
                      <button className="text-[var(--primary)] text-xs font-bold uppercase tracking-wider hover:underline">
                        View All
                      </button>
                    </div>

                    <div className="space-y-4">
                      {notices.length === 0 ? (
                        <p className="text-xs text-[var(--t3)] italic py-4">No recent notices from the school.</p>
                      ) : (
                        notices.map((notice, i) => (
                        <div
                          key={i}
                          className="flex gap-4 p-4 rounded-[22px] hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group"
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
    <SidebarProvider>
      <ParentDashboardContent />
    </SidebarProvider>
  );
}
