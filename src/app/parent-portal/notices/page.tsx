"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { useParentPortalGuard } from "@/lib/hooks/useParentPortalGuard";

const CATEGORY_ICONS: Record<string, string> = {
  academic: "menu_book",
  finance: "payments",
  events: "event",
  health: "health_and_safety",
  general: "campaign",
};

export default function ParentNoticesPage() {
  const { user, school, isDemo } = useAuth();
  const { isAuthorized, isChecking } = useParentPortalGuard();
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<any>(null);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    if (isDemo) {
      setNotices([
        { id: "1", title: "Easter Break Notice", content: "School will be closed from Good Friday to Easter Monday. Classes resume on Tuesday. Wishing all families a blessed Easter holiday.", category: "general", created_at: new Date(Date.now() - 86400000).toISOString(), is_active: true },
        { id: "2", title: "End of Term Exams", content: "End of Term 1 examinations will commence on April 20th. Students must ensure all fees are cleared before sitting for exams.", category: "academic", created_at: new Date(Date.now() - 2 * 86400000).toISOString(), is_active: true },
        { id: "3", title: "Visitation Day", content: "Parents are cordially invited to Visitation Day on Saturday, April 26th from 9:00 AM to 3:00 PM. Come meet your child's teachers and review their progress.", category: "events", created_at: new Date(Date.now() - 5 * 86400000).toISOString(), is_active: true },
        { id: "4", title: "Fee Payment Deadline", content: "Kindly note that the deadline for Term 2 fee payment is May 5th. Parents who have not cleared fees will be contacted individually.", category: "finance", created_at: new Date(Date.now() - 7 * 86400000).toISOString(), is_active: true },
      ]);
      setLoading(false);
      return;
    }
    // Fetch school_id from user's linked student
    let schoolId: string | null = null;
    const parentId = user?.id;
    if (parentId) {
      const { data: links } = await supabase
        .from("parent_students")
        .select("student:students(school_id)")
        .eq("parent_id", parentId)
        .limit(1)
        .single();
      schoolId = (links as any)?.student?.school_id || null;
    }
    if (!schoolId) { setLoading(false); return; }
    const { data } = await supabase
      .from("notices")
      .select("id, title, content, category, created_at, is_active")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(30);
    setNotices(data || []);
    setLoading(false);
  }, [user?.id, isDemo]);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  if (isChecking || !isAuthorized) {
    return null;
  }

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader title="Notice Board" subtitle="Stay up to date with school announcements" />

      {loading ? (
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-[var(--surface-container)] rounded-3xl animate-pulse" />)}</div>
      ) : notices.length === 0 ? (
        <div className="text-center py-16 text-[var(--on-surface-variant)]">
          <MaterialIcon icon="campaign" className="text-5xl mb-3 opacity-30" />
          <p className="font-bold">No notices at the moment</p>
          <p className="text-sm">Check back later for school announcements</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notices.map((n) => (
            <Card key={n.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedNotice(n)}>
              <CardBody className="flex gap-4">
                <div className="w-10 h-10 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
                  <MaterialIcon icon={CATEGORY_ICONS[n.category] || "campaign"} className="text-[var(--primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-[var(--on-surface)]">{n.title}</p>
                    <span className="text-[10px] text-[var(--on-surface-variant)] shrink-0">
                      {new Date(n.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1 line-clamp-2">{n.content}</p>
                  {n.category && (
                    <span className="mt-2 inline-block px-2 py-0.5 bg-[var(--surface-container)] rounded-full text-[9px] font-black uppercase tracking-wider text-[var(--on-surface-variant)] capitalize">{n.category}</span>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {selectedNotice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-3xl w-full max-w-lg shadow-2xl p-8 space-y-4">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-black text-[var(--on-surface)] pr-4">{selectedNotice.title}</h2>
              <button onClick={() => setSelectedNotice(null)} className="p-2 hover:bg-[var(--surface-container)] rounded-xl shrink-0">
                <MaterialIcon icon="close" />
              </button>
            </div>
            <p className="text-[10px] text-[var(--on-surface-variant)]">
              {new Date(selectedNotice.created_at).toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </p>
            <p className="text-sm text-[var(--on-surface)] leading-relaxed">{selectedNotice.content}</p>
          </div>
        </div>
      )}
    </div>
    </PageErrorBoundary>
  );
}
