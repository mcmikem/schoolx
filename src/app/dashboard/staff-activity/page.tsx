"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";

interface Activity {
  id: string;
  user_name: string;
  action: string;
  module: string;
  description: string;
  created_at: string;
}

export default function StaffActivityPage() {
  const { school } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const fetchActivities = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_log")
      .select("id, user_name, action, module, description, created_at")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) setActivities(data);
    setLoading(false);
  }, [school?.id]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const filtered =
    filter === "all" ? activities : activities.filter((a) => a.module === filter);

  const modules = Array.from(new Set(activities.map((a) => a.module)));

  const getIcon = (module: string) => {
    switch (module) {
      case "attendance": return "check_circle";
      case "grades": return "grade";
      case "students": return "group";
      case "fees": return "payments";
      case "staff": return "badge";
      default: return "history";
    }
  };

  const getColor = (action: string) => {
    switch (action) {
      case "create": return "var(--green)";
      case "update": return "var(--navy)";
      case "delete": return "var(--red, #dc2626)";
      default: return "var(--t3)";
    }
  };

  return (
    <PageErrorBoundary>
    <div className="content">
      <PageHeader
        title="Staff Activity"
        subtitle="Recent staff actions across the system"
      />

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === "all" ? "bg-[var(--primary)] text-[var(--on-primary)]" : "bg-[var(--surface)] text-[var(--t2)] hover:bg-[var(--bg)]"}`}
        >
          All
        </button>
        {modules.map((m) => (
          <button
            key={m}
            onClick={() => setFilter(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${filter === m ? "bg-[var(--primary)] text-[var(--on-primary)]" : "bg-[var(--surface)] text-[var(--t2)] hover:bg-[var(--bg)]"}`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="p-8 text-center text-[var(--t3)]">Loading activity…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <MaterialIcon icon="history" className="text-4xl text-[var(--t3)] opacity-30 mb-2" />
            <p className="text-sm font-medium text-[var(--t2)]">No activity recorded</p>
            <p className="text-xs text-[var(--t3)] mt-1">Actions like attendance, grading, and fee payments will appear here</p>
          </div>
        ) : (
          filtered.map((a) => (
            <div key={a.id} className="card !p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${getColor(a.action)} 10%, transparent)`, color: getColor(a.action) }}>
                <MaterialIcon icon={getIcon(a.module)} style={{ fontSize: 18 }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--t1)] truncate">{a.user_name || "System"}</p>
                <p className="text-xs text-[var(--t3)] truncate">
                  {a.description || `${a.action} in ${a.module}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] font-medium text-[var(--t3)]">
                  {new Date(a.created_at).toLocaleDateString("en-UG", { month: "short", day: "numeric" })}
                </span>
                <br />
                <span className="text-[10px] text-[var(--t3)]">
                  {new Date(a.created_at).toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
    </PageErrorBoundary>
  );
}
