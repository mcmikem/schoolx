// Owly's built-in knowledge base.
// This is the offline brain: it answers questions about SkoolMate OS without any
// network call or AI API key, so the assistant stays useful in the field.

export interface OwlyEntry {
  id: string;
  keywords: string[];
  /** Pathname fragments that boost this answer when the user is on that page. */
  pages?: string[];
  answer: string;
}

export interface OwlyContext {
  page?: string;
}

const GENERIC_PREFIXES = [
  "how",
  "what",
  "where",
  "when",
  "why",
  "who",
  "which",
  "can",
  "could",
  "should",
  "do",
  "does",
  "is",
  "are",
  "the",
  "a",
  "an",
  "i",
  "my",
  "me",
  "to",
  "in",
  "on",
  "for",
  "of",
  "and",
  "please",
  "tell",
  "show",
  "find",
  "about",
];

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s'’-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^['’-]+|['’-]+$/g, ""))
    .filter(Boolean);
}

function hasPhrase(lower: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(lower);
}

function scoreEntry(entry: OwlyEntry, lower: string, tokens: string[], page?: string): number {
  let score = 0;
  const tokenSet = new Set(tokens);
  for (const kw of entry.keywords) {
    const key = kw.toLowerCase().trim();
    if (!key) continue;
    if (key.includes(" ")) {
      if (hasPhrase(lower, key)) score += 4;
      continue;
    }
    if (tokenSet.has(key)) {
      score += 3;
      continue;
    }
    // light plural/stem tolerance: fee ↔ fees, student ↔ students
    if (
      key.length > 3 &&
      (tokenSet.has(`${key}s`) || tokenSet.has(`${key}es`) || tokenSet.has(key.replace(/s$/, "")))
    ) {
      score += 2;
      continue;
    }
    if (key.length >= 5) {
      for (const token of tokenSet) {
        if (token.length >= 5 && (token.startsWith(key) || key.startsWith(token))) {
          score += 1;
          break;
        }
      }
    }
  }
  if (page && entry.pages?.length) {
    for (const p of entry.pages) {
      if (page.includes(p)) {
        score += 3;
        break;
      }
    }
  }
  return score;
}

export const KNOWLEDGE: OwlyEntry[] = [
  // ── Conversational ────────────────────────────────────────────────────────
  {
    id: "greeting",
    keywords: ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "how are you", "how r u"],
    answer:
      "Hello! 👋 I'm **Owly**, your SkoolMate guide.\n\nAsk me anything about the app — **fees, attendance, grades, reports, SMS, setup, offline sync** — and I'll show you exactly where to click, even without internet.",
  },
  {
    id: "thanks",
    keywords: ["thanks", "thank you", "appreciate", "cheers", "ok thanks", "nice one"],
    answer: "You're welcome! 😊 Anything else about SkoolMate I can help you with?",
  },
  {
    id: "who-are-you",
    keywords: ["who are you", "what are you", "your name", "are you a bot", "are you ai", "are you human"],
    answer:
      "I'm **Owly** — the SkoolMate in-app assistant.\n\n• With internet, I can use our AI brain for free-form answers\n• **Without internet**, I run on a built-in guide that covers the whole app\n• For anything urgent, the **WhatsApp button** reaches a real person on our team",
  },
  {
    id: "capabilities",
    keywords: ["what can you do", "help me", "capabilities", "commands", "topics", "what do you know", "menu"],
    answer:
      "I can walk you through any part of SkoolMate:\n\n• **Money** — fees, invoicing, payment plans, cashbook, budget, payroll\n• **Teaching** — attendance, grades, exams, syllabus, lesson plans, timetable\n• **People** — students, staff, parents, ID cards, transfers, promotion\n• **Comms** — SMS, notices, templates, automation\n• **Admin** — setup, roles, billing, reports, offline sync\n\nJust type your question in plain English.",
  },
  {
    id: "overview",
    keywords: [
      "what is skoolmate",
      "about skoolmate",
      "skoolmate os",
      "what does this app do",
      "introduction",
      "overview",
    ],
    answer:
      "**SkoolMate OS** is a school management system built for Ugandan schools (NCDC curriculum, UNEB, MoES reporting).\n\nIt covers: **students, staff, attendance, grades & report cards, fees (cash/MoMo/Airtel), timetable, SMS to parents, library, health, boarding, payroll, budgets** — and it works **offline**, syncing when you reconnect.",
  },

  // ── Navigation & shortcuts ────────────────────────────────────────────────
  {
    id: "navigate",
    keywords: [
      "where is",
      "where do i find",
      "how do i get to",
      "which menu",
      "navigation",
      "sidebar",
      "cannot find",
      "can't find",
      "missing page",
      "hidden",
    ],
    answer:
      "Everything lives in the **left sidebar**, grouped by job:\n\n• **Today** — Dashboard, Attendance, Fees, Messages\n• **Daily Work** — Students, Staff, Grades, Timetable, Calendar, Analytics\n• **Teaching & Exams** — Exams, Assignments, Syllabus, Terms, Subjects, SMS Centre\n• **Reports & Readiness** — ID Cards, Financial Reports, Teacher Performance, Audit\n• **School Office** — Budget, Payroll, Health, Transport, Library, Boarding\n• **Other Tools** — Inventory, Settings, Permissions, Offline Sync\n\nIf a page is missing, your **role or plan** may not include it — ask your headmaster to check **Role Permissions**.",
    pages: [],
  },
  {
    id: "search",
    keywords: [
      "search",
      "find a page",
      "command palette",
      "global search",
      "keyboard",
      "shortcut",
      "hotkey",
      "ctrl+k",
      "cmd+k",
    ],
    answer:
      "🔍 **Finding things fast:**\n\n• Press **Ctrl+K / ⌘K** anywhere → **Global Search** for pages, students, and actions\n• **Ctrl+N** → new record (Fees payment / Student)\n• **Ctrl+F** → focus the page's search box\n• **Esc** → close any modal or menu\n• **F2** → quick sale in the Canteen POS\n\nThe sidebar also has a **Find page…** filter, and it remembers your last pages under *Continue where you left off*.",
  },
  {
    id: "get-started",
    keywords: [
      "get started",
      "first time",
      "start",
      "begin",
      "new school",
      "first steps",
      "what should i do first",
      "onboarding",
    ],
    answer:
      "🚀 **First steps:**\n\n1. Open **Setup Wizard** (sidebar → Other Tools, or `/dashboard/setup-wizard`)\n2. Step 1–2: school details, **term dates**, classes, subjects, fee structure\n3. Step 3–4: grading scheme, report card layout, boarding & features\n4. **Import students** (CSV/Excel) and add staff\n5. Take your first **attendance** and record your first **payment**\n\nThe setup checklist lives in **Settings → Setup Checklist**. Need a guided call? Use the WhatsApp button.",
  },

  // ── Money ────────────────────────────────────────────────────────────────
  {
    id: "fees",
    keywords: [
      "fee",
      "fees",
      "payment",
      "pay",
      "invoice",
      "balance",
      "receipt",
      "collect money",
      "fee structure",
      "dues",
    ],
    pages: ["fees", "finance", "invoicing", "cashbook", "fee-terms", "payment-plans"],
    answer:
      "💰 **Fees** (sidebar → **Fees**):\n\n• Tabs: **Student Balances · Paying in Bits · Invoices · Daily Money Log · Payment Claims**\n• **Record Payment** — Cash, Mobile Money, Bank Transfer, or Installments (shortcut **Ctrl+N**)\n• **Fee Terms** set installment schedules; **Payment Plans** let parents pay in parts\n• Receipts/invoices generate automatically\n• Right panel: Balances · Payments · Fee Structure",
  },
  {
    id: "mobile-money",
    keywords: ["momo", "mtn", "airtel", "mobile money", "ush", "pay by phone", "cash", "bank transfer"],
    answer:
      "📱 **Accepting payment:**\n\n• **Cash** — record at the bursar's office, receipt prints\n• **MTN MoMo / Airtel Money** — enter the transaction ID on the payment form, or parents pay your school's registered number\n• **Bank Transfer** — record with the reference\n\nSchool MoMo/Airtel numbers are set in **Settings → Messaging & Payments**. Payments can be recorded **offline** and sync later.",
  },
  {
    id: "payment-plans",
    keywords: ["installment", "instalment", "payment plan", "pay in bits", "part payment", "balance", "structure"],
    answer:
      "🧾 **Paying in bits:**\n\n• **Fee Terms** → define installments per term (e.g. 40% / 30% / 30%)\n• **Fees → Paying in Bits** → track each student's plan progress\n• Record partial payments any time; the balance updates automatically\n• Send **fee reminders** via Messages → Automation for overdue balances",
  },
  {
    id: "cashbook",
    keywords: ["cashbook", "daily money log", "money log", "cash log", "income"],
    answer:
      "📒 **Daily Money Log / Cashbook:**\n\n• Fees tab **Daily Money Log** shows money received each day\n• Add expenses from **Budget → Log Expense** to keep the ledger complete\n• Export to CSV from the page or **Export Data** in the sidebar\n• Bursars see a cashbook shortcut in their dashboard",
  },
  {
    id: "budget",
    keywords: ["budget", "expense", "expenditure", "spending", "approve", "approval", "funds"],
    pages: ["budget", "expense-approvals"],
    answer:
      "🏦 **Budget & Expenses** (sidebar → **Budget**):\n\n• Log expenses by category (Staff, Maintenance, Supplies, Activities…)\n• Expenses over your threshold go to **Expense Approvals** for the headmaster\n• Pending approvals appear on the dashboard's *Needs Attention*\n• Reports compare spending vs fee income by term",
  },
  {
    id: "payroll",
    keywords: ["payroll", "salary", "salaries", "wage", "pay", "pay slip", "payslip", "nssf", "paye"],
    pages: ["payroll"],
    answer:
      "👨‍💼 **Payroll** (sidebar → **Payroll**):\n\n• Staff salary by **scale (Scale 1–5)** or custom amount\n• **PAYE** and **NSSF** calculated automatically\n• Run monthly payroll and export payslips\n• Salary grades follow Uganda Government structures; custom grades also supported",
  },
  {
    id: "billing",
    keywords: [
      "billing",
      "subscription",
      "plan",
      "upgrade",
      "price",
      "pricing",
      "trial",
      "expire",
      "renew",
      "licence",
      "license",
      "how much",
    ],
    answer:
      "💳 **Plans** (Settings → **Billing & Plans**):\n\n• **Free Trial** — up to 100 students\n• **Starter** — UGX 2,000/student/term (≤200 students)\n• **Growth** — UGX 3,500 (≤500, parent portal, dorm, library, budget)\n• **Enterprise** — UGX 5,500 (unlimited, UNEB, MoES, payroll, automation, audit)\n\nPay with **MTN MoMo or Airtel Money**. After expiry you get a 14-day grace period. Billing questions → WhatsApp support.",
  },

  // ── Attendance ────────────────────────────────────────────────────────────
  {
    id: "attendance",
    keywords: ["attendance", "absent", "present", "mark", "register", "late", "roll call", "call back"],
    pages: ["attendance", "period-attendance"],
    answer:
      "✅ **Attendance** (sidebar → **Attendance**):\n\n• Select class & date, tap students to cycle **Absent → Present → Late**\n• **Period Attendance** marks per lesson; **Staff Attendance** and **Dorm Attendance** are separate\n• Works **offline** — queued on the device, syncs when reconnected\n• History + CSV export at **Attendance → History**\n• 3 consecutive absences can auto-alert parents (if SMS automation is on)",
  },
  {
    id: "staff-attendance",
    keywords: ["staff attendance", "teacher attendance", "check in", "scan terminal", "biometric", "clock in"],
    pages: ["staff-attendance"],
    answer:
      "🕐 **Staff Attendance** (sidebar → Staff hub → **Staff Attendance**):\n\n• Mark staff present/absent per day\n• **Scan terminal** mode lets staff check in with a scanned code\n• View logs and export CSV\n• Combine with **Staff Activity** to see who's been doing what",
  },

  // ── Grades, exams, reports ────────────────────────────────────────────────
  {
    id: "grades",
    keywords: ["grade", "grades", "mark", "marks", "score", "exam", "ca", "continuous assessment", "entry", "publish"],
    pages: ["grades", "exams", "marks-completion", "exam-timetable"],
    answer:
      "📝 **Grades & Marks** (sidebar → **Grades**):\n\n• Pick class + subject → enter **CA1, CA2, CA3** and **Exam** scores\n• Quick-fill with Enter; lock/unlock to stop accidental edits\n• Workflow: **Draft → Submitted → Approved → Published**\n• Grading auto-calculates from your scheme (NCDC: Distinction/Credit/Pass/Fail)\n• **Marks Completion** shows which classes still owe marks",
  },
  {
    id: "report-cards",
    keywords: [
      "report card",
      "report cards",
      "report",
      "term report",
      "progress report",
      "result slip",
      "comments",
      "remark",
    ],
    pages: ["report-cards", "batch-reports", "comments"],
    answer:
      "📊 **Report Cards** (sidebar → **Report Cards**):\n\n• Works after grades are **Published**\n• Auto-fills subjects, marks, and comments; HOD adds subject remarks; headmaster comment per student\n• **Batch Reports** prints a whole class in one job\n• **Comments** generator drafts remarks from scores in bulk\n• Print works **offline** (queued), then syncs — UNEB-style layout with Class Teacher, HOD, Principal signature",
  },
  {
    id: "exams",
    keywords: ["exam", "exams", "ca1", "ca2", "ca3", "mid term", "mid-term", "eot", "end of term", "test", "paper"],
    pages: ["exams", "exam-timetable"],
    answer:
      "🧪 **Exams** (sidebar → **Exams**):\n\n• Exam types: **CA, Mid Term, End of Term** (plus Saturday/BOT tests)\n• **Exam Timetable** schedules papers by class & subject\n• Enter marks per exam, then publish to unlock report cards\n• Analyse results with **UNEB Analysis** (divisions) and **Analytics**",
  },
  {
    id: "uneb",
    keywords: ["uneb", "ple", "uce", "uace", "candidate", "index number", "division", "registration"],
    pages: ["uneb", "uneb-registration"],
    answer:
      "🎓 **UNEB**:\n\n• **UNEB Registration** → register PLE (P7), UCE (S4), UACE (S6) candidates and assign **index numbers**\n• Export lists in UNEB-compatible format\n• **UNEB Analysis** shows divisions per candidate/class\n• Candidates need National ID / birth certificate (NIRA) details on file",
  },
  {
    id: "moes",
    keywords: [
      "moes",
      "ministry",
      "ministry of education",
      "emis",
      "headcount",
      "census",
      "government report",
      "returns",
    ],
    pages: ["moes", "moes-reports"],
    answer:
      "🏛️ **MoES Reporting**:\n\n• **MoES** → Headcount return (enrolment by gender, class, age)\n• **MoES Reports** → EMIS exports as **.xlsx / .json**\n• Teacher qualification & deployment reports\n• Set your EMIS code in **Settings → School Profile**",
  },
  {
    id: "analytics",
    keywords: ["analytics", "insights", "stats", "statistics", "trends", "performance", "data quality", "dashboard"],
    pages: ["analytics", "trends", "class-comparison", "data-quality", "board-report"],
    answer:
      "📈 **Analytics** (sidebar → **Analytics**):\n\n• Strategic dashboards: enrolment, performance, fees, attendance trends\n• **Trends** compares results across terms; **Class Comparison** ranks classes\n• **Data Quality** flags missing/duplicate records before reporting\n• **Board Report** exports a PDF for governors",
  },
  {
    id: "early-warnings",
    keywords: ["warning", "warnings", "at risk", "risk", "dropout", "failing", "concern", "flag student"],
    pages: ["warnings", "dropout-tracking"],
    answer:
      "⚠️ **Early Warnings** (sidebar → **Warnings**):\n\n• Flags students with long absence streaks, falling grades, or overdue fees\n• **Dropout Tracking** lists students with repeated absences\n• Combine with **Automation** to auto-SMS parents when a student is flagged\n• Open the student's profile to see the full pattern",
  },

  // ── Curriculum & teaching ─────────────────────────────────────────────────
  {
    id: "ncdc",
    keywords: ["ncdc", "curriculum", "syllabus", "topics", "scheme", "coverage"],
    pages: ["syllabus", "syllabus-tracker", "scheme-of-work"],
    answer:
      "📚 **Syllabus (NCDC)** (sidebar → **Syllabus**):\n\n• Select class, subject, term → **NCDC Topics** auto-loads the national curriculum\n• Mark topics **Not Started / In Progress / Completed**\n• **Scheme of Work** turns them into weekly lesson breakdowns\n• **Syllabus Tracker** shows coverage % per subject (P1–P7, S1–S6)",
  },
  {
    id: "lesson-plans",
    keywords: ["lesson plan", "lesson plans", "plan lesson", "weekly plan"],
    pages: ["lesson-plans", "homework"],
    answer:
      "📖 **Lesson Plans** (sidebar → **Lesson Plans**):\n\n• Build detailed plans per class/subject/week\n• Start from the syllabus topic you're covering\n• Print or export for inspections\n• Related: **Scheme of Work** (weekly) and **Homework** (assignments)",
  },
  {
    id: "homework",
    keywords: ["homework", "assignment", "assignments", "classwork", "submit", "submission"],
    pages: ["homework", "homework-submissions"],
    answer:
      "✏️ **Assignments** (sidebar → **Homework**):\n\n• Assign work per class with due date\n• **Homework Submissions** tracks who handed in and who didn't\n• Post to parents through **Notices** or SMS if needed\n• Teachers see pending assignments on their dashboard",
  },
  {
    id: "timetable",
    keywords: ["timetable", "schedule", "period", "lesson", "slot", "free period", "double period"],
    pages: ["timetable", "allocations", "substitutions", "workload"],
    answer:
      "🗓️ **Timetable** (sidebar → **Timetable**):\n\n• Pick a class → click an empty slot → assign **teacher + subject**\n• Teacher double-bookings are auto-flagged\n• **Term Calendar** shows holidays, midterms, EOT dates\n• **Substitutions** covers absent teachers; **Workload** shows each teacher's load\n• Period slots are set in **Settings → Timetable Slots**",
  },
  {
    id: "calendar",
    keywords: ["calendar", "event", "events", "holiday", "term dates", "school calendar", "activities"],
    pages: ["calendar", "academic-terms"],
    answer:
      "📅 **School Calendar** (sidebar → **Calendar**):\n\n• Month/week/day views of events, holidays, and activities\n• Add term dates, sports days, parents' meetings\n• **Academic Terms** manages term names & date ranges (used by fees, grades, reports)\n• Events can be published to parents via **Notices**",
  },
  {
    id: "subjects",
    keywords: ["subject", "subjects", "course", "courses", "class", "classes", "stream", "streaming"],
    pages: ["subjects", "classes", "courses"],
    answer:
      "🗂️ **Classes & Subjects**:\n\n• **Classes** → create classes/streams and assign class teachers\n• **Subjects** → subjects offered, and which grades each subject uses\n• **Courses** → course offerings for senior secondary\n• Set these up in the **Setup Wizard** before entering marks",
  },

  // ── People ────────────────────────────────────────────────────────────────
  {
    id: "students",
    keywords: ["student", "students", "learner", "enrol", "enroll", "admission", "add student", "pupil", "registry"],
    pages: ["students", "student-enrollments", "student-lookup"],
    answer:
      "👩‍🎓 **Students** (sidebar → **Students**):\n\n• Tabs: **Registry · Transfers · Dropouts · Promotion**\n• Add one student or bulk-import (CSV/Excel/paste)\n• Each student gets a unique **student number** (used on ID cards & receipts)\n• Open a student for full profile: attendance, grades, fees, conduct, health\n• **Student Photos** uploads photos in batch by student number",
  },
  {
    id: "import",
    keywords: ["import", "upload", "csv", "excel", "spreadsheet", "bulk add", "paste", "google sheets"],
    pages: ["import"],
    answer:
      "📤 **Import** (sidebar → **Import**):\n\n• Paste from **Word/Excel/Google Sheets** or upload **CSV/Excel**\n• Download the **CSV template** first so columns match\n• Students and staff can both be bulk-imported\n• Check **Data Quality** afterwards for duplicates or missing fields",
  },
  {
    id: "export",
    keywords: ["export", "download", "excel", "xlsx", "print", "pdf", "back up", "backup my data"],
    pages: ["export", "custom-reports", "settings"],
    answer:
      "📥 **Export** (sidebar → **Export Data**):\n\n• **Excel (.xlsx)**: students, UNEB candidates, grades, attendance, fees\n• **CSV** available on most list pages (Students, Grades, Attendance, Audit)\n• **PDF**: single-student reports, board report, inspection report, budget\n• **Print windows**: report cards, ID cards, batch reports (Ctrl+P)\n• Settings → **Backup & Export** for a full data backup",
  },
  {
    id: "transfers-promotion",
    keywords: [
      "transfer",
      "transferred",
      "promote",
      "promotion",
      "repeat",
      "move student",
      "next class",
      "graduation",
      "alumni",
      "rollover",
    ],
    pages: ["promotion", "rollover", "student-transfers"],
    answer:
      "🔄 **Promotion & Transfers:**\n\n• **Students → Transfers** → move a student in/out with dates and reason\n• **Promotion** → move a whole class to the next class (or mark repeaters)\n• **Rollover / Term-End** → close a term: lock grades, promote, prep next term\n• **Graduation** and **Alumni** track leavers and keep their records",
  },
  {
    id: "id-cards",
    keywords: ["id card", "id cards", "identity", "badge", "admission package", "letter"],
    pages: ["idcards"],
    answer:
      "🪪 **ID Cards** (sidebar → ID Cards / Students → Identity Center):\n\n• Generate student ID cards with photo, student number, and school logo\n• Print in batches\n• **Students → Admission Package** produces official enrolment documents\n• Keep student photos updated via **Students → Photos**",
  },
  {
    id: "staff",
    keywords: ["staff", "teacher", "teachers", "employee", "employees", "hire", "add staff", "tsc", "directory"],
    pages: ["staff", "users", "staff-activity", "staff-performance"],
    answer:
      "👨‍🏫 **Staff** (sidebar → **Staff**):\n\n• **Staff Directory** lists everyone with role, subjects, and classes\n• Add staff from the Staff hub (or Settings → Staff & Users)\n• **Staff Activity** shows recent actions; **Staff Performance** shows metrics\n• Invite colleagues from the sidebar's **Invite staff** button",
  },
  {
    id: "leave",
    keywords: ["leave", "absence", "sick leave", "annual leave", "approve leave", "vacation"],
    pages: ["leave", "leave-approvals"],
    answer:
      "🌴 **Leave**:\n\n• Staff apply in **Leave**; the headmaster approves in **Leave Approvals**\n• Approved leave shows on the timetable so cover can be arranged\n• Use **Substitutions** to assign a teacher for the missed lessons",
  },
  {
    id: "roles",
    keywords: [
      "role",
      "roles",
      "permission",
      "permissions",
      "access",
      "who can",
      "restrict",
      "admin",
      "teacher can",
      "bursar",
    ],
    pages: ["permissions", "users"],
    answer:
      "🔐 **Roles & Permissions** (sidebar → **Role Permissions**):\n\n• Roles include **Headmaster, Dean, Bursar, Teacher, Secretary, Dorm Master**\n• Each role sees only its own sidebar pages (e.g. bursar → Fees, Budget, Payroll)\n• Admins can override per-school route access in the same screen\n• Change a user's role in **Settings → Staff & Users**",
  },
  {
    id: "parent-portal",
    keywords: ["parent", "guardian", "parent portal", "parent access", "parent view", "father", "mother"],
    pages: ["parent"],
    answer:
      "👨‍👩‍👧 **Parent Portal:**\n\n• Parents open your school's portal link in any phone browser — **no app needed**\n• They log in with their child's **student number** or registered phone\n• They see attendance, grades, fees & receipts, homework, and notices\n• Share the link from Settings; SMS notifications keep them informed\n• Students have their own **Student Portal** too",
  },

  // ── Communication ─────────────────────────────────────────────────────────
  {
    id: "sms",
    keywords: ["sms", "message", "messages", "bulk", "bulk sms", "notify", "text", "send to parents", "whatsapp"],
    pages: ["messages", "bulk-sms", "sms-delivery", "sms-templates", "notices"],
    answer:
      "📱 **Messages** (sidebar → **Messages** / **SMS Centre**):\n\n• Tabs: **Messages · Bulk SMS · Automation · Templates · Notices**\n• Target by class, grade, or custom group\n• **Templates** store reusable texts; **SMS Delivery** shows sent/delivered status\n• MTN and Airtel Uganda supported, with **WhatsApp fallback** when SMS fails",
  },
  {
    id: "automation",
    keywords: ["automation", "automatic", "trigger", "reminder", "auto", "workflow", "scheduled", "if this then that"],
    pages: ["auto-sms", "automation", "workflows", "workflows"],
    answer:
      "⚡ **Automation:**\n\n• **Auto SMS Triggers** → 4 one-tap switches: fee overdue (7/14/30 days), absentee alert, payment confirmation, report-card ready\n• **Workflows** → visual *if-this-then-that*: trigger (student absent, balance low, payment received, grade published) → action (SMS, push, email, block exam card)\n• Every run is logged in **Automation Logs**",
  },
  {
    id: "notices",
    keywords: ["notice", "notices", "announcement", "post announcement", "bulletin", "circular"],
    pages: ["notices", "suggestions", "feedback"],
    answer:
      "📣 **Notices** (sidebar → **Notices**):\n\n• Post school announcements visible in the parent & student portals\n• Target everyone or a specific class\n• Pair with **SMS** in Messages for parents without portal access\n• The **Suggestion Box** collects anonymous staff/student feedback",
  },

  // ── School services ───────────────────────────────────────────────────────
  {
    id: "library",
    keywords: ["library", "books", "reading", "borrow", "return", "lend", "isbn"],
    pages: ["library"],
    answer:
      "📚 **Library** (sidebar → **Library**):\n\n• Add books with ISBN, title, author, and copies\n• Issue to students and track due dates (overdue shows red)\n• Reports show most-borrowed books by class\n• Linked to student profiles for a full academic picture",
  },
  {
    id: "health",
    keywords: ["health", "sick", "medical", "nurse", "clinic", "first aid", "sick bay", "nursing"],
    pages: ["health", "health-log"],
    answer:
      "🏥 **Health / Sick Bay** (sidebar → **Health**):\n\n• Log visits: symptoms, treatment, referrals\n• Track chronic conditions per student\n• Spot outbreaks (malaria, measles) affecting multiple learners\n• Export health summaries for term reports",
  },
  {
    id: "discipline",
    keywords: ["discipline", "behavior", "behaviour", "incident", "misconduct", "punishment", "suspension", "merit"],
    pages: ["discipline", "behavior"],
    answer:
      "⚠️ **Discipline** (sidebar → **Discipline / Behavior**):\n\n• Log incidents, warnings, suspensions **and** commendations\n• Each record links to a student + date; patterns show in their profile\n• Positive merits count too — good for balanced report comments\n• Regular logging helps identify at-risk students early",
  },
  {
    id: "dorm",
    keywords: ["hostel", "boarding", "dormitory", "dorm", "bed", "boarder", "night"],
    pages: ["dorm", "dorm-attendance", "dorm-supplies"],
    answer:
      "🛏️ **Boarding** (sidebar → **Boarding / Dorm**):\n\n• Mark students **Day** or **Boarding** in their profile\n• **Dorm Attendance** for roll calls (e.g. 5:30 AM & 9:00 PM)\n• Boarding fees sit in the Fee Structure; SMS all boarding parents at once\n• **Dorm Supplies** tracks bedding and provisions",
  },
  {
    id: "transport",
    keywords: ["transport", "bus", "route", "vehicle", "driver", "school van", "pick up", "pickup"],
    pages: ["transport"],
    answer:
      "🚌 **Transport** (sidebar → **Transport**):\n\n• Define **routes** with pickup points\n• Register vehicles and drivers\n• Assign students to routes (and bill transport fees in Fee Structure)\n• Useful for sending route-specific SMS updates",
  },
  {
    id: "canteen",
    keywords: ["canteen", "pos", "tuck shop", "shop", "sell", "sale", "wallet", "meal", "lunch", "food", "inventory"],
    pages: ["store", "canteen", "inventory"],
    answer:
      "🛍️ **School Store & Canteen:**\n\n• **Canteen POS** → quick sales (F2 = fast cash sale)\n• **Student Wallets** → pre-paid balances parents top up\n• **Meal Scan** → scan a student at the counter to bill their wallet\n• **Inventory** → stock levels for supplies and assets\n• Low canteen balances can trigger an automation",
  },
  {
    id: "assets",
    keywords: ["asset", "assets", "equipment", "maintenance", "stock", "supplies"],
    pages: ["assets", "inventory"],
    answer:
      "📦 **Assets & Inventory:**\n\n• Register school equipment (computers, desks, projectors) with location and condition\n• Track consumable supplies and reorder points\n• Useful for the **Budget** (maintenance costs) and inspection readiness",
  },
  {
    id: "payroll-leave-2",
    keywords: ["headmaster", "what does the headmaster", "bursar role", "secretary", "dorm master", "dean"],
    answer:
      "👥 **What each role sees:**\n\n• **Headmaster** — everything: dashboard, approvals, staff, analytics\n• **Dean of Studies** — academics: syllabus, exams, UNEB, lesson plans, workload\n• **Bursar** — fees, invoicing, cashbook, budget, payroll, billing\n• **Teacher** — own timetable, attendance, marks, homework, plans\n• **Secretary** — notices, messages, bulk SMS\n• **Dorm Master** — dorm, dorm attendance, health, discipline\n\nPermissions are editable in **Role Permissions**.",
  },

  // ── System ────────────────────────────────────────────────────────────────
  {
    id: "offline-sync",
    keywords: [
      "offline",
      "internet",
      "no network",
      "sync",
      "synchronise",
      "synchronize",
      "pending",
      "conflict",
      "connection",
      "airtime",
      "data",
    ],
    pages: ["sync-center"],
    answer:
      "📴 **Offline mode** — SkoolMate is built for it:\n\n• **Attendance, marks, fee payments, students, messages, timetable** keep working with no internet\n• Changes queue on the device (see the status dot in the sidebar footer)\n• Reconnect → everything uploads automatically\n• **Sync Center** shows pending items and any conflicts (server wins on newer data, your edit is kept for review)\n• Report cards can be **printed offline**",
  },
  {
    id: "settings",
    keywords: [
      "settings",
      "configure",
      "configuration",
      "school profile",
      "change school name",
      "logo",
      "colors",
      "setup",
    ],
    pages: ["settings", "setup-wizard", "setup"],
    answer:
      "⚙️ **Settings** (sidebar → **Settings**):\n\nTabs: **School Details · School Config · Staff & Users · Notifications · Messaging & Payments · Setup Checklist · Backup & Export · Billing & Plans**\n\n• Update name, logo, EMIS code, district, school colours\n• School-wide setup (terms, classes, grading) is in the **Setup Wizard**",
  },
  {
    id: "audit",
    keywords: ["audit", "log", "activity", "history", "who changed", "tracked", "security", "scan events"],
    pages: ["audit"],
    answer:
      "🕵️ **Audit Log** (sidebar → **Audit Log**):\n\n• Every create/update/delete is recorded with user, time, and record\n• **Scan Events** shows meal/attendance scans with terminal IDs\n• Check here when a record went missing or changed\n• Only admins can view the full log",
  },
  {
    id: "backup",
    keywords: ["backup", "restore", "recover", "data lost", "lost data", "export all"],
    pages: ["settings"],
    answer:
      "💾 **Backup & Recovery:**\n\n• **Settings → Backup & Export** → download a full copy of your data\n• **Export Data** (sidebar) → Excel extracts for students, grades, fees, attendance\n• Audit Log helps trace changes if something looks wrong\n• Lost a record? Check **Sync Center** first, then ask support on WhatsApp",
  },
  {
    id: "login",
    keywords: [
      "login",
      "log in",
      "sign in",
      "password",
      "reset",
      "forgot",
      "account",
      "locked out",
      "cannot log",
      "can't log",
    ],
    answer:
      "🔐 **Account & Access:**\n\n• Sign in from the login page with your email + password\n• **Forgot Password** → reset link sent to your email\n• Locked out? A school admin can reset you in **Settings → Staff & Users**\n• Sessions time out after **30 minutes** of inactivity (you'll get a 5-minute warning)\n• Super admins manage schools from the admin panel",
  },
  {
    id: "demo",
    keywords: ["demo", "demo mode", "sample data", "test data", "try it out"],
    answer:
      "🔍 **Demo Mode:**\n\nA sample school (Kimuli Junior School) with realistic data so you can explore features safely. It's marked in the sidebar. Log out and use your own school's credentials when you're ready to work with real data.",
  },
  {
    id: "support",
    keywords: [
      "help",
      "support",
      "contact",
      "issue",
      "problem",
      "bug",
      "stuck",
      "confused",
      "not working",
      "broken",
      "urgent",
    ],
    answer:
      "🆘 **Getting help:**\n\n• Ask me — I cover the whole app, online or offline\n• **WhatsApp** (green button in this chat) is our fastest channel\n• **SMS** works too if you have no data\n• We usually reply within a few hours on school days\n\nTip: include the page you're on and what you were trying to do.",
  },
  {
    id: "term-end",
    keywords: ["end of term", "term end", "close term", "new term", "lock grades", "finalise", "finalize"],
    pages: ["term-end", "rollover"],
    answer:
      "🏁 **End-of-Term Workflow** (sidebar → **Term End**):\n\n1. Confirm all marks are **Approved/Published** (it can lock grades for you)\n2. Generate **report cards** and print/collect signatures\n3. **Promote** classes to the next grade\n4. Roll dates forward and set the new term's fee structure\n\nUse **Rollover** for the year-end move of all classes.",
  },
  {
    id: "reporting-other",
    keywords: ["custom report", "build a report", "board report", "inspection", "school inspection", "gss report"],
    pages: ["custom-reports", "inspection-report", "board-report", "reports"],
    answer:
      "📑 **More reports:**\n\n• **Reports** → single-student PDF report generator\n• **Custom Reports** → pick columns, preview, export CSV\n• **Board Report** → PDF summary for governors\n• **Inspection Report** → MoE school inspection document\n• **Batch Reports** → whole-class report cards in one print job",
  },
];

const HEURISTIC_CHECKS: { test: RegExp; answer: string }[] = [
  {
    test: /\b(add|create|new|register)\b/,
    answer:
      "➕ To **add** something, look for the **+ / Add** button at the top of the page — most pages open a form or modal. Tell me *what* you want to add (student, class, payment, book…) and I'll point you to the exact page.",
  },
  {
    test: /\b(delete|remove|erase)\b/,
    answer:
      "🗑️ To **delete**, use the trash icon on the row/card (sometimes you must hover first). Some records are kept for audit/history instead of deleting — check **Audit Log** if something won't go away.",
  },
  {
    test: /\b(export|download|print|pdf|excel|csv)\b/,
    answer:
      "📥 Use **Export Data** in the sidebar for Excel extracts, or the export/print button on each list page. Report cards and ID cards have dedicated **print** windows (Ctrl+P).",
  },
  {
    test: /\b(edit|change|update|rename|correct)\b/,
    answer:
      "✏️ Open the record (click its row/card) and use the **edit/pencil** button, then **Save**. For school-wide changes (name, logo, term dates) go to **Settings**.",
  },
];

export const OWLY_TOPICS = [
  "fees",
  "attendance",
  "grades",
  "timetable",
  "messages",
  "students",
  "staff",
  "reports",
  "offline sync",
  "setup",
];

function pickBest(entries: OwlyEntry[], lower: string, tokens: string[], page?: string) {
  let best: OwlyEntry | null = null;
  let bestScore = 0;
  for (const entry of entries) {
    const score = scoreEntry(entry, lower, tokens, page);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return { entry: best, score: bestScore };
}

function pageLabel(page?: string): string {
  if (!page) return "";
  const segment = page.split("/").filter(Boolean).pop() || "";
  return segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Answer a question fully offline — no network, no API key. */
export function answerLocally(input: string, ctx: OwlyContext = {}): string {
  const lower = input.toLowerCase().trim();
  if (!lower) return "Ask me anything about SkoolMate — fees, attendance, grades, setup, or offline sync.";

  const tokens = tokenize(lower);
  const { entry, score } = pickBest(KNOWLEDGE, lower, tokens, ctx.page);
  if (entry && score >= 3) return entry.answer;

  for (const check of HEURISTIC_CHECKS) {
    if (check.test.test(lower)) return check.answer;
  }

  const here = pageLabel(ctx.page);
  const topicList = OWLY_TOPICS.slice(0, 8).join(", ");
  return `I don't have a built-in answer for that one${here ? ` while you're on **${here}**` : ""}.\n\nTry asking about: **${topicList}** — or tap the green **WhatsApp** button to reach the SkoolMate team.`;
}

/** Page-aware quick-hint chips shown under the chat. */
export function getPageHints(page?: string): string[] {
  const path = page || "";
  if (path.includes("fees") || path.includes("finance"))
    return ["How do I record a payment?", "How do payment plans work?"];
  if (path.includes("attendance")) return ["How does offline attendance work?", "How do I mark a student absent?"];
  if (path.includes("grades") || path.includes("marks")) return ["How do I lock grades?", "How do I publish results?"];
  if (path.includes("report")) return ["How do I print report cards?", "How do I add headmaster comments?"];
  if (path.includes("syllabus") || path.includes("scheme"))
    return ["How do I load NCDC topics?", "How do I check syllabus coverage?"];
  if (path.includes("timetable")) return ["How do I add a lesson slot?", "How do I handle teacher substitutions?"];
  if (path.includes("staff") || path.includes("payroll"))
    return ["How do I add a staff member?", "How does payroll work?"];
  if (path.includes("student")) return ["How do I import students from CSV?", "How do I promote a class?"];
  if (path.includes("message") || path.includes("sms") || path.includes("notices"))
    return ["How do I send bulk SMS?", "How do I automate fee reminders?"];
  if (path.includes("exam") || path.includes("uneb"))
    return ["How do I register UNEB candidates?", "How do I enter CA marks?"];
  if (path.includes("dorm") || path.includes("boarding"))
    return ["How do I take dorm attendance?", "How do I add boarding fees?"];
  if (path.includes("budget") || path.includes("payroll"))
    return ["How do I log an expense?", "How do expense approvals work?"];
  if (path.includes("settings") || path.includes("setup"))
    return ["How do I run the setup wizard?", "How do I invite staff?"];
  if (path.includes("sync") || path.includes("offline"))
    return ["What syncs offline?", "How do I resolve a sync conflict?"];
  if (path.includes("library") || path.includes("health") || path.includes("transport"))
    return ["How do I get started here?", "How do I export records?"];
  return ["What can you help me with?", "How do I get started?", "What works offline?"];
}
