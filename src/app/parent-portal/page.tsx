"use client";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import SidebarShell from "@/components/dashboard/SidebarShell";
import TopBar from "@/components/dashboard/TopBar";
import MaterialIcon from "@/components/MaterialIcon";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";

function ParentDashboardContent() {
  const { user, isDemo, signOut } = useAuth();
  const { close: closeSidebar } = useSidebar();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
        setLoading(false);
        return;
      }

      if (user) {
        const { data, error } = await supabase
          .from("parent_students")
          .select("student:students(*, class:classes(name))")
          .eq("parent_id", user.id);

        if (data) {
          const list = data.map((item: any) => ({
            ...item.student,
            class_name: item.student.class?.name || "Unassigned",
          }));
          setChildren(list);
          if (list.length > 0) setSelectedChild(list[0]);
        }
        setLoading(false);
      }
    }

    fetchChildren();
  }, [user, isDemo]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

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
                            {selectedChild.attendance || "98%"}
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
                            {selectedChild.fees_balance || "Clear"}
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
                    <button className="p-5 rounded-[28px] bg-[var(--navy-soft)] text-[var(--primary)] flex flex-col lg:flex-row items-center justify-center gap-3 hover:shadow-lg transition-all border border-[var(--navy)]/5 active:scale-95 group">
                      <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                        <MaterialIcon
                          icon="receipt_long"
                          className="text-2xl"
                        />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Pay Fees Now
                      </span>
                    </button>
                    <button className="p-5 rounded-[28px] bg-[var(--green-soft)] text-[var(--green)] flex flex-col lg:flex-row items-center justify-center gap-3 hover:shadow-lg transition-all border border-[var(--green)]/5 active:scale-95 group">
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
                      {[
                        {
                          title: "Easter Break",
                          date: "April 2, 2026",
                          desc: "School will be closed from Friday to Monday. Students return on Tuesday.",
                          icon: "celebration",
                          color: "var(--amber)",
                        },
                        {
                          title: "Visitation Day",
                          date: "March 28, 2026",
                          desc: "Parents are invited to check student progress and chat with teachers.",
                          icon: "groups",
                          color: "var(--primary)",
                        },
                      ].map((notice, i) => (
                        <div
                          key={i}
                          className="flex gap-4 p-4 rounded-[22px] hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex-shrink-0 flex items-center justify-center border border-slate-50 group-hover:shadow-md transition-all">
                            <MaterialIcon
                              icon={notice.icon}
                              style={{ color: notice.color }}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[var(--t1)]">
                              {notice.title}
                            </p>
                            <p className="text-[10px] text-[var(--t3)] mb-1 font-bold">
                              {notice.date}
                            </p>
                            <p className="text-xs text-[var(--t2)] leading-relaxed">
                              {notice.desc}
                            </p>
                          </div>
                        </div>
                      ))}
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
