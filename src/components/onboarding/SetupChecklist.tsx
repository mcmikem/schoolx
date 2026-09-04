"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui";

interface ChecklistItem {
  id: string;
  item_key: string;
  item_label: string;
  is_completed: boolean;
  completed_at: string | null;
  skipped: boolean;
  sort_order?: number | null;
}

interface Props {
  onComplete?: (key: string) => void;
  showAll?: boolean;
  autoHide?: boolean;
}

const DEFAULT_ITEMS: Array<{ item_key: string; item_label: string }> = [
  { item_key: "school_details", item_label: "School details" },
  { item_key: "academic_term", item_label: "Set current academic term" },
  { item_key: "classes", item_label: "Add classes" },
  { item_key: "subjects", item_label: "Add subjects" },
  { item_key: "teachers", item_label: "Add teachers" },
  { item_key: "students", item_label: "Add students" },
  { item_key: "attendance", item_label: "Record first attendance" },
  { item_key: "first_payment", item_label: "Collect first payment" },
];

const ITEM_ORDER: Record<string, number> = Object.fromEntries(DEFAULT_ITEMS.map((item, i) => [item.item_key, i]));

function sortItems<T extends { item_key: string; sort_order?: number | null }>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => (a.sort_order ?? ITEM_ORDER[a.item_key] ?? 999) - (b.sort_order ?? ITEM_ORDER[b.item_key] ?? 999),
  );
}

export default function SetupChecklist({ onComplete, showAll = false, autoHide = false }: Props) {
  const router = useRouter();
  const { school, user } = useAuth();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChecklist = useCallback(async () => {
    if (!school?.id) return;
    try {
      const res = await fetch("/api/setup-progress/", { method: "GET" });
      const body = await res.json();
      if (res.ok && body.success && Array.isArray(body.data?.items)) {
        setItems(body.data.items);
        setLoading(false);
        return;
      }
    } catch {
      // fall through to direct Supabase fetch below
    }
    // Best-effort: purge legacy pre-migration keys so the fallback never
    // resurrects stale steps when the API path is unreachable.
    try {
      await supabase
        .from("setup_checklist")
        .delete()
        .eq("school_id", school.id)
        .not(
          "item_key",
          "in",
          "(school_details,academic_term,classes,subjects,teachers,students,attendance,first_payment)",
        );
    } catch {
      // ignore — the select below still works
    }
    const { data, error } = await supabase
      .from("setup_checklist")
      .select("*")
      .eq("school_id", school.id)
      .order("sort_order");

    if (!error && data && data.length > 0) {
      setItems(sortItems(data));
      setLoading(false);
      return;
    }

    // No rows yet (or the read failed) — always show the guided steps. Attempt
    // to persist so the server route can pick them up next time.
    const fallbackItems = DEFAULT_ITEMS.map((item, i) => ({
      id: `default-${i}`,
      school_id: school.id,
      ...item,
      is_completed: false,
      completed_at: null,
      skipped: false,
      sort_order: i,
    }));
    setItems(fallbackItems);

    if (data?.length === 0) {
      await supabase.from("setup_checklist").upsert(
        DEFAULT_ITEMS.map((item, i) => ({ ...item, school_id: school.id, sort_order: i })),
        { onConflict: "school_id,item_key" },
      );
    }

    setLoading(false);
  }, [school?.id]);

  const markComplete = async (id: string, key: string) => {
    const { error } = await supabase
      .from("setup_checklist")
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .eq("id", id);

    if (!error) {
      setItems(
        items.map((item) =>
          item.id === id
            ? {
                ...item,
                is_completed: true,
                completed_at: new Date().toISOString(),
              }
            : item,
        ),
      );
      onComplete?.(key);
    }
  };

  const markSkipped = async (id: string) => {
    const { error } = await supabase
      .from("setup_checklist")
      .update({ skipped: true, skipped_at: new Date().toISOString() })
      .eq("id", id);

    if (!error) {
      setItems(
        items.map((item) => (item.id === id ? { ...item, skipped: true, skipped_at: new Date().toISOString() } : item)),
      );
    }
  };

  const getItemIcon = (key: string): string => {
    const icons: Record<string, string> = {
      school_details: "apartment",
      academic_term: "calendar_month",
      classes: "school",
      subjects: "menu_book",
      teachers: "people",
      students: "upload_file",
      attendance: "fact_check",
      first_payment: "payments",
    };
    return icons[key] || "check_circle";
  };

  const getItemRoute = (key: string): string => {
    const routes: Record<string, string> = {
      school_details: "/dashboard/settings",
      academic_term: "/dashboard/academic-terms",
      classes: "/dashboard/classes",
      subjects: "/dashboard/subjects",
      teachers: "/dashboard/staff",
      students: "/dashboard/import",
      attendance: "/dashboard/attendance",
      first_payment: "/dashboard/fees",
    };
    return routes[key] || "/dashboard";
  };

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  const incompleteItems = items.filter((item) => !item.is_completed && !item.skipped);
  const completedCount = items.filter((item) => item.is_completed).length;
  const progress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  // The checklist is onboarding guidance: on dashboard surfaces it only shows
  // for newly registered schools. (The settings page renders with showAll and
  // no autoHide, so it stays reachable when explicitly opened.)
  const NEW_SCHOOL_DAYS = 30;
  const schoolAgeDays = (() => {
    const created = (school as { created_at?: string } | null)?.created_at;
    if (!created) return 0;
    const ms = Date.now() - new Date(created).getTime();
    return Number.isNaN(ms) ? 0 : ms / 86400000;
  })();

  if (loading) return <div className="p-4 text-center text-slate-500">Loading checklist...</div>;

  if (autoHide && (progress === 100 || schoolAgeDays > NEW_SCHOOL_DAYS)) return null;

  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-[var(--on-surface)]">School Setup Checklist</h3>
            <p className="text-sm text-[var(--t3)]">
              {completedCount} of {items.length} completed
            </p>
          </div>
          <div className="text-3xl font-bold text-[var(--primary)]">{progress}%</div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 bg-[var(--surface-container)] rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-[var(--primary)] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Checklist Items */}
        <div className="space-y-3">
          {(showAll ? items : incompleteItems.slice(0, 4)).map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-4 rounded-xl border ${
                item.is_completed
                  ? "border-green-200 bg-green-50"
                  : item.skipped
                    ? "border-slate-200 bg-slate-50 opacity-60"
                    : "border-[var(--border)] bg-[var(--surface-container)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    item.is_completed ? "bg-green-100" : "bg-[var(--primary-soft)]"
                  }`}
                >
                  <MaterialIcon
                    icon={item.is_completed ? "check_circle" : getItemIcon(item.item_key)}
                    className={item.is_completed ? "text-green-600" : "text-[var(--primary)]"}
                  />
                </div>
                <div>
                  <p
                    className={`font-medium ${item.is_completed ? "text-green-800 line-through" : "text-[var(--on-surface)]"}`}
                  >
                    {item.item_label}
                  </p>
                  {item.completed_at && (
                    <p className="text-xs text-green-600">
                      Completed {new Date(item.completed_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              {!item.is_completed && !item.skipped && (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => markSkipped(item.id)}>
                    Skip
                  </Button>
                  <Button size="sm" onClick={() => router.push(getItemRoute(item.item_key))}>
                    Setup
                  </Button>
                </div>
              )}

              {item.is_completed && (
                <Button size="sm" variant="ghost" onClick={() => router.push(getItemRoute(item.item_key))}>
                  View
                </Button>
              )}
            </div>
          ))}
        </div>

        {incompleteItems.length > 4 && !showAll && (
          <Button
            variant="secondary"
            className="w-full mt-4"
            onClick={() => router.push("/dashboard/settings?tab=checklist")}
          >
            View All {incompleteItems.length} Items
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
