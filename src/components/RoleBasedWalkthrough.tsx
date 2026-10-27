"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import OwlMascot from "@/components/brand/OwlMascot";
import { useAuth } from "@/lib/auth-context";
import { askOwly } from "@/lib/owly-bus";
import { readUserScoped, writeUserScoped } from "@/lib/user-scoped-storage";

/**
 * Dismissed-per-user. Not a preference anyone shares: one headmaster closing it
 * must not hide it from the deputy.
 */
const DISMISSED_KEY = "skoolmate_walkthrough_dismissed";

export default function RoleBasedWalkthrough() {
  const { user, school, isDemo } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  const userId = user?.id ?? null;

  // Read after mount rather than during render: this touches localStorage, and
  // reading it during the first render would desync the server and client HTML.
  useEffect(() => {
    setDismissed(readUserScoped<boolean>(DISMISSED_KEY, userId) === true);
  }, [userId]);

  if (!user || !school || pathname?.replace(/\/$/, "") !== "/dashboard") return null;
  if (dismissed) return null;

  const dismiss = () => {
    writeUserScoped(DISMISSED_KEY, userId, true);
    setDismissed(true);
  };

  return (
    <section
      aria-label="Learn to use SkoolMate"
      className="mx-4 mt-3 flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2.5 sm:mt-4 sm:mx-6 sm:flex-row sm:items-center sm:justify-between sm:p-4"
    >
      <div className="flex min-w-[150px] flex-1 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 sm:h-11 sm:w-11">
          <OwlMascot size={28} animated />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-[var(--t1)] sm:text-base">New to SkoolMate?</h2>
          <p className="mt-1 hidden text-sm leading-relaxed text-[var(--t2)] sm:block">
            {isDemo
              ? "Owly can show you around with pretend records. Nothing you try changes real school work."
              : "Owly can walk you through the tasks your role does most. Nothing changes until you try it."}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => {
            if (!askOwly({ kind: "tour" })) {
              router.push("/dashboard/learn/");
            }
          }}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--bot-navy)] px-3 text-sm font-bold text-white sm:min-h-12 sm:gap-2 sm:px-4 sm:text-base"
        >
          <span className="sm:hidden">Show me</span>
          <span className="hidden sm:inline">Show me around</span>
          <MaterialIcon icon="arrow_forward" />
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss the getting-started banner"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--t3)] hover:bg-[var(--surface-container)] hover:text-[var(--t1)] sm:h-12 sm:w-12"
        >
          <MaterialIcon icon="close" />
        </button>
      </div>
    </section>
  );
}
