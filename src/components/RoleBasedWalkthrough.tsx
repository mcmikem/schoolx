"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
const WELCOME_DURATION_MS = 9000;

export default function RoleBasedWalkthrough() {
  const { user, school } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);

  const userId = user?.id ?? null;

  // Read after mount rather than during render: this touches localStorage, and
  // reading it during the first render would desync the server and client HTML.
  useEffect(() => {
    setReady(false);
    if (!userId) {
      setVisible(false);
      setReady(true);
      return;
    }
    setVisible(readUserScoped<boolean>(DISMISSED_KEY, userId) !== true);
    setReady(true);
  }, [userId]);

  const dismiss = useCallback(() => {
    if (userId) writeUserScoped(DISMISSED_KEY, userId, true);
    setVisible(false);
  }, [userId]);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(dismiss, WELCOME_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [visible, dismiss]);

  if (!ready || !user || !school || pathname?.replace(/\/$/, "") !== "/dashboard" || !visible) return null;

  const askOwlyAnything = () => {
    dismiss();
    const delivered = askOwly({ kind: "ask", question: "" });
    if (!delivered) {
      const launcher = document.querySelector<HTMLButtonElement>("[data-owl-assistant]");
      if (launcher) {
        launcher.click();
        return;
      }
      router.push("/dashboard/learn/");
      return;
    }
    // The assistant mounts lazily. If its listener has registered but the
    // request was missed during the first paint, open the real launcher.
    window.setTimeout(() => {
      const launcher = document.querySelector<HTMLButtonElement>("[data-owl-assistant]");
      if (launcher?.getAttribute("aria-expanded") !== "true") launcher?.click();
    }, 120);
  };

  return (
    <aside
      aria-label="Owly welcome"
      aria-live="polite"
      data-owl-walkthrough=""
      className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+5.25rem)] z-[70] mx-auto w-auto max-w-md sm:inset-x-auto sm:right-6 sm:top-20 sm:mx-0 sm:w-[min(26rem,calc(100vw-3rem))]"
    >
      <div className="relative flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 pr-12 shadow-[0_18px_55px_rgba(11,28,57,0.2)] ring-1 ring-black/5">
        <div className="shrink-0 rounded-xl bg-[var(--primary-50)] p-1.5">
          <OwlMascot size={42} animated />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-[var(--t1)]">Hi, I’m Owly!</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--t2)]">
            I can help with SkoolMate. Ask me anything about using your school tools.
          </p>
          <button
            type="button"
            onClick={askOwlyAnything}
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--bot-navy)] px-3.5 text-sm font-bold text-white transition hover:opacity-90"
          >
            Ask me anything
            <MaterialIcon icon="arrow_forward" size={17} />
          </button>
          <div
            className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-[var(--surface-container)]"
            aria-hidden="true"
          >
            <div className="owly-welcome-progress h-full origin-left rounded-full bg-[var(--primary)]" />
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss Owly’s welcome"
          className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--t3)] transition hover:bg-[var(--surface-container)] hover:text-[var(--t1)]"
        >
          <MaterialIcon icon="close" />
        </button>
      </div>
    </aside>
  );
}
