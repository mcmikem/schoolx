"use client";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { BugReportModal } from "@/components/BugReportButton";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useOwlySignals } from "@/lib/owly-signals";
import { FALLBACK_WALKTHROUGH, pickWalkthrough, type Walkthrough } from "@/lib/owly-walkthroughs";
import { readUserScoped, writeUserScoped } from "@/lib/user-scoped-storage";
import { answerLocally, getPageHints } from "@/lib/owly-knowledge";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_WHATSAPP_ENV,
  generateSupportSmsLink,
  generateSupportWhatsAppLink,
  PLATFORM_SUPPORT_PHONE_DISPLAY,
} from "@/lib/support-contact";

interface Message {
  role: "user" | "assistant";
  text: string;
  time: string;
}

const STORAGE_KEY = "skoolmate_owly_messages_v1";
const MAX_STORED_MESSAGES = 40;
const AI_TIMEOUT_MS = 12000;

/**
 * Scoped to the signed-in user. This transcript is not role-filtered on read,
 * so a shared device would hand the next person the previous one's questions —
 * which is exactly the kind of thing that names pupils, balances and parents.
 */
function loadStoredMessages(userId: string | null | undefined): Message[] | null {
  try {
    const parsed = readUserScoped<unknown>(STORAGE_KEY, userId);
    if (parsed == null) return null;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const valid = parsed.filter(
      (m): m is Message =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.text === "string" &&
        typeof m.time === "string",
    );
    return valid.length ? valid.slice(-MAX_STORED_MESSAGES) : null;
  } catch {
    return null;
  }
}

function welcomeMessage(): Message {
  return {
    role: "assistant",
    text: "Hi! I'm **Owly**, your SkoolMate assistant.\n\nI can help with **school management**, the **SkoolMate app**, **NCDC Uganda curriculum**, fees, attendance, reports, and more — and I keep working **offline** using my built-in guide.\n\nWhat can I help you with today?",
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

function formatMessage(text: string) {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const renderInline = (line: string) => {
    const escaped = escapeHtml(line);
    const nodes: React.ReactNode[] = [];
    // **bold** and `code` spans
    const parts = escaped.split(/(\*\*.*?\*\*|`[^`]*`)/g);
    parts.forEach((part, j) => {
      if (!part) return;
      if (/^\*\*.*\*\*$/.test(part)) {
        nodes.push(<strong key={`b${j}`}>{part.slice(2, -2)}</strong>);
      } else if (/^`.*`$/.test(part)) {
        nodes.push(
          <code key={`c${j}`} className="px-1 py-0.5 rounded bg-black/5 text-[12px]">
            {part.slice(1, -1)}
          </code>,
        );
      } else {
        nodes.push(<span key={`t${j}`}>{part}</span>);
      }
    });
    return nodes;
  };

  return text.split("\n").map((line, i) => {
    // **Title** alone on a line → heading
    const heading = /^\*\*(.+?)\*\*$/.exec(line);
    if (heading) {
      return (
        <div key={i} className="font-semibold text-[13px] mt-1 first:mt-0">
          {heading[1]}
        </div>
      );
    }
    // blank line → spacing
    if (!line.trim()) {
      return <div key={i} style={{ height: 6 }} />;
    }
    // bullet
    const bullet = /^([•\-–])\s+(.*)$/.exec(line);
    if (bullet) {
      return (
        <div key={i} className="flex gap-1.5">
          <span className="shrink-0 opacity-60">{bullet[1]}</span>
          <span className="flex-1">{renderInline(bullet[2])}</span>
        </div>
      );
    }
    // numbered step
    const numbered = /^(\d+)\.\s+(.*)$/.exec(line);
    if (numbered) {
      return (
        <div key={i} className="flex gap-1.5">
          <span className="shrink-0 font-medium">{numbered[1]}.</span>
          <span className="flex-1">{renderInline(numbered[2])}</span>
        </div>
      );
    }
    return <div key={i}>{renderInline(line)}</div>;
  });
}

export default function OwlAssistant() {
  const { school, user } = useAuth();
  const pathname = usePathname();

  // How far up from the bottom of the viewport a page's action bar reaches.
  //
  // The assistant is anchored to the bottom right, and a page that pins a bar
  // along the bottom -- the attendance Save bar, for one -- would otherwise
  // have the assistant sitting on top of it. The clearance was a guessed
  // 176px, which cleared the bar by 8px and would have cleared it by nothing
  // on a page with a taller bar. Measured instead, so it cannot drift.
  useEffect(() => {
    const root = document.documentElement;

    const measure = () => {
      const bar = document.querySelector("[data-page-action-bar]");
      if (!bar) {
        root.style.setProperty("--action-bar-clearance", "0px");
        return;
      }
      const rect = bar.getBoundingClientRect();
      const clearance = Math.max(0, Math.round(window.innerHeight - rect.top));
      root.style.setProperty("--action-bar-clearance", `${clearance}px`);
    };

    measure();

    const bar = document.querySelector("[data-page-action-bar]");
    const observer =
      typeof ResizeObserver !== "undefined" && bar
        ? new ResizeObserver(measure)
        : null;
    if (observer && bar) observer.observe(bar);
    window.addEventListener("resize", measure);

    // The bar often appears without a navigation -- the attendance page shows
    // its Save bar once a class is picked -- so watching the page for changes
    // is what keeps the measurement current. Without this the clearance stayed
    // at zero and the assistant sat on the bar.
    const mutations =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(() => {
            const current = document.querySelector("[data-page-action-bar]");
            if (current !== bar) {
              observer?.disconnect();
              if (current && observer) observer.observe(current);
            }
            measure();
          })
        : null;
    mutations?.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      mutations?.disconnect();
      window.removeEventListener("resize", measure);
      root.style.setProperty("--action-bar-clearance", "0px");
    };
  }, [pathname]);
  // Declared first: the messages initialiser below reads it, and a `const` read
  // before its declaration throws at runtime even when TypeScript cannot see
  // the ordering problem through a closure.
  const userId = user?.id;
  const [open, setOpen] = useState(false);
  const [bugOpen, setBugOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => loadStoredMessages(userId) ?? [welcomeMessage()]);
  const [input, setInput] = useState("");
  const router = useRouter();
  const [typing, setTyping] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [walkthrough, setWalkthrough] = useState<Walkthrough | null>(null);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [online, setOnline] = useState(true);
  const owly = useOwlySignals({
    page: pathname ?? undefined,
    role: user?.role ?? undefined,
    online,
    userId,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Needs a human via WhatsApp (primary) or SMS (secondary, cheaper channel).
  const schoolPhone = (school as { support_phone?: string } | null)?.support_phone || DEFAULT_WHATSAPP_ENV;
  const contactCtx = {
    phone: schoolPhone,
    schoolName: school?.name,
    role: user?.role ?? undefined,
    page: pathname ?? undefined,
  };

  useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Persist the conversation so Owly remembers it across reloads — per user,
  // so a shared tablet never carries one person's transcript to the next.
  useEffect(() => {
    writeUserScoped(STORAGE_KEY, userId, messages.slice(-MAX_STORED_MESSAGES));
  }, [messages, userId]);

  // Auth resolves after first paint, so the initial read above ran with no
  // user id and returned the welcome message. Re-read once the real user is
  // known, or returning pupils would find their history missing.
  const loadedFor = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (loadedFor.current === userId) return;
    loadedFor.current = userId;
    setMessages(loadStoredMessages(userId) ?? [welcomeMessage()]);
  }, [userId]);

  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const submitMessage = async (raw: string) => {
    const text = raw.trim();
    if (!text) return;

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const historyTurns = messages.slice(-10).map((m) => ({
      role: m.role,
      text: m.text.slice(0, 1500),
    }));

    setMessages((prev) => [...prev, { role: "user", text, time: now }]);
    setInput("");
    setTyping(true);

    const reply = (responseText: string) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: responseText,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setTyping(false);
    };

    const localAnswer = () => answerLocally(text, { page: pathname ?? undefined });

    // Offline or AI unavailable → answer from the built-in guide (no network needed).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      const res = await fetch("/api/ai/chat/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text.slice(0, 1500),
          history: historyTurns,
          context: {
            role: user?.role ?? undefined,
            schoolName: school?.name ?? undefined,
            page: pathname ?? undefined,
          },
        }),
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json();
        const aiText = typeof data?.response === "string" ? data.response : "";
        // `fallback: true` means the server has no AI brain (missing API key) —
        // use the built-in guide instead of the server's canned apology.
        if (aiText && !data?.fallback) {
          reply(aiText);
        } else {
          reply(localAnswer());
        }
      } else {
        reply(localAnswer());
      }
    } catch {
      reply(localAnswer());
    } finally {
      clearTimeout(timer);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitMessage(input);
    }
  };

  const hints = getPageHints(pathname || "");

  // Owly only speaks when it has a reason to. `attention` is the single gate on
  // every interrupting affordance: the blink, the question-mark badge, and the
  // popup that opens when tapped.
  const attention = owly.shouldBlink;
  const currentSuggestion = owly.suggestions[0] ?? null;
  const tour = pickWalkthrough(user?.roles?.length ? user.roles : user?.role ? [user.role] : []);
  const fallbackTour = tour ?? FALLBACK_WALKTHROUGH;

  const openWalkthrough = (which: Walkthrough) => {
    setWalkthrough(which);
    setWalkthroughStep(0);
    setOpen(true);
    setSuggestionOpen(false);
  };

  const handleSuggestionCta = () => {
    setSuggestionOpen(false);
    if (currentSuggestion?.id === "first-run") {
      openWalkthrough(fallbackTour);
      return;
    }
    if (currentSuggestion?.href) {
      router.push(currentSuggestion.href);
      setOpen(false);
      return;
    }
    // Everything else is a question for the guide — open the panel with it
    // already typed, so the user presses send rather than retyping.
    setOpen(true);
    setInput(currentSuggestion?.cta ?? "");
  };

  return (
    <>
      {/* ── Suggestion popup: what Owly wants to tell you ── */}
      {suggestionOpen && currentSuggestion && (
        <div
          data-owl-suggestion=""
          className="fixed z-[9991] w-[min(320px,calc(100vw-32px))] rounded-2xl p-4 shadow-2xl bottom-[calc(var(--mobile-nav-clearance)+74px)] right-4 sm:bottom-[92px] sm:right-6"
          style={{ background: "var(--surface, #fff)", border: "1px solid var(--border, #e5e7eb)" }}
          role="dialog"
          aria-label="Owly has a suggestion"
        >
          <div className="flex items-start gap-2">
            <MaterialIcon icon="help" className="mt-0.5 text-[var(--green)]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-snug text-[var(--t1)]">{currentSuggestion.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--t2)]">{currentSuggestion.detail}</p>
            </div>
            <button
              type="button"
              onClick={() => setSuggestionOpen(false)}
              className="tap-44 -m-1 shrink-0 rounded-full p-1 text-[var(--t3)]"
              aria-label="Dismiss suggestion"
            >
              <MaterialIcon icon="close" size={16} />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setSuggestionOpen(false)}
              className="min-h-11 flex-1 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--t2)]"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={handleSuggestionCta}
              className="min-h-11 flex-[2] rounded-xl bg-[var(--primary)] text-sm font-bold text-white"
            >
              {currentSuggestion.cta}
            </button>
          </div>
        </div>
      )}

      {/* ── Floating Owly button ── */}
      <button
        onClick={() => (attention ? setSuggestionOpen((v) => !v) : setOpen((v) => !v))}
        data-owl-assistant=""
        className="fixed z-[9990] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--green)] bottom-[calc(var(--mobile-nav-clearance)+10px)] right-4 sm:bottom-6 sm:right-6"
        style={{ width: 56, height: 56, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        aria-label={
          attention
            ? `Owly has ${owly.suggestions.length} suggestion${owly.suggestions.length === 1 ? "" : "s"}: ${currentSuggestion?.title ?? ""}`
            : "Ask Owly, your guide"
        }
        aria-expanded={open}
        title={attention ? (currentSuggestion?.title ?? "Owly has a suggestion") : "Owly — your guide"}
      >
        {open ? (
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-105 active:scale-95"
            style={{ background: "#0b1c39" }}
          >
            <MaterialIcon icon="close" className="text-white text-2xl" />
          </div>
        ) : (
          <div
            className="relative transition-transform hover:scale-105 active:scale-95"
            style={{ width: 56, height: 56 }}
          >
            <Image
              src="/SkoolMate logos/SchoolMate icon.svg"
              alt="SkoolMate"
              width={56}
              height={56}
              loading="eager"
              className="rounded-2xl"
            />
            {/* Owly blinks only when it actually has something to offer. The
                old pulsing green dot meant "there is a server" — meaningless to
                a teacher, and it never stopped, so it taught people to ignore
                the one indicator that now matters. */}
            {attention && (
              <>
                <span className="absolute inset-0 rounded-2xl animate-owly-pulse" aria-hidden />
                <span
                  className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[var(--green)] text-white shadow-lg"
                  aria-hidden
                >
                  <MaterialIcon icon="help" size={14} />
                </span>
              </>
            )}
          </div>
        )}
      </button>

      {/* ── Walkthrough ──
          A first-run guided path through this role's real tasks. Each step says
          what to do and how to tell it worked, because "did that save?" is the
          question that otherwise goes to the headteacher instead of the app. */}
      {open && walkthrough && (
        <div
          data-owl-walkthrough=""
          className="fixed z-[9992] inset-0 flex flex-col bg-[var(--bg)] sm:inset-auto sm:w-[min(420px,calc(100vw-32px))] sm:rounded-2xl sm:shadow-2xl sm:bottom-[calc(var(--mobile-nav-clearance)+82px)] sm:right-6 sm:max-h-[min(560px,calc(100vh-160px))]"
          role="dialog"
          aria-modal="true"
          aria-label={walkthrough.title}
        >
          <div className="flex items-start gap-3 px-4 py-3 text-white" style={{ background: "#0b1c39" }}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight">{walkthrough.title}</p>
              <p className="mt-0.5 text-xs text-white/70">
                Step {Math.min(walkthroughStep + 1, walkthrough.steps.length)} of {walkthrough.steps.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWalkthrough(null)}
              className="tap-44 -m-1 shrink-0 rounded-full p-1 text-white/80"
              aria-label="Close walkthrough"
            >
              <MaterialIcon icon="close" size={18} />
            </button>
          </div>

          <div className="h-1 w-full shrink-0" style={{ background: "var(--surface-container-low, #e5e7eb)" }}>
            <div
              className="h-full transition-all"
              style={{
                width: `${((walkthroughStep + 1) / walkthrough.steps.length) * 100}%`,
                background: "var(--green, #16a34a)",
              }}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {walkthroughStep === 0 && (
              <p className="mb-4 text-sm leading-relaxed text-[var(--t2)]">{walkthrough.intro}</p>
            )}
            {(() => {
              const step = walkthrough.steps[walkthroughStep];
              if (!step) return null;
              return (
                <div>
                  <h3 className="text-lg font-bold leading-snug text-[var(--t1)]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--t2)]">{step.how}</p>
                  <div className="mt-4 rounded-xl p-3" style={{ background: "var(--green-soft, #dcfce7)" }}>
                    <p className="flex items-start gap-2 text-sm font-semibold leading-relaxed text-[var(--on-surface)]">
                      <MaterialIcon icon="check_circle" size={18} className="mt-0.5 shrink-0" />
                      <span>
                        <span className="block text-[11px] uppercase tracking-wide opacity-70">You will know it worked when</span>
                        {step.done}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="flex shrink-0 gap-2 border-t border-[var(--border)] px-4 py-3">
            <button
              type="button"
              onClick={() => (walkthroughStep === 0 ? setWalkthrough(null) : setWalkthroughStep((n) => n - 1))}
              className="min-h-11 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--t2)]"
            >
              Back
            </button>
            {(() => {
              const step = walkthrough.steps[walkthroughStep];
              const isLast = walkthroughStep >= walkthrough.steps.length - 1;
              return step?.href && !isLast ? (
                <button
                  type="button"
                  onClick={() => {
                    router.push(step.href as string);
                    setWalkthroughStep((n) => n + 1);
                  }}
                  className="min-h-11 flex-[2] rounded-xl bg-[var(--primary)] text-sm font-bold text-white"
                >
                  Take me there
                </button>
              ) : isLast ? (
                <button
                  type="button"
                  onClick={() => setWalkthrough(null)}
                  className="min-h-11 flex-[2] rounded-xl bg-[var(--green)] text-sm font-bold text-white"
                >
                  Done
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setWalkthroughStep((n) => n + 1)}
                  className="min-h-11 flex-[2] rounded-xl bg-[var(--primary)] text-sm font-bold text-white"
                >
                  Next
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Chat panel ── */}
      {open && (
        <div
          data-owl-assistant=""
          className="fixed z-[9989] w-full max-w-[360px] rounded-2xl shadow-2xl flex flex-col overflow-hidden bottom-[calc(var(--mobile-nav-clearance)+82px)] right-4 sm:bottom-[100px] sm:right-6"
          style={{
            background: "var(--surface, #fff)",
            border: "1px solid var(--border, #e5e7eb)",
            maxHeight: "min(520px, calc(100vh - 200px))",
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center gap-3"
            style={{
              background: "#0b1c39",
            }}
          >
            <div className="shrink-0">
              <Image
                src="/SkoolMate logos/SchoolMate icon.svg"
                alt="SkoolMate"
                width={36}
                height={36}
                loading="eager"
                className="rounded-xl"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-tight">Owly Assistant</p>
              <p className="text-white/70 text-xs">
                {online ? "Your guide — tap to ask anything" : "Offline — the built-in guide still answers"}
              </p>
            </div>
            {school?.is_tester && (
              <button
                type="button"
                onClick={() => setBugOpen(true)}
                className="tap-44 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
                title="Report a bug"
                aria-label="Report a bug"
              >
                <MaterialIcon icon="bug_report" className="text-base" />
              </button>
            )}
            <a
              href={generateSupportWhatsAppLink(contactCtx)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#25D366] hover:bg-[#20b858] rounded-full text-white text-xs font-semibold transition-colors shrink-0"
              title="WhatsApp Support Team"
              onClick={(e) => e.stopPropagation()}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Team
            </a>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ minHeight: 200 }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-[#0b1c39]/10 flex items-center justify-center shrink-0 mr-2 mt-1 overflow-hidden">
                    <Image
                      src="/SkoolMate logos/SchoolMate icon.svg"
                      alt="SkoolMate"
                      width={28}
                      height={28}
                      loading="eager"
                      className="rounded-md"
                    />
                  </div>
                )}
                <div className="max-w-[82%]">
                  <div
                    className={`px-3 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[var(--primary,#0b1c39)] text-white rounded-tr-sm"
                        : "bg-[var(--surface-container-low,#f4f4f5)] text-[var(--t1,#111)] rounded-tl-sm"
                    }`}
                  >
                    {formatMessage(msg.text)}
                  </div>
                  <p
                    className={`text-[10px] text-[var(--t4,#9ca3af)] mt-0.5 ${msg.role === "user" ? "text-right" : "text-left"}`}
                  >
                    {msg.time}
                  </p>
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#0b1c39]/10 flex items-center justify-center overflow-hidden">
                  <Image
                    src="/SkoolMate logos/SchoolMate icon.svg"
                    alt="SkoolMate"
                    width={28}
                    height={28}
                    loading="eager"
                    className="rounded-md"
                  />
                </div>
                <div className="bg-[var(--surface-container-low,#f4f4f5)] px-3 py-2.5 rounded-2xl rounded-tl-sm">
                  <span className="flex gap-1 items-center">
                    <span
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reopenable walkthrough. The suggestion only ever reaches people who
              have never seen the app, so without this there is no way back for
              anyone who skipped it — or who just wants it again next term. */}
          <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => openWalkthrough(fallbackTour)}
              className="px-2.5 py-1 bg-[#0b1c39]/5 text-[#0b1c39] text-xs rounded-full border border-[#0b1c39]/10 hover:bg-[#0b1c39]/10 transition-colors font-semibold"
            >
              Show me around
            </button>
          </div>

          {/* Quick hints */}
          {messages.length <= 2 && (
            <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
              {hints.map((hint, i) => (
                <button
                  key={i}
                  onClick={() => submitMessage(hint)}
                  className="px-2.5 py-1 bg-[#0b1c39]/5 text-[#0b1c39] text-xs rounded-full border border-[#0b1c39]/10 hover:bg-[#0b1c39]/10 transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-[var(--border,#e5e7eb)] flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about fees, attendance, NCDC..."
              className="flex-1 px-3 py-2 rounded-xl text-sm bg-[var(--bg,#f9fafb)] border border-[var(--border,#e5e7eb)] outline-none focus:ring-2 focus:ring-[#0b1c39]/20 text-[var(--t1,#111)]"
            />
            <button
              onClick={() => submitMessage(input)}
              disabled={!input.trim() || typing}
              className="w-9 h-9 rounded-xl bg-[#0b1c39] hover:bg-[var(--t1)] disabled:opacity-40 flex items-center justify-center text-white transition-colors shrink-0"
            >
              <MaterialIcon icon="send" className="text-sm" />
            </button>
          </div>

          {/* Footer: honest contact info. WhatsApp first, SMS secondary */}
          <div className="px-3 py-2 bg-[var(--surface-container-low,#f9fafb)] flex items-center justify-between gap-2">
            <p className="text-[10px] text-[var(--t4,#9ca3af)]">
              Need a human?{" "}
              <a
                href={generateSupportWhatsAppLink(contactCtx)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#128C7E] underline"
              >
                WhatsApp {PLATFORM_SUPPORT_PHONE_DISPLAY}
              </a>
            </p>
            <a
              href={generateSupportSmsLink(contactCtx)}
              className="text-[10px] text-[var(--t4,#9ca3af)] underline"
              title="SMS support (secondary)"
            >
              SMS instead
            </a>
          </div>
        </div>
      )}
      <BugReportModal open={bugOpen} onClose={() => setBugOpen(false)} />
    </>
  );
}
