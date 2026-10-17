"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { useAuth } from "@/lib/auth-context";
import { readUserScoped, writeUserScoped } from "@/lib/user-scoped-storage";

/**
 * Dismissed-per-user. Not a preference anyone shares: one headmaster closing it
 * must not hide it from the deputy.
 */
const DISMISSED_KEY = "skoolmate_walkthrough_dismissed";

export default function RoleBasedWalkthrough() {
  const { user, school, isDemo } = useAuth();
  const pathname = usePathname();
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
      className="mx-4 mt-4 flex min-w-0 flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:mx-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#17325f]">
          <MaterialIcon icon="menu_book" size={24} />
        </span>
        <div>
          <h2 className="text-base font-bold text-[var(--t1)]">New to SkoolMate? Start here.</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--t2)]">
            {isDemo
              ? "Easy steps and pretend records. Learn without changing your school's work."
              : "Guided steps you can try safely. Nothing here changes your school's records."}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/dashboard/learn"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#17325f] px-4 text-base font-bold text-white"
        >
          Learn step by step
          <MaterialIcon icon="arrow_forward" />
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss the getting-started banner"
          className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-[var(--t3)] hover:bg-[var(--surface-container)] hover:text-[var(--t1)]"
        >
          <MaterialIcon icon="close" />
        </button>
      </div>
    </section>
  );
}
