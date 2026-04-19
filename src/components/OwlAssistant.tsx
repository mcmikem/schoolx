"use client";
import { useState, useRef, useEffect } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { usePathname } from "next/navigation";

interface Message {
  role: "user" | "assistant";
  text: string;
  time: string;
}

// ─── Built-in knowledge base ─────────────────────────────────────────────────
const KNOWLEDGE: { keywords: string[]; answer: string }[] = [
  {
    keywords: ["fee", "fees", "payment", "pay", "invoice", "balance"],
    answer:
      "📋 **Fee Management** in SkoolMate:\n\n• Go to **Fees** → Record Payment\n• Accepts Cash, Mobile Money, Bank Transfer, or Installments\n• Auto-generates receipts and invoices\n• Use **Fee Terms** to set installment schedules\n• **Payment Plans** let students pay in parts over a term\n\nTip: Use Ctrl+N on the Fees page to quickly record a new payment.",
  },
  {
    keywords: ["attendance", "absent", "present", "mark", "register"],
    answer:
      "✅ **Attendance** in SkoolMate:\n\n• Go to **Attendance** → select class & date\n• Click students to cycle: Absent → Present → Late\n• Works offline — syncs when reconnected\n• **Staff Attendance** is tracked separately\n• **Dorm Attendance** tracks boarders at night\n\nAttendance auto-alerts parents after 3 consecutive absences if SMS automation is enabled.",
  },
  {
    keywords: ["grade", "marks", "score", "exam", "ca", "continuous"],
    answer:
      "📝 **Marks & Grades** in SkoolMate:\n\n• Go to **Grades** → select class & subject\n• Enter CA1, CA2, CA3, and Exam scores\n• Grades auto-calculate based on your grading scheme\n• Use **Lock/Unlock** to prevent accidental edits\n• Workflow: Draft → Submitted → Approved → Published\n\nGrades align with NCDC Uganda grading scale (Distinction/Credit/Pass/Fail for O-Level).",
  },
  {
    keywords: ["ncdc", "curriculum", "syllabus", "topics", "scheme"],
    answer:
      "📚 **NCDC Curriculum** in SkoolMate:\n\n• Go to **Syllabus** → select class, subject, and term\n• Click **NCDC Topics** to auto-load the national curriculum topics\n• Mark topics as Not Started / In Progress / Completed\n• **Scheme of Work** generates weekly lesson breakdowns\n• Covers P1–P7 (primary) and S1–S6 (secondary) curriculum\n\nSkoolMate is fully aligned with the 2025 NCDC revised curriculum for Ugandan schools.",
  },
  {
    keywords: ["timetable", "schedule", "period", "lesson", "slot"],
    answer:
      "🗓️ **Timetable** in SkoolMate:\n\n• Go to **Timetable** → select a class\n• Click any empty slot to assign a teacher & subject\n• Conflicts are auto-detected (teacher double-booking)\n• Delete entries by hovering and clicking the trash icon\n• **Term Calendar** tab shows public holidays, midterm breaks, and EOT dates\n\nSchool-wide timetable period slots are configured in **Setup → Timetable Slots**.",
  },
  {
    keywords: ["sms", "message", "text", "bulk", "notify", "whatsapp"],
    answer:
      "📱 **SMS & Communication** in SkoolMate:\n\n• Go to **Messages** to send individual or bulk SMS\n• **Automation** tab: auto-send on absences, fee reminders, etc.\n• **Templates** tab: create reusable SMS templates\n• **Notices** tab: post school announcements\n• Powered by Africa's Talking (works on all Uganda networks)\n\nMTN and Airtel Uganda are both supported via mobile money and SMS gateways.",
  },
  {
    keywords: ["student", "enroll", "admission", "register", "transfer"],
    answer:
      "👩‍🎓 **Students** in SkoolMate:\n\n• Go to **Students** → Add Student (or bulk import CSV)\n• Each student gets a unique student number\n• Transfer in/out via **Student Transfers**\n• Track dropout risks in **Dropout Tracking**\n• Link parents via **parent_phone** field\n\nStudent IDs can be printed as ID cards from the **ID Cards** section.",
  },
  {
    keywords: ["staff", "teacher", "employee", "payroll", "salary"],
    answer:
      "👨‍🏫 **Staff Management** in SkoolMate:\n\n• Go to **Staff** → Staff Directory tab\n• Add staff from Settings → Users tab\n• **Payroll**: process monthly salary by grade scale\n• **Leave**: staff apply for leave; headmaster approves\n• **Reviews**: performance reviews per term\n\nSalary grades (Scale 1–5) follow Uganda Government salary structures. Custom salaries are also supported.",
  },
  {
    keywords: ["report", "report card", "progress", "term report"],
    answer:
      "📊 **Report Cards** in SkoolMate:\n\n• Go to **Report Cards** after publishing grades\n• Reports auto-populate all subjects and comments\n• Head of Department can add subject remarks\n• Headmaster's comment is added per student\n• Export as PDF for printing\n\nReports follow UNEB format for Uganda schools — Class Teacher comments, HOD remarks, and Principal signature.",
  },
  {
    keywords: ["uneb", "ple", "uce", "uace", "registration", "candidate"],
    answer:
      "🎓 **UNEB Registration** in SkoolMate:\n\n• Go to **UNEB Registration** → register candidates by class\n• Assign index numbers to students\n• Export registration lists in UNEB-compatible format\n• Track PLE (P7), UCE (S4), UACE (S6) candidates\n• Links to NCDC syllabus tracking for exam preparation\n\nUNEB reports are generated in the format required by Uganda National Examinations Board.",
  },
  {
    keywords: ["demo", "demo mode", "test", "sample data"],
    answer:
      "🔍 **Demo Mode**:\n\nSkoolMate includes a demo mode with sample data for Kimuli Junior School so you can explore features without affecting real data. Demo mode is clearly indicated in the sidebar. To exit, log in with your school's credentials.",
  },
  {
    keywords: ["login", "password", "reset", "access", "account"],
    answer:
      "🔐 **Account & Access**:\n\n• Login at the main page with your email and password\n• Forgot password → click 'Forgot Password' on login\n• Contact your school admin to reset your password\n• Super admins manage all school accounts from the admin panel\n\nNeed urgent help? WhatsApp the team using the button below.",
  },
  {
    keywords: ["setup", "settings", "configure", "onboarding", "first time"],
    answer:
      "⚙️ **School Setup** in SkoolMate:\n\n1. **Setup Wizard** guides you through initial configuration\n2. Add **Classes**, **Subjects**, and **Timetable Slots** in Settings\n3. Import **Students** and **Staff** via CSV templates\n4. Configure **Fee Structure** for your term\n5. Enable SMS by adding your Africa's Talking API key\n\nDownload import templates from the **Import** section.",
  },
  {
    keywords: ["mtn", "airtel", "mobile money", "subscription", "plan", "billing", "upgrade"],
    answer:
      "💳 **Subscription & Billing**:\n\n• Plans available: Starter, Growth, Enterprise\n• Pay via MTN MoMo or Airtel Money\n• Go to your school's billing section to upgrade\n• MTN: You'll receive a USSD prompt on your phone\n• Airtel: You'll receive an Airtel Money prompt\n\nPowered by Flutterwave — Uganda's leading mobile payment gateway. Contact the team if payment isn't processing.",
  },
  {
    keywords: ["holiday", "public", "midterm", "term", "academic calendar", "eot", "end of term"],
    answer:
      "📅 **Academic Calendar** in Uganda:\n\n**2026 Uganda School Terms:**\n• Term 1: Jan 13 – Apr 3 (Midterm: Feb 14–16)\n• Term 2: May 11 – Aug 14 (Midterm: Jun 26–28)\n• Term 3: Sep 7 – Dec 5 (Midterm: Oct 19–21)\n\n**Public Holidays 2026:**\n• Jan 26 — Liberation Day\n• Feb 16 — Archbishop Janani Luwum Day\n• Mar 8 — International Women's Day\n• Apr 3 — Good Friday\n• May 1 — Labour Day\n• Jun 3 — Martyr's Day\n• Jun 9 — National Heroes Day\n• Oct 9 — Independence Day\n• Dec 25-26 — Christmas\n\nManage these in **Timetable → Term Calendar** tab.",
  },
  {
    keywords: ["help", "support", "contact", "issue", "problem", "bug"],
    answer:
      "🆘 **Getting Help**:\n\n• This assistant can answer most questions about SkoolMate\n• For urgent issues, WhatsApp the support team (button below)\n• Email: support@omuto.org\n• For NCDC curriculum questions, visit the official NCDC Uganda website at ncdc.go.ug\n\nWe typically respond within a few hours during school days.",
  },
];

function getResponse(input: string): string {
  const lower = input.toLowerCase();
  const match = KNOWLEDGE.find((entry) =>
    entry.keywords.some((kw) => lower.includes(kw)),
  );
  if (match) return match.answer;

  // Page-specific hints
  if (lower.includes("how") && lower.includes("add")) {
    return "💡 To add something, look for the **+ button** or **Add** button at the top right of any page. Most pages have a form or modal that opens when you click it.";
  }
  if (lower.includes("delete") || lower.includes("remove")) {
    return "🗑️ To delete records, look for a **trash/delete icon** on each row or card. Some sections require you to hover over an item first to see the delete button.";
  }
  if (lower.includes("export") || lower.includes("download")) {
    return "📥 For exports, go to the **Export** section in the sidebar, or look for the export button on individual pages (Grades, Reports, MoES, UNEB sections all have export functionality).";
  }
  if (lower.includes("import") || lower.includes("upload") || lower.includes("csv")) {
    return "📤 To import data, go to the **Import** section in the sidebar. Download the CSV template, fill it in, then upload. Students and Staff can be bulk-imported this way.";
  }

  return "🦉 I'm not sure about that specific question. Try asking about: **fees, attendance, grades, NCDC, timetable, SMS, students, staff, reports, UNEB, or setup**.\n\nOr click the WhatsApp button below to talk directly to the SkoolMate team!";
}

function formatMessage(text: string) {
  // Convert **bold** and newlines
  const parts = text.split("\n");
  return parts.map((line, i) => {
    const formattedLine = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    return (
      <span key={i}>
        <span dangerouslySetInnerHTML={{ __html: formattedLine }} />
        {i < parts.length - 1 && <br />}
      </span>
    );
  });
}

const WHATSAPP_NUMBER = "256700000000"; // Replace with actual team number
const WHATSAPP_MESSAGE = encodeURIComponent(
  "Hello SkoolMate team! I need help with the school management system.",
);

export default function OwlAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "🦉 Hello! I'm Owly, your SkoolMate assistant.\n\nI'm here to help with **school management**, the **SkoolMate app**, and the **NCDC Uganda curriculum**.\n\nWhat can I help you with today?",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

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

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;

    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    setMessages((prev) => [...prev, { role: "user", text, time: now }]);
    setInput("");
    setTyping(true);

    setTimeout(
      () => {
        const response = getResponse(text);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: response,
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
        setTyping(false);
      },
      600 + Math.random() * 400,
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Page-specific quick hints
  const getPageHints = () => {
    const path = pathname || "";
    if (path.includes("fees")) return ["How do I record a payment?", "Set up a payment plan"];
    if (path.includes("attendance")) return ["How does offline attendance work?", "Mark a student absent"];
    if (path.includes("grades")) return ["Lock grades after entering", "How does grading work?"];
    if (path.includes("syllabus")) return ["Load NCDC topics", "Mark a topic complete"];
    if (path.includes("timetable")) return ["Add a lesson slot", "View term calendar"];
    if (path.includes("staff")) return ["Add a new staff member", "Process payroll"];
    if (path.includes("students")) return ["Import students from CSV", "Transfer a student"];
    return ["How to use SkoolMate?", "NCDC curriculum help", "Subscription & billing"];
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[9990] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)]"
        style={{
          background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
        }}
        aria-label="Open SkoolMate Assistant"
        title="Owly — SkoolMate Assistant"
      >
        {open ? (
          <MaterialIcon icon="close" className="text-white text-2xl" />
        ) : (
          <span className="text-2xl select-none" role="img" aria-hidden>
            🦉
          </span>
        )}
        {!open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-400 border-2 border-white animate-pulse" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-[9989] w-[360px] max-w-[calc(100vw-24px)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{
            background: "var(--surface, #fff)",
            border: "1px solid var(--border, #e5e7eb)",
            maxHeight: "min(520px, calc(100vh - 120px))",
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center gap-3"
            style={{
              background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
            }}
          >
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-xl shrink-0">
              🦉
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-tight">Owly Assistant</p>
              <p className="text-white/70 text-xs">SkoolMate · NCDC · School Mgmt</p>
            </div>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
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
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-base shrink-0 mr-2 mt-1">
                    🦉
                  </div>
                )}
                <div className="max-w-[82%]">
                  <div
                    className={`px-3 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[var(--primary,#0d9488)] text-white rounded-tr-sm"
                        : "bg-[var(--surface-container-low,#f4f4f5)] text-[var(--t1,#111)] rounded-tl-sm"
                    }`}
                  >
                    {formatMessage(msg.text)}
                  </div>
                  <p className={`text-[10px] text-[var(--t4,#9ca3af)] mt-0.5 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                    {msg.time}
                  </p>
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-base">🦉</div>
                <div className="bg-[var(--surface-container-low,#f4f4f5)] px-3 py-2.5 rounded-2xl rounded-tl-sm">
                  <span className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick hints */}
          {messages.length <= 2 && (
            <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
              {getPageHints().map((hint, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(hint);
                    setTimeout(() => {
                      setInput("");
                      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                      setMessages((prev) => [...prev, { role: "user", text: hint, time: now }]);
                      setTyping(true);
                      setTimeout(() => {
                        const response = getResponse(hint);
                        setMessages((prev) => [
                          ...prev,
                          {
                            role: "assistant",
                            text: response,
                            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                          },
                        ]);
                        setTyping(false);
                      }, 700);
                    }, 50);
                  }}
                  className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs rounded-full border border-teal-200 hover:bg-teal-100 transition-colors"
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
              className="flex-1 px-3 py-2 rounded-xl text-sm bg-[var(--bg,#f9fafb)] border border-[var(--border,#e5e7eb)] outline-none focus:ring-2 focus:ring-teal-400/30 text-[var(--t1,#111)]"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || typing}
              className="w-9 h-9 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 flex items-center justify-center text-white transition-colors shrink-0"
            >
              <MaterialIcon icon="send" className="text-sm" />
            </button>
          </div>

          {/* Footer branding */}
          <div className="px-3 py-1.5 bg-[var(--surface-container-low,#f9fafb)] text-center">
            <p className="text-[9px] text-[var(--t4,#9ca3af)]">
              Powered by <span className="font-semibold">Omuto Foundation</span> · NCDC Uganda 2025
            </p>
          </div>
        </div>
      )}
    </>
  );
}
