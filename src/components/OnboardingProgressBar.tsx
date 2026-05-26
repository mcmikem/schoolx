"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/hooks/utils";
import MaterialIcon from "@/components/MaterialIcon";

interface OnboardingCheck {
  key: string;
  label: string;
  table: string;
  route: string;
  icon: string;
}

const CHECKS: OnboardingCheck[] = [
  { key: "classes", label: "Classes & Streams", table: "classes", route: "/dashboard/settings?tab=config", icon: "school" },
  { key: "subjects", label: "Subjects", table: "subjects", route: "/dashboard/settings?tab=config", icon: "menu_book" },
  { key: "fee_structure", label: "Fee Structure", table: "fee_structure", route: "/dashboard/fees", icon: "payments" },
  { key: "academic_terms", label: "Academic Terms", table: "academic_terms", route: "/dashboard/settings?tab=config", icon: "calendar_month" },
  { key: "staff", label: "Staff Records", table: "staff", route: "/dashboard/settings?tab=users", icon: "people" },
  { key: "students", label: "Students", table: "students", route: "/dashboard/students", icon: "group" },
  { key: "timetable_slots", label: "Timetable", table: "timetable_slots", route: "/dashboard/timetable", icon: "schedule" },
];

export default function OnboardingProgressBar() {
  const router = useRouter();
  const { school } = useAuth();
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const checkAll = useCallback(async () => {
    if (!school?.id) return;
    const done = new Set<string>();
    await Promise.all(
      CHECKS.map(async (check) => {
        try {
          const { count } = await withTimeout(
            supabase
              .from(check.table)
              .select("*", { count: "exact", head: true })
              .eq("school_id", school.id),
            8000,
            { count: 0, error: null } as any,
          );
          if (count && count > 0) done.add(check.key);
        } catch {
          // skip — table may not exist yet
        }
      }),
    );
    setCompleted(done);
    setLoading(false);
  }, [school?.id]);

  useEffect(() => {
    checkAll();
  }, [checkAll]);

  const total = CHECKS.length;
  const doneCount = completed.size;
  const progress = Math.round((doneCount / total) * 100);
  if (loading) return null;
  if (dismissed || progress === 100) return null;

  return (
    <div className="rounded-[24px] bg-white border border-[#e5ecf4] p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-[#17325f]">School Setup Progress</h3>
          <p className="text-xs text-[#7f91aa] mt-0.5">
            {doneCount} of {total} steps done
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-[#17325f]">{progress}%</span>
          {progress === 100 && (
            <button
              onClick={() => setDismissed(true)}
              className="text-xs text-[#7f91aa] hover:text-[#17325f] transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      <div className="w-full h-2 bg-[#eef2f6] rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-teal-500 to-[#17325f] transition-all duration-700 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {CHECKS.map((check) => {
          const isDone = completed.has(check.key);
          return (
            <button
              key={check.key}
              onClick={() => !isDone && router.push(check.route)}
              disabled={isDone}
              className={`flex items-center gap-2 rounded-xl p-2.5 text-left text-xs transition-all ${
                isDone
                  ? "bg-green-50 text-green-700 cursor-default"
                  : "bg-[#f6f8fb] text-[#60748f] hover:bg-[#edf4ff] hover:text-[#17325f] cursor-pointer"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  isDone ? "bg-green-100" : "bg-[#e5ecf4]"
                }`}
              >
                <MaterialIcon
                  icon={isDone ? "check" : check.icon}
                  className={`text-[14px] ${isDone ? "text-green-600" : "text-[#7f91aa]"}`}
                />
              </div>
              <span className="font-medium leading-tight">{check.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
