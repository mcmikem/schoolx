"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import AnimatedLogo from "@/components/AnimatedLogo";
import LaptopMockup from "@/components/LaptopMockup";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type DownloadTarget = {
  key: string;
  href?: string;
  label: string;
  icon: string;
  helper: string;
  badge: string;
  useInstallPrompt?: boolean;
};

const ANDROID_APP_URL = process.env.NEXT_PUBLIC_ANDROID_APP_URL || "";
const WINDOWS_APP_URL = process.env.NEXT_PUBLIC_WINDOWS_APP_URL || "";
const MAC_APP_URL = process.env.NEXT_PUBLIC_MAC_APP_URL || "";

const HEADLINES = [
  "Save 5+ hours every week",
  "Your school in your hand",
  "One place. Complete control",
  "Stop juggling spreadsheets",
  "Everything runs smoother",
  "Finally, it all connects",
  "Built for Ugandan schools",
  "Your school, simplified",
];

const ROTATION_INTERVAL = 4000;

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
  try {
    const el = document.querySelector(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      // Fallback to window scroll
      const target = id.replace("#", "");
      const targetEl = document.getElementById(target);
      if (targetEl)
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (e) {
    console.error("Scroll error:", e);
  }
}

/* ─── Trust badges (above the fold) ─── */
const trustBadges = [
  { icon: "verified", label: "Aligned with NCDC 2025" },
  { icon: "fact_check", label: "UNEB-ready formats" },
  { icon: "location_on", label: "Made in Uganda" },
  { icon: "support_agent", label: "Local WhatsApp Support" },
  { icon: "wifi_off", label: "Works Offline" },
  { icon: "security", label: "Data Protection Act Compliant" },
];

const modules = [
  { icon: "group", label: "Student & parent records" },
  { icon: "how_to_reg", label: "Attendance and period registers" },
  { icon: "fact_check", label: "Exams, grades, and report cards" },
  { icon: "payments", label: "Fees, payroll, and budgets" },
  { icon: "assignment", label: "UNEB registration and MoES exports" },
  { icon: "sms", label: "Bulk SMS, alerts, and parent portal" },
];

const plans = [
  {
    name: "Starter",
    price: "UGX 2,000",
    cadence: "per student/term",
    bestFor: "Rural primary · under 200 students",
    features: [
      "Student records & profiles",
      "Daily attendance",
      "CA entry & report cards",
      "Fee collection & tracking",
      "MTN MoMo + Airtel Money",
      "Offline sync (works without internet)",
      "ID card generation",
      "Up to 3 admin users",
    ],
  },
  {
    name: "Growth",
    price: "UGX 3,500",
    cadence: "per student/term",
    bestFor: "Urban primary · 200-500 students",
    features: [
      "Everything in Starter",
      "Bulk SMS (200/term included)",
      "Parent portal",
      "NCDC syllabus & scheme of work",
      "Lesson plans & homework",
      "Dorm & transport modules",
      "Library management",
      "Budget tracking",
      "Up to 10 admin users",
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "UGX 5,500",
    cadence: "per student/term",
    bestFor: "Secondary · 500+ students",
    features: [
      "Everything in Growth",
      "UNEB candidate registration",
      "MoES exports & board reports",
      "Full payroll management",
      "Staff leave & substitutions",
      "AI insights & DNA analysis",
      "Workflow automation",
      "Full audit logs",
      "Unlimited admin users",
    ],
  },
  {
    name: "Lifetime",
    price: "UGX 8-15M",
    cadence: "one-time",
    description: "Ownership, no monthly fees",
    features: [
      "All Enterprise features",
      "Source code license",
      "On-premise deployment",
      "White-label option",
      "2-day dedicated onboarding",
      "1-year support included",
      "By application only",
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
  { icon: "school", label: "Simple enough for any teacher to use" },
  { icon: "wifi_off", label: "Reliable even when the internet is not" },
  { icon: "hub", label: "Attendance, marks, fees, and messages in one place" },
  { icon: "timer", label: "Saves time instead of creating more admin work" },
];

const osxLinks = [
  "When student leaders track attendance or activities through OSX, SkoolMate OS makes that data visible and usable.",
  "When schools are working to improve academic performance, SkoolMate OS helps identify where students are struggling early.",
  "When leadership needs to act, SkoolMate OS replaces guesswork with a clean, current picture of the school.",
];

const faqItems = [
  {
    q: "Do I need internet to use SkoolMate OS?",
    a: "SkoolMate OS works best with internet, but all plans include offline mode. Teachers can mark attendance and enter grades without connection, and everything syncs automatically when internet returns.",
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

/* ─── Role Switcher data ─── */
const ROLES = [
  {
    key: "Head Teacher",
    icon: "manage_accounts",
    color: "#001F3F",
    bg: "#eef4ff",
    quote: "I see every class, every fee, every decision from one screen.",
    tasks: [
      {
        icon: "how_to_reg",
        label: "Check who is absent before assembly starts",
      },
      { icon: "payments", label: "See daily fee collections at a glance" },
      {
        icon: "fact_check",
        label: "Review exam grades and print report cards",
      },
      { icon: "sms", label: "Send a message to all parents in one tap" },
      { icon: "bar_chart", label: "Track school performance trends weekly" },
    ],
  },
  {
    key: "Bursar",
    icon: "account_balance",
    color: "#0d6e4a",
    bg: "#ecfdf5",
    quote: "No more guessing who paid. Every shilling is tracked.",
    tasks: [
      { icon: "add_card", label: "Record a fee payment (walk-in or MoMo)" },
      {
        icon: "receipt_long",
        label: "Generate invoices and receipts instantly",
      },
      { icon: "warning", label: "See which students still owe fees this term" },
      { icon: "savings", label: "Track cashbook, petty cash, and budgets" },
      { icon: "sms", label: "Send fee reminder SMS to parents with balances" },
    ],
  },
  {
    key: "Class Teacher",
    icon: "school",
    color: "#7c3aed",
    bg: "#f5f3ff",
    quote: "Attendance in 2 minutes. Marks entered once. Done.",
    tasks: [
      { icon: "how_to_reg", label: "Mark attendance on phone before assembly" },
      { icon: "grading", label: "Enter CA and exam marks for the class" },
      { icon: "group", label: "Look up a student's record and fee status" },
      { icon: "comment", label: "Add comments to report cards automatically" },
      {
        icon: "assignment_turned_in",
        label: "See marks completion across all subjects",
      },
    ],
  },
  {
    key: "Parent",
    icon: "family_restroom",
    color: "#b45309",
    bg: "#fffbeb",
    quote: "I always know how my child is doing. No calls needed.",
    tasks: [
      {
        icon: "sms",
        label: "Receive fee balance and attendance updates via SMS",
      },
      {
        icon: "payments",
        label: "Pay school fees via MTN MoMo or Airtel Money",
      },
      {
        icon: "description",
        label: "Access your child's report card when ready",
      },
      { icon: "event", label: "Get notified about school events and closings" },
      { icon: "support_agent", label: "Contact the school office directly" },
    ],
  },
];

/* ─── Day timeline data ─── */
const DAY_STEPS = [
  {
    time: "7:30 AM",
    icon: "how_to_reg",
    title: "Teachers mark attendance",
    what: "Every class teacher opens the app on their phone and marks who is present, absent, or late — before assembly.",
    result:
      "The head teacher sees a live attendance map on the dashboard. No registers lost in transit.",
    color: "#001F3F",
  },
  {
    time: "8:00 AM",
    icon: "dashboard",
    title: "Admin reviews the morning",
    what: "The head teacher checks the dashboard: which classes are fully present, who flagged absence, what needs action today.",
    result:
      "Any class with high absence gets flagged automatically. Follow-up happens before lessons start.",
    color: "#0d9488",
  },
  {
    time: "10:00 AM",
    icon: "grading",
    title: "Exam marks are entered",
    what: "Subject teachers enter CA and mid-term marks. The system calculates grades and checks for missing entries.",
    result:
      "Grades appear instantly. No end-of-term scramble. The dean of studies sees completion in real time.",
    color: "#7c3aed",
  },
  {
    time: "2:00 PM",
    icon: "payments",
    title: "Fee payment recorded",
    what: "A parent walks in and pays. The bursar records it in seconds. MoMo payments sync automatically.",
    result:
      "The parent gets an SMS receipt. The fee balance updates instantly. No manual ledger.",
    color: "#d97706",
  },
  {
    time: "4:00 PM",
    icon: "summarize",
    title: "Day closes itself",
    what: "End-of-day summary is generated automatically: attendance, fees collected, pending actions, SMS delivery.",
    result:
      "The head teacher reviews 1 screen instead of 4 notebooks. Everything is already saved.",
    color: "#10b981",
  },
];

/* ─── Interactive stat strip ─── */
function StatStrip() {
  const studentsC = useCounter(500, 1800);
  const hoursC = useCounter(5, 1400);
  const deliveryC = useCounter(97, 2000);
  const minutesC = useCounter(2, 1200);

  const stats = [
    {
      ref: studentsC.ref,
      icon: "group",
      value: studentsC.display,
      suffix: "+",
      label: "Students managed daily per school",
      color: "#10b981",
    },
    {
      ref: hoursC.ref,
      icon: "timer",
      value: hoursC.display,
      suffix: " hrs",
      label: "Admin time saved every week",
      color: "#f59e0b",
    },
    {
      ref: deliveryC.ref,
      icon: "sms",
      value: deliveryC.display,
      suffix: "%",
      label: "Parent SMS delivery rate",
      color: "#38bdf8",
    },
    {
      ref: minutesC.ref,
      icon: "rocket_launch",
      value: minutesC.display,
      suffix: " min",
      label: "Setup to first class recorded",
      color: "#a78bfa",
    },
  ];

  return (
    <section className="bg-[#001F3F]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 gap-y-10 gap-x-6 lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              ref={s.ref}
              className="flex flex-col items-center text-center"
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl mb-4"
                style={{ background: `${s.color}22`, color: s.color }}
              >
                <span className="material-symbols-outlined text-[24px]">
                  {s.icon}
                </span>
              </div>
              <p className="font-['Sora'] text-4xl font-bold text-white tracking-tight">
                {s.value}
                {s.suffix}
              </p>
              <p className="mt-2 text-sm text-white/60">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Role Switcher ─── */
function RoleSwitcher() {
  const [activeRole, setActiveRole] = useState(0);
  const role = ROLES[activeRole];

  return (
    <section
      id="features"
      className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24"
    >
      <FadeIn>
        <div className="text-center mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
            Built for every person in the school
          </p>
          <h2 className="mt-3 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Pick your role. See what it does for you.
          </h2>
        </div>

        {/* Role tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {ROLES.map((r, i) => (
            <button
              key={r.key}
              onClick={() => setActiveRole(i)}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 border ${
                activeRole === i
                  ? "bg-[#001F3F] text-white border-[#001F3F] shadow-md"
                  : "bg-white text-slate-600 border-slate-200 hover:border-[#001F3F]/30 hover:text-slate-900"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {r.icon}
              </span>
              {r.key}
            </button>
          ))}
        </div>

        {/* Role card */}
        <div
          key={role.key}
          className="grid gap-6 lg:grid-cols-[1fr_1.4fr] items-stretch animate-fade-in"
        >
          {/* Quote card */}
          <div
            className="rounded-[32px] p-7 lg:p-9 flex flex-col justify-between"
            style={{ background: role.color }}
          >
            <div>
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl mb-6"
                style={{ background: "rgba(255,255,255,0.12)" }}
              >
                <span className="material-symbols-outlined text-[28px] text-white">
                  {role.icon}
                </span>
              </div>
              <p className="text-white/60 text-xs font-semibold uppercase tracking-[0.22em] mb-3">
                {role.key}
              </p>
              <p className="font-['Sora'] text-2xl font-semibold text-white leading-snug">
                &ldquo;{role.quote}&rdquo;
              </p>
            </div>
            <div className="mt-8 pt-6 border-t border-white/15">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors px-5 py-2.5 text-sm font-semibold text-white"
              >
                Try it free
                <span className="material-symbols-outlined text-[16px]">
                  arrow_forward
                </span>
              </Link>
            </div>
          </div>

          {/* Tasks grid */}
          <div className="grid gap-3 sm:grid-cols-1">
            {role.tasks.map((task, i) => (
              <div
                key={task.label}
                className="flex items-center gap-4 rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-2xl flex-shrink-0"
                  style={{ background: role.bg, color: role.color }}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {task.icon}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-800">
                  {task.label}
                </p>
                <span className="material-symbols-outlined text-[16px] text-slate-300 ml-auto flex-shrink-0">
                  chevron_right
                </span>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>
    </section>
  );
}

/* ─── Day Timeline ─── */
function DayTimeline() {
  const [activeStep, setActiveStep] = useState(0);
  const step = DAY_STEPS[activeStep];

  return (
    <section id="how-it-works" className="bg-white py-18 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
              A real school day
            </p>
            <h2 className="mt-3 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
              See how SkoolMate OS runs through your day
            </h2>
          </div>

          {/* Timeline nav */}
          <div className="relative flex items-start gap-0 mb-10 overflow-x-auto pb-2">
            {/* connecting line */}
            <div className="absolute top-5 left-5 right-5 h-0.5 bg-slate-200 hidden sm:block" />
            <div className="flex gap-3 sm:gap-0 sm:flex-1 sm:justify-between w-full min-w-max sm:min-w-0">
              {DAY_STEPS.map((s, i) => (
                <button
                  key={s.time}
                  onClick={() => setActiveStep(i)}
                  className="relative flex flex-col items-center gap-2 sm:flex-1 px-2"
                >
                  <div
                    className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                      activeStep === i
                        ? "border-transparent text-white shadow-lg scale-110"
                        : activeStep > i
                          ? "border-transparent text-white"
                          : "border-slate-200 bg-white text-slate-400"
                    }`}
                    style={activeStep >= i ? { background: s.color } : {}}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {s.icon}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-semibold whitespace-nowrap ${activeStep === i ? "text-slate-900" : "text-slate-400"}`}
                  >
                    {s.time}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Step detail */}
          <div
            key={activeStep}
            className="grid gap-6 lg:grid-cols-[1fr_1fr] animate-fade-in"
          >
            <div
              className="rounded-[32px] p-7 lg:p-9"
              style={{ background: step.color }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                  <span className="material-symbols-outlined text-[22px] text-white">
                    {step.icon}
                  </span>
                </div>
                <div>
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-[0.2em]">
                    {step.time}
                  </p>
                  <p className="text-white font-semibold text-base">
                    {step.title}
                  </p>
                </div>
              </div>
              <p className="text-white/85 text-base leading-7">{step.what}</p>
            </div>

            <div className="flex flex-col gap-5">
              <div className="rounded-[28px] border border-slate-200 bg-[#f8fbff] p-6 flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ color: step.color }}
                  >
                    check_circle
                  </span>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Result
                  </p>
                </div>
                <p className="text-slate-800 text-base leading-7 font-medium">
                  {step.result}
                </p>
              </div>

              {/* step navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setActiveStep((p) => Math.max(0, p - 1))}
                  disabled={activeStep === 0}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    arrow_back
                  </span>
                  Previous
                </button>
                <div className="flex gap-1.5">
                  {DAY_STEPS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveStep(i)}
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: activeStep === i ? 24 : 8,
                        background: activeStep === i ? step.color : "#cbd5e1",
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={() =>
                    setActiveStep((p) => Math.min(DAY_STEPS.length - 1, p + 1))
                  }
                  disabled={activeStep === DAY_STEPS.length - 1}
                  className="flex items-center gap-2 rounded-full bg-[#001F3F] px-4 py-2 text-sm font-medium text-white hover:bg-[#17325F] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                  <span className="material-symbols-outlined text-[16px]">
                    arrow_forward
                  </span>
                </button>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

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
      className={`mockup-shell mockup-desktop relative rounded-[32px] border border-slate-200 bg-white p-3 shadow-[0_40px_90px_rgba(15,23,42,0.14)] transition-all duration-700 min-h-[480px] ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
    >
      <div className="rounded-[28px] border border-slate-200 bg-[#f8fbff] overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-500">
            omuto.org/dashboard
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
    /* ── Phone wrapper — 258 px wide, height driven by frame ── */
    <div
      className={`mx-auto transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      style={{
        width: 258,
        position: "relative",
        filter: "drop-shadow(0 40px 80px rgba(0,0,0,0.52))",
      }}
    >
      {/* Side buttons — left: mute + vol ×2 */}
      <div
        style={{
          position: "absolute",
          left: -3,
          top: "14%",
          width: 3,
          height: 22,
          borderRadius: "4px 0 0 4px",
          background: "linear-gradient(180deg,#56565a,#323234)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -3,
          top: "24%",
          width: 3,
          height: 36,
          borderRadius: "4px 0 0 4px",
          background: "linear-gradient(180deg,#56565a,#323234)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -3,
          top: "34%",
          width: 3,
          height: 36,
          borderRadius: "4px 0 0 4px",
          background: "linear-gradient(180deg,#56565a,#323234)",
        }}
      />
      {/* Right: power */}
      <div
        style={{
          position: "absolute",
          right: -3,
          top: "26%",
          width: 3,
          height: 48,
          borderRadius: "0 4px 4px 0",
          background: "linear-gradient(180deg,#56565a,#323234)",
        }}
      />

      {/* Phone frame */}
      <div
        style={{
          background:
            "linear-gradient(160deg, #424244 0%, #1d1d1f 50%, #111113 100%)",
          borderRadius: 52,
          padding: 4,
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.14), 0 0 0 1px rgba(0,0,0,0.6)",
        }}
      >
        {/* Screen — fixed height for correct 19.5:9 phone proportions */}
        <div
          style={{
            background: "#000",
            borderRadius: 48,
            overflow: "hidden",
            height: 530,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* ── Status bar zone (includes Dynamic Island) ── */}
          <div
            style={{
              flexShrink: 0,
              height: 50,
              position: "relative",
              background: "#17325F",
            }}
          >
            {/* Dynamic Island pill */}
            <div
              style={{
                position: "absolute",
                top: 10,
                left: "50%",
                transform: "translateX(-50%)",
                width: 88,
                height: 24,
                background: "#000",
                borderRadius: 20,
                zIndex: 10,
              }}
            />
            {/* Status text — time left, icons right */}
            <div
              style={{
                position: "absolute",
                bottom: 6,
                left: 0,
                right: 0,
                display: "flex",
                justifyContent: "space-between",
                padding: "0 16px",
                fontSize: 10,
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
              }}
            >
              <span>9:41</span>
              <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <span style={{ letterSpacing: 1 }}>▲▲▲</span>
                <span>WiFi</span>
                <span>▮</span>
              </span>
            </div>
          </div>

          {/* ── App header ── */}
          <div
            style={{
              flexShrink: 0,
              background: "#17325F",
              padding: "8px 16px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  color: "rgba(255,255,255,0.6)",
                  marginBottom: 2,
                }}
              >
                SkoolMate OS parent portal
              </p>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                Fee &amp; attendance update
              </p>
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.15)",
                borderRadius: 20,
                padding: "4px 10px",
                fontSize: 10,
                color: "#fff",
              }}
            >
              SMS
            </div>
          </div>

          {/* ── Scrollable content ── */}
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              background: "#f6f9fc",
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {/* Message card */}
            <div
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: "12px 14px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                border: "1px solid #e8eef4",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}
                >
                  {smsMessages[activeMsg].from}
                </span>
                <span style={{ fontSize: 9, color: "#94a3b8" }}>
                  {activeMsg === 0 ? "Incoming" : "Outgoing"}
                </span>
              </div>
              <div style={{ height: 68, overflow: "hidden" }}>
                <p
                  style={{ fontSize: 12, lineHeight: "1.55", color: "#475569" }}
                >
                  {typedText}
                  <span
                    style={{
                      display: "inline-block",
                      width: 2,
                      height: 14,
                      background: "#17325F",
                      marginLeft: 2,
                      verticalAlign: "middle",
                      animation: "pulse 1s infinite",
                    }}
                  />
                </p>
              </div>
            </div>

            {/* Stat row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {[
                ["Recipients", "426"],
                ["Characters", "147/160"],
              ].map(([label, val]) => (
                <div
                  key={label}
                  style={{
                    background: "#fff",
                    borderRadius: 14,
                    padding: "10px 12px",
                    border: "1px solid #e8eef4",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: "0.15em",
                      color: "#94a3b8",
                      marginBottom: 6,
                    }}
                  >
                    {label}
                  </p>
                  <p
                    style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}
                  >
                    {val}
                  </p>
                </div>
              ))}
            </div>

            {/* Dot indicators */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 6,
                marginTop: 2,
              }}
            >
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

          {/* ── Home indicator bar ── */}
          <div
            style={{
              flexShrink: 0,
              height: 24,
              background: "#000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 96,
                height: 4,
                background: "rgba(255,255,255,0.28)",
                borderRadius: 4,
              }}
            />
          </div>
        </div>
        {/* end screen */}
      </div>
      {/* end phone frame */}
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

const DEFAULT_DEVICE_TARGET: DownloadTarget = {
  key: "web",
  href: "/login",
  label: "Open web app",
  icon: "language",
  helper:
    "Use the web app on any device. Install it from your browser when supported.",
  badge: "Browser",
};

/* ─── HOME PAGE ─── */
export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [deviceTarget, setDeviceTarget] = useState<DownloadTarget>(
    DEFAULT_DEVICE_TARGET,
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // If running in Capacitor (Mobile APK), skip landing page and go straight to login
    const isCapacitor =
      typeof window !== "undefined" && (window as any).Capacitor?.isNative;
    if (isCapacitor) {
      router.push("/login");
    }
  }, [router]);

  // Rotate headlines
  useEffect(() => {
    const interval = setInterval(() => {
      setHeadlineIndex((prev) => (prev + 1) % HEADLINES.length);
    }, ROTATION_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(userAgent);
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isMac = /macintosh|mac os x/.test(userAgent) && !isIOS;
    const isWindows = /windows/.test(userAgent);
    const installFromBrowser = {
      key: "browser",
      label: "Install on this device",
      icon: "install_desktop",
      helper:
        "Install SkoolMate from your browser for fast access on supported desktop and mobile devices.",
      badge: "Browser install",
      useInstallPrompt: true,
    } satisfies DownloadTarget;

    const nextTarget = (): DownloadTarget => {
      if (isAndroid) {
        if (ANDROID_APP_URL) {
          return {
            key: "android",
            href: ANDROID_APP_URL,
            label: "Get Android app",
            icon: "android",
            helper:
              "Download the Android APK directly to your phone or tablet.",
            badge: "Android APK",
          };
        }
        // No APK URL — use PWA install prompt
        return installFromBrowser;
      }

      if (isWindows && WINDOWS_APP_URL) {
        return {
          key: "windows",
          href: WINDOWS_APP_URL,
          label: "Get Windows app",
          icon: "desktop_windows",
          helper: "Install the desktop build for Windows.",
          badge: "Windows desktop",
        };
      }

      if (isMac && MAC_APP_URL) {
        return {
          key: "mac",
          href: MAC_APP_URL,
          label: "Get Mac app",
          icon: "laptop_mac",
          helper: "Install the desktop build for macOS.",
          badge: "macOS desktop",
        };
      }

      if (isIOS) {
        return {
          key: "ios",
          href: "/login",
          label: "Open on iPhone or iPad",
          icon: "phone_iphone",
          helper:
            "On iPhone or iPad, open the web app in Safari and use Share > Add to Home Screen.",
          badge: "Safari install",
        };
      }

      return installFromBrowser;
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setDeviceTarget((current) => {
        if (current.href && current.href !== "/login") return current;
        return installFromBrowser;
      });
    };

    setDeviceTarget(nextTarget());
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  const handleInstallApp = async () => {
    // PWA install prompt (works on Android Chrome and desktop browsers)
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }
    // Native app download link
    if (deviceTarget.href && deviceTarget.href !== "/login") {
      window.location.href = deviceTarget.href;
      return;
    }
    // iOS: can't auto-install, guide user
    if (/iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())) {
      alert(
        'On iPhone or iPad: Open this page in Safari, tap the Share button (\u2191) then tap "Add to Home Screen".',
      );
      return;
    }
    // Fallback: open the app in browser
    window.location.href = "/login";
  };

  const installOptions: DownloadTarget[] = [
    {
      key: "android",
      href: ANDROID_APP_URL || undefined,
      label: "Android",
      icon: "android",
      helper: ANDROID_APP_URL
        ? "Direct APK install for phones and tablets."
        : "Install SkoolMate on Android using your browser — tap the menu and select 'Add to Home Screen'.",
      badge: ANDROID_APP_URL ? "APK" : "Browser install",
    },
    {
      key: "windows",
      href: WINDOWS_APP_URL || undefined,
      label: "Windows",
      icon: "desktop_windows",
      helper: WINDOWS_APP_URL
        ? "Desktop installer for office and admin machines."
        : "Desktop build can be added when your Windows installer is ready.",
      badge: WINDOWS_APP_URL ? "Installer ready" : "Coming soon",
    },
    {
      key: "mac",
      href: MAC_APP_URL || undefined,
      label: "macOS",
      icon: "laptop_mac",
      helper: MAC_APP_URL
        ? "Native desktop download for Mac users."
        : "Add your macOS package when the desktop build is ready.",
      badge: MAC_APP_URL ? "Installer ready" : "Coming soon",
    },
    {
      key: "ios",
      href: undefined,
      label: "iPhone / iPad",
      icon: "phone_iphone",
      helper:
        "Open in Safari → tap the Share icon → Add to Home Screen. No App Store needed.",
      badge: "PWA install",
    },
  ];

  return (
    <PageErrorBoundary>
      <main
        className="min-h-[100dvh] bg-[var(--bg)] text-[var(--t1)]"
        style={{ touchAction: "pan-y pinch-zoom" }}
        id="main-content"
      >
        {/* ===== HERO ===== */}
        <section className="relative">
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
                <Link
                  href="/register"
                  className="btn btn-primary btn-sm hidden sm:inline-flex"
                >
                  Start free trial
                </Link>
                {/* Mobile hamburger */}
                <button
                  className="flex md:hidden items-center justify-center w-9 h-9 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
                  aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={mobileMenuOpen}
                  onClick={() => setMobileMenuOpen((prev) => !prev)}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {mobileMenuOpen ? "close" : "menu"}
                  </span>
                </button>
              </div>
            </nav>

            {/* Mobile nav dropdown */}
            {mobileMenuOpen && (
              <div className="md:hidden fixed left-4 right-4 top-[72px] z-50 rounded-[24px] border border-white/70 bg-white/96 shadow-[0_16px_48px_rgba(15,23,42,0.12)] backdrop-blur p-4">
                <div className="flex flex-col gap-1">
                  {[
                    { label: "Features", id: "#features" },
                    { label: "How it works", id: "#how-it-works" },
                    { label: "Story", id: "#story" },
                    { label: "Security", id: "#security" },
                    { label: "Pricing", id: "#pricing" },
                    { label: "FAQ", id: "#faq" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        smoothScroll(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 rounded-[16px] text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      {item.label}
                    </button>
                  ))}
                  <div className="mt-2 pt-3 border-t border-slate-100">
                    <Link
                      href="/register"
                      className="btn btn-primary w-full justify-center py-3 text-sm"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Start free trial
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Hero grid */}
            <div className="grid gap-14 pt-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:pt-20">
              <div className="max-w-2xl">
                <div className="mb-6 flex animate-fade-in">
                  <div className="px-4 py-1.5 rounded-full bg-[var(--navy-soft)] border border-[var(--navy)]/10 text-[var(--navy)] text-[10px] uppercase font-bold tracking-widest flex items-center gap-2">
                    <MaterialIcon icon="school" className="text-sm" />
                    Built for real school operations
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--primary)] shadow-sm">
                  <MaterialIcon icon="fact_check" className="text-[18px]" />
                  Admissions, attendance, fees, reports, and parent follow-up
                </div>
                <h1 className="mt-6 font-['Sora'] text-5xl font-semibold tracking-[-0.05em] text-[var(--t1)] sm:text-6xl lg:text-7xl">
                  {/* Fixed-height wrapper prevents layout shift when text rotates */}
                  <span
                    className="block leading-none overflow-hidden"
                    style={{ minHeight: "1.1em" }}
                  >
                    <span
                      key={headlineIndex}
                      className="animate-fade-in block leading-none"
                    >
                      {HEADLINES[headlineIndex]}
                    </span>
                  </span>
                  <span className="block leading-tight mt-2">
                    with <span className="text-[var(--green)]">all-in-one</span>{" "}
                    school management.
                  </span>
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--t2)] sm:text-xl">
                  Handle attendance, fees, marks, and parent messages — all in
                  one place. Built for Ugandan schools. Works even without
                  internet.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/register"
                    className="btn btn-primary px-7 py-4 text-base"
                  >
                    Start 30-day free trial
                  </Link>
                  {mounted &&
                    (deviceTarget.href && !deviceTarget.useInstallPrompt ? (
                      <Link
                        href={deviceTarget.href}
                        className="btn btn-secondary px-7 py-4 text-base flex items-center gap-3"
                      >
                        <MaterialIcon
                          icon={deviceTarget.icon}
                          className="text-[22px]"
                        />
                        {deviceTarget.label}
                      </Link>
                    ) : (
                      <button
                        className="btn btn-secondary px-7 py-4 text-base flex items-center gap-3"
                        onClick={handleInstallApp}
                      >
                        <MaterialIcon
                          icon={deviceTarget.icon}
                          className="text-[22px]"
                        />
                        {deviceTarget.label}
                      </button>
                    ))}
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
                <div className="desktop-stage relative z-0 hidden lg:block lg:ml-16">
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

        {/* ===== STATS STRIP ===== */}
        <StatStrip />

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

        {/* ===== ROLE SWITCHER ===== */}
        <RoleSwitcher />

        {/* ===== HOW IT WORKS ===== */}
        <DayTimeline />

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
                  never that people were not trying. The issue was that the
                  system around them kept slowing the work down.
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
                    SkoolMate OS was built to match the real flow of school
                    life: attendance, marks, fees, communication, and
                    decision-making in one place. Not another generic system. A
                    calmer operating layer for schools that are already working
                    hard.
                  </p>
                </div>
              </FadeIn>

              <div className="grid gap-4 sm:grid-cols-2">
                {storyPrinciples.map((item, i) => (
                  <FadeIn key={item.label} delay={i * 100}>
                    <div className="story-card rounded-[28px] border border-slate-200 bg-[#f8fbff] p-5 shadow-sm h-full">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#17325F]/8 text-[#17325F]">
                        <MaterialIcon
                          icon={item.icon}
                          className="text-[20px]"
                        />
                      </div>
                      <p className="mt-4 text-base font-semibold leading-7 text-slate-900">
                        {item.label}
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
                    this system comes from what has been seen, learned, and
                    asked for in the field.
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
                  <FadeIn key={module.label} delay={i * 80}>
                    <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm hover:shadow-md hover:border-[#2E9448]/30 transition-all cursor-default">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#2E9448]">
                          <MaterialIcon
                            icon={module.icon}
                            className="text-[20px]"
                          />
                        </div>
                        <p className="text-sm font-semibold text-slate-800">
                          {module.label}
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
                    SkoolMate OS is the system layer inside the wider SkoolMate
                    School Xperience.
                  </h2>
                  <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
                    OSX is the broader transformation model. SkoolMate OS is the
                    layer that helps that transformation hold, because progress
                    is hard to sustain when the underlying school systems stay
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
                          culture where schools do not just operate, but
                          perform.
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
                        <p className="text-sm leading-6 text-slate-700">
                          {item}
                        </p>
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
                Student records, grades, and financial data are sensitive. Here
                is exactly how we protect your school — in plain language.
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
        <section
          id="pricing"
          className="relative bg-[#0d1930] py-18 text-white lg:py-24"
        >
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
                  Clear pricing. No hidden fees.
                </h2>
                <p className="mt-5 text-lg leading-8 text-white/72">
                  Per-student pricing that scales with your school. Start free,
                  upgrade when ready.
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => smoothScroll("#comparison")}
                    className="text-sm font-semibold text-white/80 hover:text-white underline underline-offset-4"
                  >
                    See full feature comparison →
                  </button>
                </div>
              </div>
            </FadeIn>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {plans.map((plan, i) => (
                <FadeIn key={plan.name} delay={i * 150}>
                  <div
                    className={`rounded-[32px] border p-6 h-full flex flex-col ${
                      plan.featured
                        ? "border-white/20 bg-white text-slate-950 shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
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
                      className={`mt-2 text-xs font-semibold uppercase tracking-wider ${plan.featured ? "text-[#2E9448]" : "text-white/80"}`}
                    >
                      {plan.bestFor}
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

        {/* ===== COMPARISON TABLE ===== */}
        <section
          id="comparison"
          className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:py-24"
        >
          <FadeIn>
            <div className="text-center mb-10">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                Feature Comparison
              </p>
              <h2 className="mt-3 font-['Sora'] text-2xl font-semibold text-slate-950 sm:text-3xl">
                How SkoolMate OS compares
              </h2>
            </div>
            <p className="text-center text-sm text-slate-500 mb-2">
              ✓ = Included &nbsp;&nbsp; ✗ = Not available &nbsp;&nbsp; ~ =
              Partial
            </p>
            <p className="text-center text-xs text-slate-400 mb-8">
              Based on publicly available information, April 2026. Competitor
              columns are illustrative.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      Feature
                    </th>
                    <th className="py-3 px-4 font-bold text-[#2E9448] bg-green-50">
                      SkoolMate
                    </th>
                    <th className="py-3 px-4 text-slate-500">Alt A</th>
                    <th className="py-3 px-4 text-slate-500">Alt B</th>
                    <th className="py-3 px-4 text-slate-500">Alt C</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["NCDC syllabus & scheme of work", "✓", "✗", "✗", "✗"],
                    ["MTN MoMo + Airtel integration", "✓", "~", "✗", "✗"],
                    ["Student ID card generation", "✓", "✗", "✗", "✗"],
                    ["Transport route tracking", "✓", "✗", "✗", "✗"],
                    ["DNA + trend analysis", "✓", "✗", "✗", "✗"],
                    ["White-label option", "✓", "✗", "✗", "✗"],
                    ["Parent portal", "✓", "✓", "✓", "✗"],
                    ["Offline mode", "~", "✓", "✗", "✓"],
                    ["UNEB registration", "✓", "~", "✗", "✗"],
                    ["Full payroll", "✓", "✓", "✓", "~"],
                  ].map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="py-3 px-4 text-slate-700">{row[0]}</td>
                      <td className="py-3 px-4 text-center font-bold bg-green-50/50">
                        {row[1]}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-500">
                        {row[2]}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-500">
                        {row[3]}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-500">
                        {row[4]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </section>

        {/* ===== FAQ ===== */}
        <section
          id="faq"
          className="mx-auto max-w-3xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24"
        >
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
        <footer className="border-t border-slate-200 bg-white pb-24 sm:pb-0">
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
                      onClick={() => smoothScroll("#comparison")}
                      className="text-sm text-slate-600 hover:text-slate-900 transition cursor-pointer"
                    >
                      Compare
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
                      href="mailto:os@omuto.org"
                      className="hover:text-slate-900 transition"
                    >
                      os@omuto.org
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
              <p className="text-sm text-slate-400" suppressHydrationWarning>
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

        {/* ===== STICKY MOBILE CTA ===== */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 shadow-[0_-4px_24px_rgba(15,23,42,0.10)]">
          <div className="flex gap-3 max-w-sm mx-auto">
            <Link
              href="/register"
              className="btn btn-primary flex-1 justify-center py-3 text-sm"
            >
              Start free trial
            </Link>
            <Link href="/login" className="btn btn-secondary py-3 px-5 text-sm">
              Sign in
            </Link>
          </div>
        </div>
      </main>
    </PageErrorBoundary>
  );
}
