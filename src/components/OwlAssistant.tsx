"use client";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { useAuth } from "@/lib/auth-context";
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

function loadStoredMessages(): Message[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
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
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => loadStoredMessages() ?? [welcomeMessage()]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [online, setOnline] = useState(true);
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

  // Persist the conversation so Owly remembers it across reloads.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
    } catch {
      // Storage full / private mode — chat just won't survive reloads.
    }
  }, [messages]);

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

  return (
    <>
      {/* ── Floating Owly button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed z-[9990] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--green)] bottom-[84px] right-4 sm:bottom-6 sm:right-6"
        style={{ width: 64, height: open ? 64 : 78, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        aria-label="Open SkoolMate Assistant"
        title="Owly — SkoolMate Assistant"
      >
        {open ? (
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-105 active:scale-95"
            style={{ background: "#0b1c39" }}
          >
            <MaterialIcon icon="close" className="text-white text-2xl" />
          </div>
        ) : (
          <div
            className="relative transition-transform hover:scale-105 active:scale-95"
            style={{ width: 64, height: 64 }}
          >
            <Image
              src="/SkoolMate logos/SchoolMate icon.svg"
              alt="SkoolMate"
              width={64}
              height={64}
              loading="eager"
              className="rounded-2xl"
            />
            <span
              className={`absolute top-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                online ? "bg-green-400 animate-pulse" : "bg-amber-400"
              }`}
              aria-hidden
            />
          </div>
        )}
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div
          className="fixed z-[9989] w-full max-w-[360px] rounded-2xl shadow-2xl flex flex-col overflow-hidden bottom-[160px] right-4 sm:bottom-[100px] sm:right-6"
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
                {online ? "SkoolMate OS · School Management" : "Offline · built-in guide answering"}
              </p>
            </div>
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
    </>
  );
}
