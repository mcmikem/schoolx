"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import AnimatedLogo from "@/components/AnimatedLogo";
import LaptopMockup from "@/components/LaptopMockup";

function MaterialIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  return (
    <span className={`material-symbols-outlined ${className || ""}`}>
      {icon}
    </span>
  );
}

/* ─── Animated counter hook (supports decimals) ─── */
function useCounter(
  end: number,
  duration: number = 2000,
  decimals: number = 0,
) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let frame: number;
    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(eased * end);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [started, end, duration]);

  const display =
    decimals > 0 ? count.toFixed(decimals) : Math.round(count).toString();
  return { display, ref };
}

/* ─── Smooth scroll helper ─── */
function smoothScroll(id: string) {
  const el = document.querySelector(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ─── Trust badges (above the fold) ─── */
const trustBadges = [
  { icon: "lock", label: "TLS Encrypted" },
  { icon: "shield", label: "Role-Based Access" },
  { icon: "verified_user", label: "Uganda Data Protection Compliant" },
  { icon: "backup", label: "Auto-Backed Up" },
  { icon: "support_agent", label: "Local WhatsApp Support" },
  { icon: "cloud_done", label: "PostgreSQL / Supabase" },
];

/* ─── Hero stats (concrete, not vague) ─── */
const heroStats = [
  { label: "Setup time", value: "Under 5 minutes" },
  { label: "Works on", value: "Any device" },
  { label: "No credit card", value: "Needed to start" },
];

const roleStrip = [
  "Head teacher",
  "Dean of studies",
  "Bursar",
  "Class teacher",
  "Secretary",
  "Dorm master",
];

const proofPoints = [
  "Attendance before assembly",
  "Fees, balances, and mobile money records",
  "UNEB-ready grading and report cards",
  "Parent SMS, bulk alerts, and templates",
];

const stories = [
  {
    eyebrow: "Academic control",
    title:
      "From marks entry to printable report cards without spreadsheet chaos.",
    body: "Teachers enter assessments once, SkoolMate OS calculates the grade, and admin teams can print clean report cards or prepare UNEB-facing exports from the same workflow.",
    bullets: [
      "CA, BOT, Mid Term, Saturday Test, and EOT workflows",
      "Class comparison, grading rules, marks completion, and comments",
      "Printable reports for parents, directors, and board meetings",
    ],
  },
  {
    eyebrow: "Operations and finance",
    title:
      "Know who paid, who is absent, and what needs action before the first lesson starts.",
    body: "The dashboard brings together attendance, fee balances, budgeting, inventory, dorm records, staff activity, and health logs so the bursar and head teacher are not hunting through notebooks.",
    bullets: [
      "Fee collection history, invoices, receipts, and payment plans",
      "Cashbook, petty cash, payroll, budget, and approvals",
      "Student lookup, transfers, behavior, visitors, and leave tracking",
    ],
  },
  {
    eyebrow: "Parent communication",
    title: "Send the right message to the right parents at the right time.",
    body: "Use bulk SMS, saved templates, and automated reminders for fee balances, report availability, events, and attendance concerns. The result is fewer missed messages and faster follow-up.",
    bullets: [
      "Individual, class, and all-parent messaging",
      "Reusable SMS templates and auto-SMS triggers",
      "Parent portal and offline-first support on higher plans",
    ],
  },
];

const modules = [
  "Students and parent records",
  "Attendance and period attendance",
  "Exams, grading config, comments, report cards",
  "Fees, invoicing, payment plans, payroll, budgets",
  "UNEB registration, UNEB analysis, and MoES exports",
  "Bulk SMS, auto SMS triggers, notices, and parent portal",
];

const plans = [
  {
    name: "Starter",
    price: "UGX 50,000",
    cadence: "per student/year",
    description: "For small schools getting started with digital management.",
    features: [
      "Core modules (students, attendance, grades)",
      "500 SMS messages/month",
      "Basic reports",
      "Email support",
      "PDF report cards",
      "UNEB export",
    ],
  },
  {
    name: "Standard",
    price: "UGX 65,000",
    cadence: "per student/year",
    description:
      "For growing schools that need full automation and parent engagement.",
    features: [
      "All modules (fees, payroll, budgets, timetable)",
      "1,000 SMS messages/month",
      "Advanced reports & analytics",
      "Priority support",
      "Parent portal",
      "Multi-branch support",
    ],
    featured: true,
  },
  {
    name: "Premium",
    price: "UGX 80,000",
    cadence: "per student/year",
    description:
      "For large schools that want everything plus dedicated support.",
    features: [
      "Everything in Standard",
      "Unlimited SMS",
      "Full UNEB reports & MoES exports",
      "Dedicated account manager",
      "API access",
      "Training sessions for staff",
      "Custom integrations",
    ],
  },
];

const securityDetails = [
  {
    icon: "fingerprint",
    title: "Who can see what",
    desc: "Every role has strict boundaries. A teacher sees only their classes. A parent sees only their child. A bursar sees only finances. Even if someone shares a login, the system limits what they can access.",
  },
  {
    icon: "admin_panel_settings",
    title: "Data ownership",
    desc: "Your school data belongs to you — not to us. You can export everything at any time. If you leave, we delete your data within 30 days. We never use school data for training, advertising, or any purpose other than running your system.",
  },
  {
    icon: "security",
    title: "Infrastructure security",
    desc: "Hosted on Supabase (PostgreSQL) with row-level security policies. All connections use TLS 1.3. Database backups run continuously. Your data is encrypted at rest with AES-256.",
  },
  {
    icon: "gavel",
    title: "Uganda compliance",
    desc: "Built to align with Uganda's Data Protection and Privacy Act, 2019. Student records, parent contacts, and financial data are handled according to national requirements for personal information.",
  },
  {
    icon: "devices",
    title: "Device safety",
    desc: "Sessions expire after inactivity. Each login requires authentication. If a teacher loses their phone, you can revoke their access instantly from the dashboard without affecting anyone else.",
  },
  {
    icon: "history",
    title: "Audit trail",
    desc: "Every fee entry, grade change, and attendance correction is logged. You can see who changed what and when. This protects against accidental edits and makes accountability clear.",
  },
];

const storyMoments = [
  "Registers getting lost between offices and classrooms.",
  "Marks being calculated late into the night before report deadlines.",
  "Report cards taking weeks because the workflow lives in separate books and spreadsheets.",
  "Headteachers making serious decisions without a clear view of attendance, fees, or performance.",
];

const storyPrinciples = [
  "Simple enough for any teacher to use",
  "Reliable even when the internet is not",
  "Built around attendance, marks, fees, and communication in one flow",
  "Made to save time instead of creating more admin work",
];

const osxLinks = [
  "When student leaders track attendance or activities through OSX, SkoolMate OS makes that data visible and usable.",
  "When schools are working to improve academic performance, SkoolMate OS helps identify where students are struggling early.",
  "When leadership needs to act, SkoolMate OS replaces guesswork with a clean, current picture of the school.",
];

const faqItems = [
  {
    q: "Do I need internet to use SkoolMate OS?",
    a: "SkoolMate OS works best with internet, but the Premium and Max plans include offline mode. Teachers can mark attendance and enter grades without connection, and everything syncs automatically when internet returns.",
  },
  {
    q: "Can I import my existing student data?",
    a: "Yes. You can upload student records via CSV/Excel during setup. Our team can also help migrate data from your current system at no extra cost.",
  },
  {
    q: "What happens if I cancel my subscription?",
    a: "You keep access until the end of your current term. After that, you can export all your data. We delete your school's data within 30 days of cancellation unless you request otherwise.",
  },
  {
    q: "Will it work on my phone?",
    a: "Yes. SkoolMate OS is fully responsive and works on any smartphone, tablet, or computer. The mobile experience is optimised for teachers marking attendance on the go.",
  },
  {
    q: "How long does setup take?",
    a: "Most schools are up and running in under 5 minutes. Add your school name, create classes, and you can start recording attendance immediately. Full setup with all students typically takes one afternoon.",
  },
  {
    q: "Is there training for our staff?",
    a: "Yes. We provide free onboarding via WhatsApp or in-person for schools in Uganda. We also have video tutorials and a help section inside the dashboard.",
  },
];

/* ─── Desktop mockup tab content ─── */
const tabContent: Record<
  number,
  {
    stats: [string, string, string][];
    bars?: { name: string; value: number; color: string }[];
    actions?: { title: string; note: string; icon: string }[];
    students?: { name: string; class: string; balance: string }[];
  }
> = {
  0: {
    stats: [
      ["Fees this term", "UGX 18.4M", "cash, bank, and mobile money"],
      ["Staff on duty", "43", "present and late captured"],
      ["Low attendance", "3", "follow-up before assembly"],
    ],
    bars: [
      { name: "S.1", value: 78, color: "bg-[#17325F]" },
      { name: "S.2", value: 84, color: "bg-[#2E9448]" },
      { name: "S.3", value: 71, color: "bg-[#B86B0C]" },
      { name: "S.4", value: 88, color: "bg-[#17325F]" },
    ],
    actions: [
      {
        title: "Approve expense request",
        note: "Lab practical supplies",
        icon: "payments",
      },
      {
        title: "Review leave request",
        note: "2 staff awaiting action",
        icon: "event_busy",
      },
      {
        title: "Send fee reminder",
        note: "S.2 Blue parents with balances",
        icon: "sms",
      },
      {
        title: "Print report cards",
        note: "S.4 candidate review",
        icon: "description",
      },
    ],
  },
  1: {
    stats: [
      ["Total students", "847", "active across 24 classes"],
      ["New this term", "62", "admissions processed"],
      ["Transfers", "5", "pending approval"],
    ],
    students: [
      { name: "Nakamya Sarah", class: "S.3 Blue", balance: "UGX 185,000" },
      { name: "Ochen David", class: "S.2 Red", balance: "UGX 0" },
      { name: "Achieng Grace", class: "S.4 Green", balance: "UGX 320,000" },
      { name: "Mugisha Brian", class: "S.1 Blue", balance: "UGX 0" },
    ],
  },
  2: {
    stats: [
      ["Present today", "782", "out of 847 students"],
      ["Absent", "65", "7.7% absence rate"],
      ["Late", "12", "arrived after 8:00 AM"],
    ],
    bars: [
      { name: "P.7", value: 92, color: "bg-[#2E9448]" },
      { name: "S.1", value: 85, color: "bg-[#17325F]" },
      { name: "S.2", value: 78, color: "bg-[#B86B0C]" },
      { name: "S.4", value: 95, color: "bg-[#2E9448]" },
    ],
  },
  3: {
    stats: [
      ["Exams this term", "4", "CA, BOT, Mid Term, EOT"],
      ["Grades entered", "89%", "21 of 24 classes"],
      ["Report cards", "Ready", "S.4 candidates"],
    ],
    bars: [
      { name: "S.1", value: 78, color: "bg-[#17325F]" },
      { name: "S.2", value: 84, color: "bg-[#2E9448]" },
      { name: "S.3", value: 71, color: "bg-[#B86B0C]" },
      { name: "S.4", value: 88, color: "bg-[#17325F]" },
    ],
  },
  4: {
    stats: [
      ["Collected", "UGX 18.4M", "this term"],
      ["Outstanding", "UGX 6.2M", "across 127 students"],
      ["Today", "UGX 840K", "3 payments"],
    ],
    actions: [
      {
        title: "Record payment",
        note: "Walk-in or mobile money",
        icon: "add_card",
      },
      {
        title: "Send fee reminder",
        note: "127 parents with balances",
        icon: "sms",
      },
      {
        title: "Generate invoice",
        note: "S.2 Blue class",
        icon: "description",
      },
      { title: "View cashbook", note: "All transactions", icon: "book" },
    ],
  },
  5: {
    stats: [
      ["SMS sent today", "426", "bulk to S.4 parents"],
      ["Delivery rate", "97%", "413 delivered"],
      ["Templates", "12", "saved"],
    ],
    actions: [
      {
        title: "Send bulk SMS",
        note: "All parents, fee reminder",
        icon: "sms",
      },
      {
        title: "New template",
        note: "Save reusable message",
        icon: "note_add",
      },
      {
        title: "View delivery",
        note: "Track sent messages",
        icon: "track_changes",
      },
    ],
  },
};

function DesktopMockup() {
  const [activeTab, setActiveTab] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const content = tabContent[activeTab];
  const feeCounter = useCounter(18.4, 2500, 1);
  const staffCounter = useCounter(43, 1800);
  const lowAttCounter = useCounter(3, 1200);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setActiveTab(index);
    }
  };

  return (
    <div
      className={`mockup-shell mockup-desktop relative rounded-[32px] border border-slate-200 bg-white p-3 shadow-[0_40px_90px_rgba(15,23,42,0.14)] transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
    >
      <div className="rounded-[28px] border border-slate-200 bg-[#f8fbff] overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-500">
            schoolx.app/dashboard
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-[#0e2345] p-5 text-white lg:border-b-0 lg:border-r">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/12 text-white">
                <MaterialIcon icon="school" className="text-[20px]" />
              </div>
              <div>
                <p className="text-sm font-semibold">SkoolMate OS</p>
                <p className="text-xs text-white/65">Head teacher workspace</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {[
                "Dashboard",
                "Students",
                "Attendance",
                "Exams",
                "Finance",
                "Messages",
              ].map((item, index) => (
                <button
                  key={item}
                  onClick={() => setActiveTab(index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  tabIndex={0}
                  aria-pressed={index === activeTab}
                  className={`w-full text-left rounded-2xl px-3 py-2.5 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50 ${
                    index === activeTab
                      ? "bg-white text-[#0e2345] shadow-sm"
                      : "bg-white/5 text-white/80 hover:bg-white/10"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </aside>

          <div className="space-y-4 p-4 sm:p-5">
            <div className="grid gap-3 md:grid-cols-3">
              {content.stats.map(([label, value, note], i) => {
                const counter =
                  i === 0 ? feeCounter : i === 1 ? staffCounter : lowAttCounter;
                return (
                  <div
                    key={label}
                    ref={counter.ref}
                    className="story-card rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:shadow-md transition-shadow cursor-default"
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                      {label}
                    </p>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                      {i === 0 && activeTab === 0
                        ? `UGX ${counter.display}M`
                        : value}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{note}</p>
                  </div>
                );
              })}
            </div>

            {content.bars && (
              <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {activeTab === 2
                        ? "Attendance by class"
                        : activeTab === 3
                          ? "Candidate and class performance"
                          : "Performance overview"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Term II academic snapshot
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  {content.bars.map((bar, i) => (
                    <div key={bar.name}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">
                          {bar.name}
                        </span>
                        <span className="text-slate-500">{bar.value}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full ${bar.color} transition-all duration-1000 ease-out`}
                          style={{
                            width: mounted ? `${bar.value}%` : "0%",
                            transitionDelay: `${i * 200 + 300}ms`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {content.students && (
              <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <p className="text-sm font-semibold text-slate-900 mb-4">
                  Recent students
                </p>
                <div className="space-y-3">
                  {content.students.map((s) => (
                    <div
                      key={s.name}
                      className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {s.name}
                        </p>
                        <p className="text-xs text-slate-500">{s.class}</p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${s.balance === "UGX 0" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                      >
                        {s.balance}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {content.actions && (
              <div className="rounded-[28px] bg-[#eef5ff] p-5 ring-1 ring-[#d7e4fb]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Quick actions
                    </p>
                    <p className="text-xs text-slate-500">Common tasks</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {content.actions.map((item, i) => (
                    <div
                      key={item.title}
                      className={`story-card flex items-start gap-3 rounded-[22px] bg-white p-3.5 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer ${
                        mounted
                          ? "opacity-100 translate-x-0"
                          : "opacity-0 translate-x-4"
                      }`}
                      style={{ transitionDelay: `${i * 100 + 300}ms` }}
                    >
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#17325F]/8 text-[#17325F] flex-shrink-0">
                        <MaterialIcon
                          icon={item.icon}
                          className="text-[20px]"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {item.note}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Interactive Phone Mockup ─── */
const smsMessages = [
  {
    from: "SkoolMate OS",
    text: "Dear parent, your child was absent today and current Term II fee balance is UGX 185,000. Please contact the office if you need a statement.",
    type: "incoming",
  },
  {
    from: "System",
    text: "Bulk SMS delivered — S.4 candidates, 8:14 AM. 426 recipients, 147/160 characters.",
    type: "outgoing",
  },
];

function PhoneMockup() {
  const [activeMsg, setActiveMsg] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [mounted, setMounted] = useState(false);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const msg = smsMessages[activeMsg].text;
    setTypedText("");
    let i = 0;
    typingRef.current = setInterval(() => {
      if (i <= msg.length) {
        setTypedText(msg.slice(0, i));
        i++;
      } else {
        if (typingRef.current) clearInterval(typingRef.current);
        nextRef.current = setTimeout(
          () => setActiveMsg((prev) => (prev + 1) % smsMessages.length),
          3000,
        );
      }
    }, 25);
    return () => {
      if (typingRef.current) clearInterval(typingRef.current);
      if (nextRef.current) clearTimeout(nextRef.current);
    };
  }, [activeMsg]);

  return (
    <div
      className={`mockup-shell mockup-phone mx-auto w-[280px] rounded-[36px] border border-slate-200 bg-[#0b1220] p-2.5 shadow-[0_35px_80px_rgba(15,23,42,0.2)] transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
    >
      <div className="overflow-hidden rounded-[30px] bg-white">
        <div className="flex items-center justify-between bg-[#17325F] px-4 pb-3 pt-4 text-white">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/65">
              SkoolMate OS parent portal
            </p>
            <p className="text-sm font-semibold">Fee &amp; attendance update</p>
          </div>
          <div className="rounded-full bg-white/10 px-2.5 py-1 text-[11px]">
            SMS
          </div>
        </div>

        <div className="space-y-3 bg-[#f6f9fc] p-4">
          <div className="rounded-[24px] bg-white p-3.5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-900 mb-2">
              {smsMessages[activeMsg].from}
              <span className="ml-2 text-[10px] text-slate-400 font-normal">
                {activeMsg === 0 ? "Incoming" : "Outgoing"}
              </span>
            </p>
            <div className="h-[72px] overflow-hidden">
              <p className="text-sm leading-6 text-slate-600">
                {typedText}
                <span className="inline-block w-[2px] h-[16px] bg-[#17325F] ml-0.5 animate-pulse align-middle" />
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[20px] bg-white p-3 shadow-sm ring-1 ring-slate-200 hover:ring-[#17325F]/30 transition-all">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Recipients
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">426</p>
            </div>
            <div className="rounded-[20px] bg-white p-3 shadow-sm ring-1 ring-slate-200 hover:ring-[#17325F]/30 transition-all">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Characters
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                147/160
              </p>
            </div>
          </div>

          <div className="flex justify-center gap-2 pt-1">
            {smsMessages.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveMsg(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveMsg(i);
                  }
                }}
                tabIndex={0}
                aria-label={`View message ${i + 1}`}
                className={`h-2 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#17325F] ${
                  i === activeMsg ? "w-6 bg-[#17325F]" : "w-2 bg-slate-300"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Scroll animation wrapper ─── */
function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── FAQ Accordion ─── */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white hover:shadow-sm transition-shadow">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#17325F]/30"
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-slate-900 pr-4">{q}</span>
        <span
          className={`material-symbols-outlined text-[#17325F] transition-transform duration-300 flex-shrink-0 ${open ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? "max-h-48 pb-5" : "max-h-0"}`}
      >
        <p className="px-6 text-sm leading-6 text-slate-600">{a}</p>
      </div>
    </div>
  );
}

/* ─── HOME PAGE ─── */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // If running in Capacitor (Mobile APK), skip landing page and go straight to login
    const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor?.isNative;
    if (isCapacitor) {
      router.push("/login");
    }
  }, [router]);

  return (
    <main
      className="min-h-screen bg-[var(--bg)] text-[var(--t1)]"
      id="main-content"
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-[var(--primary)] focus:px-4 focus:py-2 focus:text-[var(--on-primary)]"
      >
        Skip to main content
      </a>
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(circle_at_top_left,_rgba(23,50,95,0.13),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(46,148,72,0.10),_transparent_38%),linear-gradient(180deg,_#ffffff_0%,_var(--bg)_72%)]" />
        <div className="absolute left-[8%] top-24 h-40 w-40 rounded-full bg-[#d6e4ff] blur-3xl opacity-50" />
        <div className="absolute right-[10%] top-40 h-48 w-48 rounded-full bg-[#dff3e5] blur-3xl opacity-50" />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pb-24">
          {/* Nav */}
          <nav className="flex items-center justify-between rounded-full border border-white/70 bg-white/80 px-4 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur sm:px-6">
            <SkoolMateLogo size="md" variant="default" />
            <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
              <button
                onClick={() => smoothScroll("#features")}
                className="transition hover:text-slate-950 cursor-pointer"
              >
                Features
              </button>
              <button
                onClick={() => smoothScroll("#story")}
                className="transition hover:text-slate-950 cursor-pointer"
              >
                Story
              </button>
              <button
                onClick={() => smoothScroll("#security")}
                className="transition hover:text-slate-950 cursor-pointer"
              >
                Security
              </button>
              <button
                onClick={() => smoothScroll("#pricing")}
                className="transition hover:text-slate-950 cursor-pointer"
              >
                Pricing
              </button>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/login" className="btn btn-secondary btn-sm">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                Start free trial
              </Link>
            </div>
          </nav>

          {/* Role strip */}
          <div className="mt-5 overflow-hidden rounded-full border border-[var(--border)] bg-white/70 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--t3)] sm:text-xs">
              {roleStrip.map((role) => (
                <span key={role} className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--green)]" />
                  {role}
                </span>
              ))}
            </div>
          </div>

          {/* Hero grid */}
          <div className="grid gap-14 pt-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:pt-20">
            <div className="max-w-2xl">
              <div className="mb-6 flex animate-fade-in">
                <div className="px-4 py-1.5 rounded-full bg-[var(--navy-soft)] border border-[var(--navy)]/10 text-[var(--navy)] text-[10px] uppercase font-bold tracking-widest flex items-center gap-2">
                  <MaterialIcon icon="award_star" className="text-sm" />
                  Uganda&apos;s Premium School OS
                </div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--primary)] shadow-sm">
                <MaterialIcon icon="bolt" className="text-[18px]" />
                Built from experience on the ground in schools
              </div>
              <h1 className="mt-6 font-['Sora'] text-5xl font-semibold leading-[0.95] tracking-[-0.05em] text-[var(--t1)] sm:text-6xl lg:text-7xl">
                Run your entire school
                <br />
                from one <span className="text-[var(--green)]">dashboard</span>.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--t2)] sm:text-xl">
                Attendance, grades, fees, and parent SMS — all in one system
                built for Ugandan schools. Stop juggling notebooks and
                spreadsheets.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="btn btn-primary px-7 py-4 text-base"
                >
                  Start 30-day free trial
                </Link>
                <Link
                  href="/login"
                  className="btn btn-secondary px-7 py-4 text-base"
                >
                  Open dashboard
                </Link>
              </div>

              {/* Trust badges — ABOVE THE FOLD */}
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
                {trustBadges.map((badge) => (
                  <div
                    key={badge.label}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--t3)]"
                  >
                    <MaterialIcon
                      icon={badge.icon}
                      className="text-[14px] text-[var(--green)]"
                    />
                    {badge.label}
                  </div>
                ))}
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {heroStats.map((item) => (
                  <div
                    key={item.label}
                    className="story-card rounded-[24px] border border-[var(--border)] bg-white/90 p-4 shadow-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--t3)]">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--t1)]">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Mockups */}
            <div className="relative hero-stage">
              {/* Floating note — visible on all sizes now */}
              <div className="floating-note absolute right-0 top-0 z-20 w-52 rounded-[28px] border border-white/70 bg-white/88 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur xl:block hidden">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Today at a glance
                </p>
                <div className="mt-4 space-y-3">
                  {[
                    ["Attendance filed", "12 classes by 8:05 AM"],
                    ["Fee follow-up", "426 parents queued"],
                    ["Candidate review", "S.4 report cards ready"],
                  ].map(([label, note]) => (
                    <div
                      key={label}
                      className="rounded-[20px] bg-slate-50 p-3 ring-1 ring-slate-200"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="phone-stage relative z-10 mx-auto mb-6 max-w-[320px] lg:absolute lg:-left-8 lg:top-10 lg:mb-0 xl:block">
                <PhoneMockup />
              </div>
              <div className="desktop-stage relative z-0 lg:ml-16">
                <LaptopMockup />
              </div>
              {/* Floating callout — visible on all sizes now */}
              <div className="floating-callout absolute bottom-5 left-3 z-20 rounded-[24px] border border-[#d7e4fb] bg-white/92 px-4 py-3 shadow-[0_22px_55px_rgba(15,23,42,0.12)] backdrop-blur md:block hidden">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                  From registers to reports
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--t1)]">
                  One flow, one view, one calmer morning.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW TO GET STARTED ===== */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center mb-10">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
              Get started in 3 steps
            </p>
            <h2 className="mt-3 font-['Sora'] text-2xl font-semibold text-slate-950 sm:text-3xl">
              From signup to running your school
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                step: "1",
                icon: "how_to_reg",
                title: "Register your school",
                desc: "Create your account in under 2 minutes. No credit card needed.",
              },
              {
                step: "2",
                icon: "group_add",
                title: "Add your students",
                desc: "Upload a CSV or add students manually. Create classes and subjects.",
              },
              {
                step: "3",
                icon: "rocket_launch",
                title: "Start using it",
                desc: "Mark attendance, record fees, send SMS — your school runs from one place.",
              },
            ].map((item, i) => (
              <FadeIn key={item.step} delay={i * 150}>
                <div className="relative rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow text-center">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-[#17325F] text-white text-xs font-bold flex items-center justify-center">
                    {item.step}
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#2E9448] mx-auto mt-2">
                    <MaterialIcon icon={item.icon} className="text-[26px]" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ===== FEATURES ===== */}
      <section
        id="features"
        className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24"
      >
        <FadeIn>
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                What schools actually need
              </p>
              <h2 className="mt-4 max-w-md font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
                Not generic software. Real workflows for head teachers, bursars,
                deans of studies, and class teachers.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {proofPoints.map((item, i) => (
                <FadeIn key={item} delay={i * 100}>
                  <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow h-full">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#17325F]/8 text-[#17325F]">
                      <MaterialIcon
                        icon="check_circle"
                        className="text-[22px]"
                      />
                    </div>
                    <p className="mt-4 text-lg font-semibold tracking-tight text-slate-900">
                      {item}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how-it-works" className="bg-white py-18 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6">
            {stories.map((story, index) => (
              <FadeIn key={story.title} delay={index * 150}>
                <div className="grid gap-6 rounded-[36px] border border-slate-200 p-6 shadow-sm lg:grid-cols-[0.82fr_1.18fr] lg:p-8 hover:shadow-md transition-shadow">
                  <div
                    className={`rounded-[30px] p-6 ${index === 1 ? "bg-[#17325F] text-white" : "bg-[#f5f8fc] text-slate-900"}`}
                  >
                    <p
                      className={`text-xs font-semibold uppercase tracking-[0.24em] ${index === 1 ? "text-white/65" : "text-[#17325F]"}`}
                    >
                      {story.eyebrow}
                    </p>
                    <h3 className="mt-4 font-['Sora'] text-2xl font-semibold leading-tight tracking-[-0.03em]">
                      {story.title}
                    </h3>
                    <p
                      className={`mt-4 text-base leading-7 ${index === 1 ? "text-white/78" : "text-slate-600"}`}
                    >
                      {story.body}
                    </p>
                  </div>
                  <div className="grid gap-3 self-center">
                    {story.bullets.map((bullet) => (
                      <div
                        key={bullet}
                        className="flex items-start gap-3 rounded-[22px] bg-slate-50 px-4 py-4 ring-1 ring-slate-200 hover:ring-[#17325F]/20 transition-colors"
                      >
                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-[#17325F] shadow-sm ring-1 ring-slate-200">
                          <MaterialIcon
                            icon="arrow_outward"
                            className="text-[18px]"
                          />
                        </div>
                        <p className="text-sm font-medium leading-6 text-slate-700">
                          {bullet}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== STORY ===== */}
      <section
        id="story"
        className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24"
      >
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <FadeIn>
            <div className="rounded-[34px] bg-[#0f1f3d] p-7 text-white shadow-[0_24px_60px_rgba(15,23,42,0.16)] lg:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/60">
                The story behind SkoolMate OS
              </p>
              <h2 className="mt-4 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
                It did not start as an idea. It started with what schools kept
                carrying every day.
              </h2>
              <p className="mt-5 text-base leading-7 text-white/76">
                At Omuto Foundation, the work has been close enough to schools
                to see the real picture, not an abstract one. The issue was
                never that people were not trying. The issue was that the system
                around them kept slowing the work down.
              </p>
              <div className="mt-8 grid gap-3">
                {storyMoments.map((item) => (
                  <div
                    key={item}
                    className="story-card rounded-[22px] border border-white/10 bg-white/6 px-4 py-4"
                  >
                    <p className="text-sm leading-6 text-white/82">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          <div className="grid gap-5">
            <FadeIn>
              <div className="rounded-[34px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                  What became obvious
                </p>
                <h3 className="mt-4 font-['Sora'] text-2xl font-semibold leading-tight tracking-[-0.03em] text-slate-950">
                  Schools do not need more pressure. They need better tools.
                </h3>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  SkoolMate OS was built to match the real flow of school life:
                  attendance, marks, fees, communication, and decision-making in
                  one place. Not another generic system. A calmer operating
                  layer for schools that are already working hard.
                </p>
              </div>
            </FadeIn>

            <div className="grid gap-4 sm:grid-cols-2">
              {storyPrinciples.map((item, i) => (
                <FadeIn key={item} delay={i * 100}>
                  <div className="story-card rounded-[28px] border border-slate-200 bg-[#f8fbff] p-5 shadow-sm h-full">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#17325F]/8 text-[#17325F]">
                      <MaterialIcon icon="bolt" className="text-[20px]" />
                    </div>
                    <p className="mt-4 text-base font-semibold leading-7 text-slate-900">
                      {item}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>

            <FadeIn delay={200}>
              <div className="rounded-[34px] border border-[#d7e4fb] bg-[linear-gradient(180deg,#ffffff_0%,#f5f9ff_100%)] p-6 shadow-sm lg:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                  What changes when the system runs well
                </p>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  Teachers get more time to focus on students. Leaders can see
                  what is working and what is not. Parents stay informed.
                  Students are noticed early instead of slipping through the
                  cracks. The X in SkoolMate OS stands for Xperience, because
                  this system comes from what has been seen, learned, and asked
                  for in the field.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ===== MODULES ===== */}
      <section className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24">
        <FadeIn>
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                Inside the platform
              </p>
              <h2 className="mt-4 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
                Every major school unit connected in one system.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
                From academics to administration, SkoolMate OS is designed to
                reduce duplicate work. Enter data once, then reuse it across
                report cards, parent communication, financial follow-up, UNEB
                prep, and board reporting.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {modules.map((module, i) => (
                <FadeIn key={module} delay={i * 80}>
                  <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm hover:shadow-md hover:border-[#2E9448]/30 transition-all cursor-default">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#2E9448]">
                        <MaterialIcon
                          icon="grid_view"
                          className="text-[20px]"
                        />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">
                        {module}
                      </p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ===== OSX ===== */}
      <section id="osx" className="bg-white py-18 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                  SkoolMate OS and OSX
                </p>
                <h2 className="mt-4 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
                  SkoolMate OS is the system layer inside the wider Omuto School
                  Xperience.
                </h2>
                <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
                  OSX is the broader transformation model. SkoolMate OS is the
                  layer that helps that transformation hold, because progress is
                  hard to sustain when the underlying school systems stay
                  scattered and manual.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[32px] border border-slate-200 bg-[#f7f9fc] p-6 shadow-sm lg:p-8">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] bg-white p-5 ring-1 ring-slate-200 hover:shadow-md transition-shadow">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                        OSX
                      </p>
                      <p className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
                        Drives transformation
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        Leadership, student engagement, accountability, and a
                        culture where schools do not just operate, but perform.
                      </p>
                    </div>
                    <div className="rounded-[24px] bg-[#17325F] p-5 text-white hover:shadow-lg transition-shadow">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
                        SkoolMate OS
                      </p>
                      <p className="mt-3 text-xl font-semibold tracking-tight">
                        Sustains it daily
                      </p>
                      <p className="mt-3 text-sm leading-6 text-white/76">
                        Attendance, academics, fees, communication, and
                        operational visibility working in one reliable school
                        workflow.
                      </p>
                    </div>
                  </div>
                </div>

                {osxLinks.map((item, i) => (
                  <FadeIn key={item} delay={i * 100}>
                    <div className="story-card flex items-start gap-3 rounded-[26px] border border-slate-200 bg-white px-5 py-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#2E9448] flex-shrink-0">
                        <MaterialIcon
                          icon="north_east"
                          className="text-[18px]"
                        />
                      </div>
                      <p className="text-sm leading-6 text-slate-700">{item}</p>
                    </div>
                  </FadeIn>
                ))}

                <div className="rounded-[30px] border border-[#d7e4fb] bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                    The result
                  </p>
                  <p className="mt-4 text-base leading-7 text-slate-700">
                    Together, OSX drives the transformation and SkoolMate OS
                    makes it visible, usable, and measurable. That is the
                    complete school experience: organised systems, informed
                    decisions, earlier support, and progress that leaders can
                    actually track.
                  </p>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ===== SECURITY & DATA PROTECTION ===== */}
      <section
        id="security"
        className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24"
      >
        <FadeIn>
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
              Security &amp; Data Protection
            </p>
            <h2 className="mt-4 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
              Your school data is safe with us.
            </h2>
            <p className="mt-5 max-w-2xl mx-auto text-lg leading-8 text-slate-600">
              Student records, grades, and financial data are sensitive. Here is
              exactly how we protect your school — in plain language.
            </p>
          </div>
        </FadeIn>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {securityDetails.map((feature, i) => (
            <FadeIn key={feature.title} delay={i * 100}>
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-[#2E9448]/30 transition-all h-full">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#2E9448]">
                  <MaterialIcon icon={feature.icon} className="text-[24px]" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {feature.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="bg-[#0d1930] py-18 text-white lg:py-24">
        <div className="absolute top-8 left-8 opacity-30">
          <AnimatedLogo type="logo_white" className="w-16 h-16" />
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/60">
                Pricing
              </p>
              <h2 className="mt-4 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
                Clear term pricing for schools that want to move fast.
              </h2>
              <p className="mt-5 text-lg leading-8 text-white/72">
                Start with a 30-day free trial. Upgrade when your team is ready.
              </p>
            </div>
          </FadeIn>

          <div className="mt-10 grid gap-5 lg:grid-cols-3 overflow-x-hidden">
            {plans.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 150}>
                <div
                  className={`rounded-[32px] border p-6 h-full flex flex-col ${
                    plan.featured
                      ? "border-white/20 bg-white text-slate-950 shadow-[0_24px_60px_rgba(0,0,0,0.28)] lg:scale-[1.02]"
                      : "border-white/12 bg-white/6 backdrop-blur"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p
                      className={`text-lg font-semibold ${plan.featured ? "text-slate-950" : "text-white"}`}
                    >
                      {plan.name}
                    </p>
                    {plan.featured && (
                      <span className="rounded-full bg-[#17325F] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                        Most chosen
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-4 font-['Sora'] text-4xl font-semibold tracking-[-0.05em] ${plan.featured ? "text-slate-950" : "text-white"}`}
                  >
                    {plan.price}
                  </p>
                  <p
                    className={`mt-1 text-sm ${plan.featured ? "text-slate-500" : "text-white/60"}`}
                  >
                    {plan.cadence}
                  </p>
                  <p
                    className={`mt-5 text-sm leading-6 ${plan.featured ? "text-slate-600" : "text-white/72"}`}
                  >
                    {plan.description}
                  </p>
                  <div className="mt-6 space-y-3 flex-1">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-3">
                        <MaterialIcon
                          icon="check"
                          className={`mt-0.5 text-[18px] ${plan.featured ? "text-[#2E9448]" : "text-white"}`}
                        />
                        <p
                          className={`text-sm ${plan.featured ? "text-slate-700" : "text-white/80"}`}
                        >
                          {feature}
                        </p>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/register"
                    className={`mt-8 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                      plan.featured
                        ? "bg-[var(--primary)] text-[var(--on-primary)] hover:opacity-90"
                        : "bg-white text-[var(--t1)] hover:bg-[var(--surface-container)]"
                    }`}
                  >
                    Start with {plan.name}
                  </Link>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="mx-auto max-w-3xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24">
        <FadeIn>
          <div className="text-center mb-10">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
              Frequently asked questions
            </p>
            <h2 className="mt-3 font-['Sora'] text-2xl font-semibold text-slate-950 sm:text-3xl">
              Questions schools ask before signing up
            </h2>
          </div>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <FadeIn key={item.q} delay={i * 80}>
                <FAQItem q={item.q} a={item.a} />
              </FadeIn>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="rounded-[36px] border border-[var(--border)] bg-[var(--surface)] px-6 py-8 shadow-[var(--sh1)] sm:px-8 lg:flex lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">
                Ready to launch
              </p>
              <h2 className="mt-3 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-[var(--t1)]">
                Give your school one place to run the term.
              </h2>
              <p className="mt-4 text-base leading-7 text-[var(--t2)]">
                Register your school, set up classes and subjects, and start
                using attendance, grading, fees, and parent communication in a
                single workspace.
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
              <Link
                href="/register"
                className="btn btn-primary px-7 py-4 text-base"
              >
                Start free trial
              </Link>
              <Link
                href="/login"
                className="btn btn-secondary px-7 py-4 text-base"
              >
                Sign in
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <SkoolMateLogo size="md" variant="default" />
              <p className="mt-4 text-sm leading-6 text-slate-500">
                The school operating system built from real experience in
                Ugandan schools.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
                Product
              </h4>
              <ul className="mt-4 space-y-3">
                <li>
                  <button
                    onClick={() => smoothScroll("#features")}
                    className="text-sm text-slate-600 hover:text-slate-900 transition cursor-pointer"
                  >
                    Features
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => smoothScroll("#pricing")}
                    className="text-sm text-slate-600 hover:text-slate-900 transition cursor-pointer"
                  >
                    Pricing
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => smoothScroll("#security")}
                    className="text-sm text-slate-600 hover:text-slate-900 transition cursor-pointer"
                  >
                    Security
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
                Resources
              </h4>
              <ul className="mt-4 space-y-3">
                <li>
                  <a
                    href="/login"
                    className="text-sm text-slate-600 hover:text-slate-900 transition"
                  >
                    Sign In
                  </a>
                </li>
                <li>
                  <a
                    href="/register"
                    className="text-sm text-slate-600 hover:text-slate-900 transition"
                  >
                    Register School
                  </a>
                </li>
                <li>
                  <Link
                    href="/parent"
                    className="text-sm text-slate-600 hover:text-slate-900 transition"
                  >
                    Parent Portal
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
                Contact
              </h4>
              <ul className="mt-4 space-y-3">
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <MaterialIcon
                    icon="mail"
                    className="text-[16px] text-[#17325F]"
                  />
                  <a
                    href="mailto:sms@omuto.org"
                    className="hover:text-slate-900 transition"
                  >
                    sms@omuto.org
                  </a>
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <MaterialIcon
                    icon="phone"
                    className="text-[16px] text-[#17325F]"
                  />
                  <a
                    href="tel:0750028703"
                    className="hover:text-slate-900 transition"
                  >
                    0750 028 703
                  </a>
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <MaterialIcon
                    icon="chat"
                    className="text-[16px] text-[#25D366]"
                  />
                  <a
                    href="https://wa.me/256750028703"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-slate-900 transition"
                  >
                    WhatsApp
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-slate-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-400">
              &copy; {new Date().getFullYear()} Omuto Foundation. All rights
              reserved.
            </p>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <MaterialIcon icon="lock" className="text-[14px]" />
              <span>Your data is encrypted and never shared.</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
