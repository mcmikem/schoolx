"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useStudents, useClasses } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";

interface GoLiveCheck {
  key: string;
  label: string;
  description: string;
  icon: string;
  check: boolean;
  action: string;
  href: string;
}

export default function GoLiveGate({
  onDismiss,
}: {
  onDismiss: () => void;
}) {
  const { school, user } = useAuth();
  const { currentTerm, academicYear } = useAcademic();
  const { students } = useStudents(school?.id);
  const { classes } = useClasses(school?.id);
  const [hasFeeStructure, setHasFeeStructure] = useState(false);
  const [hasGrading, setHasGrading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!school?.id) return;
    (async () => {
      try {
        const [feesRes, gradingRes] = await Promise.all([
          supabase
            .from("fee_structure")
            .select("id", { count: "exact", head: true })
            .eq("school_id", school.id),
          supabase
            .from("grading_scales")
            .select("id", { count: "exact", head: true })
            .eq("school_id", school.id),
        ]);
        setHasFeeStructure((feesRes.count ?? 0) > 0);
        setHasGrading((gradingRes.count ?? 0) > 0);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [school?.id]);

  const isSuperAdmin = user?.role === "super_admin";

  const checks: GoLiveCheck[] = [
    {
      key: "terms",
      label: "Academic terms configured",
      description: "Set up at least one term with start/end dates",
      icon: "calendar_month",
      check: !!(currentTerm && academicYear),
      action: "Set up terms",
      href: "/dashboard/academic-terms",
    },
    {
      key: "classes",
      label: "Classes created",
      description: "Add at least one class or stream",
      icon: "school",
      check: classes.length > 0,
      action: "Add classes",
      href: "/dashboard/settings",
    },
    {
      key: "students",
      label: "Students enrolled",
      description: "You need at least one student to go live",
      icon: "group",
      check: students.length > 0,
      action: "Add students",
      href: "/dashboard/students",
    },
    {
      key: "fees",
      label: "Fee structure set",
      description: "Define fee items so parents know what to pay",
      icon: "payments",
      check: hasFeeStructure,
      action: "Set up fees",
      href: "/dashboard/fees",
    },
    {
      key: "grading",
      label: "Grading scale configured",
      description: "Set up grading for report cards (e.g. 80-100 = D1)",
      icon: "grade",
      check: hasGrading,
      action: "Configure grading",
      href: "/dashboard/settings",
    },
  ];

  const allPassed = checks.every((c) => c.check);
  const passedCount = checks.filter((c) => c.check).length;

  if (loading) {
    return (
      <div className="fixed inset-0 z-[90] bg-white/95 dark:bg-gray-900/95 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[var(--navy)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (allPassed || isSuperAdmin) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] bg-white/95 dark:bg-gray-900/95 flex items-center justify-center p-4 overflow-auto">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-[var(--navy)]/10 flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="rocket_launch" className="text-3xl text-[var(--navy)]" />
          </div>
          <h2 className="font-['Sora'] text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Almost ready to go live!
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Complete these {checks.length - passedCount} remaining setup items so your school can start using SkoolMate effectively.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {checks.map((check) => (
            <div
              key={check.key}
              className={`flex items-start gap-3 p-3 rounded-xl border ${
                check.check
                  ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                check.check
                  ? "bg-emerald-100 dark:bg-emerald-800"
                  : "bg-gray-100 dark:bg-gray-700"
              }`}>
                <MaterialIcon
                  icon={check.check ? "check_circle" : check.icon}
                  className={`text-lg ${check.check ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold ${check.check ? "text-emerald-700 dark:text-emerald-300 line-through" : "text-gray-900 dark:text-gray-100"}`}>
                  {check.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {check.description}
                </div>
                {!check.check && (
                  <a
                    href={check.href}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--navy)] hover:text-[var(--green)] mt-1.5"
                  >
                    {check.action}
                    <MaterialIcon icon="arrow_forward" className="text-xs" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            {passedCount} of {checks.length} complete
          </p>
          <button
            onClick={onDismiss}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-[var(--navy)] dark:hover:text-white underline underline-offset-2"
          >
            Skip for now &mdash; I&apos;ll set up later
          </button>
        </div>
      </div>
    </div>
  );
}