"use client";
import { useState, useEffect } from "react";
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
}

interface Props {
  onComplete?: (key: string) => void;
  showAll?: boolean;
}

export default function SetupChecklist({ onComplete, showAll = false }: Props) {
  const { school, user } = useAuth();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChecklist = async () => {
    if (!school?.id) return;
    const { data, error } = await supabase
      .from("setup_checklist")
      .select("*")
      .eq("school_id", school.id)
      .order("item_key");

    if (!error && data) {
      setItems(data);
      // If no items exist, create defaults
      if (data.length === 0) {
        await createDefaultChecklist();
      }
    }
    setLoading(false);
  };

  const createDefaultChecklist = async () => {
    if (!school?.id) return;
    const defaultItems = [
      { item_key: "academic_calendar", item_label: "Academic Calendar" },
      { item_key: "class_structure", item_label: "Class & Stream Setup" },
      { item_key: "fee_structure", item_label: "Fee Structure" },
      { item_key: "staff_accounts", item_label: "Staff Accounts" },
      { item_key: "student_import", item_label: "Import Students" },
      { item_key: "sms_templates", item_label: "SMS Templates" },
      { item_key: "payment_methods", item_label: "Payment Methods" },
      { item_key: "grading_config", item_label: "Grading System" },
    ];

    const { data, error } = await supabase
      .from("setup_checklist")
      .upsert(
        defaultItems.map((item) => ({ ...item, school_id: school.id })),
        { onConflict: "school_id,item_key" },
      )
      .select();

    if (!error) fetchChecklist();
  };

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
        items.map((item) =>
          item.id === id
            ? { ...item, skipped: true, skipped_at: new Date().toISOString() }
            : item,
        ),
      );
    }
  };

  const getItemIcon = (key: string): string => {
    const icons: Record<string, string> = {
      academic_calendar: "calendar_month",
      class_structure: "school",
      fee_structure: "payments",
      staff_accounts: "people",
      student_import: "upload_file",
      sms_templates: "sms",
      payment_methods: "account_balance_wallet",
      grading_config: "grade",
    };
    return icons[key] || "check_circle";
  };

  const getItemRoute = (key: string): string => {
    const routes: Record<string, string> = {
      academic_calendar: "/dashboard/settings?tab=config",
      class_structure: "/dashboard/settings?tab=config",
      fee_structure: "/dashboard/fees",
      staff_accounts: "/dashboard/settings?tab=users",
      student_import: "/dashboard/import",
      sms_templates: "/dashboard/sms-templates",
      payment_methods: "/dashboard/fees?tab=payments",
      grading_config: "/dashboard/grades?tab=settings",
    };
    return routes[key] || "/dashboard";
  };

  useEffect(() => {
    fetchChecklist();
  }, [school?.id]);

  const incompleteItems = items.filter(
    (item) => !item.is_completed && !item.skipped,
  );
  const completedCount = items.filter((item) => item.is_completed).length;
  const progress =
    items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  if (loading)
    return (
      <div className="p-4 text-center text-slate-500">Loading checklist...</div>
    );

  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-[var(--on-surface)]">
              School Setup Checklist
            </h3>
            <p className="text-sm text-[var(--t3)]">
              {completedCount} of {items.length} completed
            </p>
          </div>
          <div className="text-3xl font-bold text-[var(--primary)]">
            {progress}%
          </div>
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
                    item.is_completed
                      ? "bg-green-100"
                      : "bg-[var(--primary-soft)]"
                  }`}
                >
                  <MaterialIcon
                    icon={
                      item.is_completed
                        ? "check_circle"
                        : getItemIcon(item.item_key)
                    }
                    className={
                      item.is_completed
                        ? "text-green-600"
                        : "text-[var(--primary)]"
                    }
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
                      Completed{" "}
                      {new Date(item.completed_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              {!item.is_completed && !item.skipped && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => markSkipped(item.id)}
                  >
                    Skip
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      (window.location.href = getItemRoute(item.item_key))
                    }
                  >
                    Setup
                  </Button>
                </div>
              )}

              {item.is_completed && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    (window.location.href = getItemRoute(item.item_key))
                  }
                >
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
            onClick={() =>
              (window.location.href = "/dashboard/settings?tab=checklist")
            }
          >
            View All {incompleteItems.length} Items
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
