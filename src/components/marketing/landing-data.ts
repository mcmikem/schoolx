import { DownloadTarget } from "./types";

export const ANDROID_APP_URL = process.env.NEXT_PUBLIC_ANDROID_APP_URL || "";
export const WINDOWS_APP_URL = process.env.NEXT_PUBLIC_WINDOWS_APP_URL || "";
export const MAC_APP_URL = process.env.NEXT_PUBLIC_MAC_APP_URL || "";

export const HEADLINES = [
  "Save 5+ hours every week",
  "Your school in your hand",
  "One place. Complete control",
  "Stop juggling spreadsheets",
  "Everything runs smoother",
  "Finally, it all connects",
  "Built for Ugandan schools",
  "Your school, simplified",
];

export const ROTATION_INTERVAL = 4000;

export const trustBadges = [
  { icon: "verified", label: "Aligned with NCDC 2025" },
  { icon: "fact_check", label: "UNEB-ready formats" },
  { icon: "location_on", label: "Made in Uganda" },
  { icon: "support_agent", label: "Local WhatsApp Support" },
  { icon: "wifi_off", label: "Works Offline" },
  { icon: "security", label: "Data Protection Act Compliant" },
];

export const modules = [
  { icon: "group", label: "Student & parent records" },
  { icon: "how_to_reg", label: "Attendance and period registers" },
  { icon: "fact_check", label: "Exams, grades, and report cards" },
  { icon: "payments", label: "Fees, payroll, and budgets" },
  { icon: "assignment", label: "UNEB registration and MoES exports" },
  { icon: "sms", label: "Bulk SMS, alerts, and parent portal" },
];

export const plans = [
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

export const securityDetails = [
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

export const storyMoments = [
  "Registers getting lost between offices and classrooms.",
  "Marks being calculated late into the night before report deadlines.",
  "Report cards taking weeks because the workflow lives in separate books and spreadsheets.",
  "Headteachers making serious decisions without a clear view of attendance, fees, or performance.",
];

export const storyPrinciples = [
  { icon: "school", label: "Simple enough for any teacher to use" },
  { icon: "wifi_off", label: "Reliable even when the internet is not" },
  { icon: "hub", label: "Attendance, marks, fees, and messages in one place" },
  { icon: "timer", label: "Saves time instead of creating more admin work" },
];

export const osxLinks = [
  "When student leaders track attendance or activities through OSX, SkoolMate OS makes that data visible and usable.",
  "When schools are working to improve academic performance, SkoolMate OS helps identify where students are struggling early.",
  "When leadership needs to act, SkoolMate OS replaces guesswork with a clean, current picture of the school.",
];

export const faqItems = [
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

export const tabContent: Record<
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

export const ROLES = [
  {
    key: "Head Teacher",
    icon: "manage_accounts",
    color: "#001F3F",
    bg: "#eef4ff",
    quote: "I see every class, every fee, every decision from one screen.",
    tasks: [
      { icon: "how_to_reg", label: "Check who is absent before assembly starts" },
      { icon: "payments", label: "See daily fee collections at a glance" },
      { icon: "fact_check", label: "Review exam grades and print report cards" },
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
      { icon: "receipt_long", label: "Generate invoices and receipts instantly" },
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
      { icon: "assignment_turned_in", label: "See marks completion across all subjects" },
    ],
  },
  {
    key: "Parent",
    icon: "family_restroom",
    color: "#b45309",
    bg: "#fffbeb",
    quote: "I always know how my child is doing. No calls needed.",
    tasks: [
      { icon: "sms", label: "Receive fee balance and attendance updates via SMS" },
      { icon: "payments", label: "Pay school fees via MTN MoMo or Airtel Money" },
      { icon: "description", label: "Access your child's report card when ready" },
      { icon: "event", label: "Get notified about school events and closings" },
      { icon: "support_agent", label: "Contact the school office directly" },
    ],
  },
];

export const DAY_STEPS = [
  {
    time: "7:30 AM",
    icon: "how_to_reg",
    title: "Teachers mark attendance",
    what: "Every class teacher opens the app on their phone and marks who is present, absent, or late — before assembly.",
    result: "The head teacher sees a live attendance map on the dashboard. No registers lost in transit.",
    color: "#001F3F",
  },
  {
    time: "8:00 AM",
    icon: "dashboard",
    title: "Admin reviews the morning",
    what: "The head teacher checks the dashboard: which classes are fully present, who flagged absence, what needs action today.",
    result: "Any class with high absence gets flagged automatically. Follow-up happens before lessons start.",
    color: "#0d9488",
  },
  {
    time: "10:00 AM",
    icon: "grading",
    title: "Exam marks are entered",
    what: "Subject teachers enter CA and mid-term marks. The system calculates grades and checks for missing entries.",
    result: "Grades appear instantly. No end-of-term scramble. The dean of studies sees completion in real time.",
    color: "#7c3aed",
  },
  {
    time: "2:00 PM",
    icon: "payments",
    title: "Fee payment recorded",
    what: "A parent walks in and pays. The bursar records it in seconds. MoMo payments sync automatically.",
    result: "The parent gets an SMS receipt. The fee balance updates instantly. No manual ledger.",
    color: "#d97706",
  },
  {
    time: "4:00 PM",
    icon: "summarize",
    title: "Day closes itself",
    what: "End-of-day summary is generated automatically: attendance, fees collected, pending actions, SMS delivery.",
    result: "The head teacher reviews 1 screen instead of 4 notebooks. Everything is already saved.",
    color: "#10b981",
  },
];

export const smsMessages = [
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

export const DEFAULT_DEVICE_TARGET: DownloadTarget = {
  key: "web",
  href: "/login",
  label: "Open web app",
  icon: "language",
  helper: "Use the web app on any device. Install it from your browser when supported.",
  badge: "Browser",
};
