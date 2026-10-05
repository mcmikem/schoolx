// Owly's built-in knowledge base.
// This is the offline brain: it answers questions about SkoolMate OS without any
// network call or AI API key, so the assistant stays useful in the field.
//
// Answers are structured: a title, a "where to go" line, numbered steps, quick
// facts, and a tip. UI labels below match the real buttons in the app.

export interface OwlyEntry {
  id: string;
  keywords: string[];
  /** Pathname fragments — used only as a tie-breaker when keywords are weak. */
  pages?: string[];
  title?: string;
  where?: string;
  steps?: string[];
  facts?: string[];
  tip?: string;
  /** Free-form answer (used for conversational entries). */
  answer?: string;
}

export interface OwlyContext {
  page?: string;
}

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

function keywordScore(entry: OwlyEntry, lower: string, tokens: string[]): number {
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
  return score;
}

function pageScore(entry: OwlyEntry, page?: string): number {
  if (!page || !entry.pages?.length) return 0;
  return entry.pages.some((p) => page.includes(p)) ? 3 : 0;
}

function renderEntry(entry: OwlyEntry): string {
  if (entry.answer) return entry.answer;
  const lines: string[] = [];
  if (entry.title) lines.push(`**${entry.title}**`, "");
  if (entry.where) lines.push(`📍 ${entry.where}`);
  if (entry.steps?.length) {
    lines.push("");
    entry.steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
  }
  if (entry.facts?.length) {
    lines.push("");
    entry.facts.forEach((fact) => lines.push(`• ${fact}`));
  }
  if (entry.tip) lines.push("", `💡 ${entry.tip}`);
  return lines.join("\n");
}

export const KNOWLEDGE: OwlyEntry[] = [
  // ── Conversational ────────────────────────────────────────────────────────
  {
    id: "greeting",
    keywords: ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "how are you"],
    answer:
      "Hello! 👋 I'm **Owly**, your SkoolMate guide.\n\nAsk me anything about the app — **fees, attendance, grades, reports, SMS, setup, offline sync** — and I'll show you exactly where to click, even without internet.",
  },
  {
    id: "thanks",
    keywords: ["thanks", "thank you", "appreciate", "cheers", "nice one"],
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
      "I can walk you through any part of SkoolMate:\n\n• **Money** — fees, invoicing, payment plans, cashbook, budget, payroll\n• **Teaching** — attendance, grades, exams, syllabus, lesson plans, timetable\n• **People** — students, staff, ID cards, transfers, promotion\n• **Comms** — SMS, notices, templates, automation\n• **Admin** — setup, roles, billing, reports, offline sync\n\nJust type your question in plain English.",
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

  // ── Navigation & getting started ─────────────────────────────────────────
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
    title: "Finding any page",
    where: "**Left sidebar** — grouped by job (use **Find page…** at the top of the sidebar to filter it)",
    facts: [
      "**Today** — Dashboard, Attendance, Fees, Messages",
      "**Daily Work** — Students, Staff, Grades & Reports, Timetable, Calendar, Analytics",
      "**Teaching & Exams** — Exams, Assignments, Syllabus, Terms, Subjects, SMS Centre",
      "**Reports & Readiness** — ID Cards, Financial Reports, Teacher Performance, Audit Log",
      "**School Office** — Budget, Payroll, Health, Transport, Library, Boarding",
      "**Other Tools** — Inventory, Settings, Role Permissions, Offline Sync",
      "Page missing? Your **role or plan** may not include it — ask the headmaster to check **Role Permissions**",
    ],
    tip: "Press Ctrl+K / ⌘K to search pages, students and actions from anywhere.",
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
    title: "Keyboard shortcuts",
    steps: [
      "**Ctrl+K / ⌘K** — Global Search: find pages, students and actions (arrow keys + Enter)",
      "**Ctrl+N** — new record (Fees payment / new student)",
      "**Ctrl+F** — focus the page's search box",
      "**Esc** — close any modal, menu or the sidebar",
      "**F2** — quick cash sale in the Canteen POS",
      "**Ctrl+P** — print (report cards, receipts, ID cards)",
    ],
    facts: [
      "Sidebar has a **Find page…** filter and remembers your last pages under *Continue where you left off*",
      "In the chat here, press **Enter** to send and **Shift+Enter** for a new line",
    ],
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
    title: "Getting started",
    where: "**Setup Wizard** — sidebar → Other Tools, or `/dashboard/setup-wizard`",
    steps: [
      "**1 School & Subjects** — school name, phone, district, school type, logo",
      "**2 Calendar & Fees** — term dates and your fee structure",
      "**3 Grading & Reports** — grading system and report-card branding",
      "**4 Boarding & Features** — boarding, modules you need",
      "**5 Launch** — **Finish Setup & Launch**",
      "Then: **import students**, add staff, take first attendance, record first payment",
    ],
    facts: [
      "About 5–10 minutes; progress is saved, so you can leave and resume",
      "The checklist also lives in **Settings → Setup Checklist**",
      'Not now? Click "Skip for now — finish in dashboard"',
    ],
    tip: "Stuck? The WhatsApp button opens a pre-filled message to our team for a guided setup call.",
  },

  // ── Import & export ──────────────────────────────────────────────────────
  {
    id: "import-students",
    keywords: [
      "import",
      "upload",
      "csv",
      "excel",
      "spreadsheet",
      "paste",
      "google sheets",
      "bulk add",
      "bulk import",
      "template",
      "add many students",
      "list of students",
    ],
    pages: ["import"],
    title: "Import students from CSV / Excel",
    where: "**Students → Import CSV**, or the Import page at `/dashboard/import`",
    steps: [
      "Get the template: **Excel Template** or **Word Template** (Step 1 — optional if you already have a list)",
      "Choose how to add them (Step 2): **Upload a file** (Word, Excel or CSV) · **Paste a list** (AI reads messy text) · **Google Sheets** (paste a shared link, set it to *Anyone with the link can view*)",
      "Check the **Review your students** table — each row shows **Ready** or *need fixing (will be skipped)*",
      "Click **Confirm & Import N Students**, then check the **Import Results** (Successful / Failed / Errors)",
    ],
    facts: [
      "Required per student: **first name, last name, gender** — rows missing these are skipped",
      '**Class must already exist** or you\'ll see `Class "X" not found`',
      "Parent phone must be a valid Ugandan number (e.g. 0771234567)",
      "Auto-assigned student numbers look like `STU00001`",
      "Students page → **Import CSV** opens a CSV-only bulk modal with **Download CSV template**",
      "Import runs about 10 uploads per minute — split big lists into batches",
    ],
    tip: "Photos come later: **Students → Photos** uploads them in batch by student number.",
  },
  {
    id: "export",
    keywords: ["export", "download", "print", "pdf", "xlsx", "back up", "backup my data", "csv file"],
    pages: ["export", "custom-reports"],
    title: "Export & print data",
    where: "**Export Data** in the sidebar — or the export/print button on each list page",
    steps: [
      "**Excel (.xlsx)**: students, UNEB candidates, grades, attendance, fees",
      "**CSV**: available on Students, Grades, Attendance, Audit, Custom Reports",
      "**PDF**: single-student report, board report, inspection report, budget",
      "**Print windows**: report cards, batch reports, ID cards (Ctrl+P)",
      "Full copy of everything: **Settings → Backup & Export**",
    ],
    tip: "Report cards can be printed while offline — they queue and upload when you reconnect.",
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
    pages: ["fees", "finance", "invoicing"],
    title: "Record a fee payment",
    where: "**Fees** (sidebar) — tabs: Student Balances · Paying in Bits · Invoices · Daily Money Log · Payment Claims",
    steps: [
      "Click **Add Payment** (or press **Ctrl+N**)",
      "**Step 1 — Student**: select the student, enter **Amount (UGX)** — quick chips: Full · Half · 50k · 100k",
      "**Step 2 — Method**: Cash · Mobile Money · Bank Transfer · Installment · In Kind",
      "For Mobile Money: pick **MoMo Provider** (MTN/Airtel) and enter the **Transaction ID** (required)",
      "Click **Pay UGX …** — you get a **Fee Payment Receipt** with **Print Receipt**",
    ],
    facts: [
      "Set the term's charges under **Set New Fees** (Fee Name, Class, Amount, Term, Due Date)",
      "Part-payment schedules: **Pay in Bits** → **Create Payment Plan** → number of installments",
      "Bursaries/discounts: **Scholarship/Discount** → **Record Fee Adjustment**",
      "Paying more than the balance needs the **Record excess as credit** tickbox",
      "Payment date is stamped automatically (there's no date picker)",
    ],
    tip: "Works offline — payments queue on the device and sync when you're back online.",
  },
  {
    id: "mobile-money",
    keywords: ["momo", "mtn", "airtel", "mobile money", "ush", "pay by phone", "cash", "bank transfer"],
    title: "Accepting payments",
    steps: [
      "**Cash** — record it in **Add Payment**, then **Print Receipt**",
      "**MTN MoMo / Airtel Money** — record Method = Mobile Money with the **Transaction ID** from the parent's phone",
      "**Bank Transfer** — record with the reference number",
    ],
    facts: [
      "Your school's MoMo/Airtel numbers are configured in **Settings → Messaging & Payments**",
      "Parents can also pay at your registered number — record it when the alert arrives",
    ],
    tip: "Never skip the Transaction ID: it's how you prove a MoMo payment later.",
  },
  {
    id: "payment-plans",
    keywords: ["installment", "instalment", "payment plan", "pay in bits", "part payment", "structure"],
    title: "Let parents pay in installments",
    where: "**Fees → Pay in Bits**",
    steps: [
      "Open **Pay in Bits** and click **Create Payment Plan**",
      "Pick the student and the **Number of Installments** (2, 3, 4…)",
      "Click **Create Plan** — the schedule appears against the student's balance",
      "Record each instalment as a normal payment; the plan tracks what's left",
    ],
    facts: [
      "Fee-wide schedules (e.g. 40% / 30% / 30%) are set in **Fee Terms**",
      "Parents on a plan can be reminded from **Messages → Bulk SMS → Outstanding Fees**",
    ],
  },
  {
    id: "cashbook",
    keywords: ["cashbook", "daily money log", "money log", "cash log", "income"],
    title: "Daily Money Log (cashbook)",
    where: "**Fees → Daily Money Log**",
    facts: [
      "Shows every payment received each day, with method and receipt number",
      "Pair with **Budget → Log Expense** to keep the ledger complete",
      "Export it from **Export Data** or the page's CSV button",
      "Bursars see a cashbook shortcut on their dashboard",
    ],
  },
  {
    id: "budget",
    keywords: ["budget", "expense", "expenditure", "spending", "approve", "approval", "funds"],
    pages: ["budget", "expense-approvals"],
    title: "Budget & expenses",
    where: "**Budget** (sidebar → School Office)",
    steps: [
      "Click **Log Expense** and pick a category (Staff, Maintenance, Supplies, Activities…)",
      "Expenses above your threshold go to **Expense Approvals** for the headmaster",
      "Approve or reject them there (they also appear in *Needs Attention* on the dashboard)",
      "Reports compare spending vs fee income by term",
    ],
  },
  {
    id: "payroll",
    keywords: ["payroll", "salary", "salaries", "wage", "pay slip", "payslip", "nssf", "paye"],
    pages: ["payroll"],
    title: "Payroll",
    where: "**Payroll** (sidebar → School Office)",
    steps: [
      "Set each staff member's salary — by **Scale 1–5** (Uganda Government scales) or a custom amount",
      "Run monthly payroll: **PAYE** and **NSSF** are calculated automatically",
      "Export payslips for printing",
    ],
    facts: ["Custom salary grades are supported alongside the government scales"],
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
    title: "Subscription & billing",
    where: "**Settings → Billing & Plans**",
    facts: [
      "**Free Trial** — up to 100 students",
      "**Starter** — UGX 2,000/student/term (≤ 200 students)",
      "**Growth** — UGX 3,500 (≤ 500; parent portal, dorm, library, budget)",
      "**Enterprise** — UGX 5,500 (unlimited; UNEB, MoES, payroll, automation, audit)",
      "Pay with **MTN MoMo** or **Airtel Money** — you get a phone prompt to enter your PIN",
      "After expiry you get a **14-day grace period**",
    ],
    tip: "Payment not going through? WhatsApp the team with your school name and plan.",
  },

  // ── Attendance ────────────────────────────────────────────────────────────
  {
    id: "attendance",
    keywords: ["attendance", "absent", "present", "mark", "register", "late", "roll call", "excused"],
    pages: ["attendance", "period-attendance"],
    title: "Take class attendance",
    where: "**Attendance** (sidebar → Today) — the *Attendance Center*",
    steps: [
      "**Select Class** and the **Date** (defaults to today)",
      "Set each student: **In School · Not In School · Late · Excused** — in Cards view, tap to cycle status",
      "Shortcut mode: switch on **Call Out Names** — everyone starts *In School*, tap only those Away",
      "Click **Save Changes** (or **Save: N present, M away…** in Call Out Names mode)",
      "Need a bulk range? Toggle **Bulk** → **Mark All In School / Not In School / Late / Excused**",
    ],
    facts: [
      "**Quick Mark Absent** modal: pick absentees, everyone else stays present",
      "**Copy Yesterday** fills the register from the previous day",
      "**Absentee SMS Alerts** toggle auto-texts parents when a child is marked absent",
      "**Export** downloads `attendance-<class>-<date>.csv`",
      "Offline: the button becomes **Save Offline**, records queue (see the **Offline queue** tile), then sync",
    ],
    tip: "Separate registers exist for staff (**Staff Attendance**) and boarders (**Dorm Attendance**).",
  },
  {
    id: "staff-attendance",
    keywords: ["staff attendance", "teacher attendance", "check in", "scan terminal", "clock in"],
    pages: ["staff-attendance"],
    title: "Staff attendance",
    where: "**Staff → Staff Attendance**",
    steps: [
      "Mark each staff member present/absent for the day",
      "Or use the **scan terminal** so staff check in themselves with a scanned code",
      "Export the log to CSV from the page",
    ],
    facts: ["Combine with **Staff Activity** to see who has been doing what"],
  },

  // ── Grades, exams, reports ────────────────────────────────────────────────
  {
    id: "grades",
    keywords: ["grade", "grades", "mark", "marks", "score", "exam", "ca", "continuous assessment", "entry", "publish"],
    pages: ["grades", "marks-completion", "exam-timetable"],
    title: "Enter & publish marks",
    where: "**Grades** (sidebar → Daily Work) — *Grades & Marks*",
    steps: [
      "1 **Choose class** → 2 **Choose subject** → 3 enter marks in **CA1, CA2, CA3…, EXAM**",
      "Each cell auto-saves after a moment; **Save Grades** saves everything at once",
      "Workflow buttons: **Submit to Dean** (or **Submit to HM**) → **Approve Grades** → **Publish Grades**",
      "Status chips show progress: *Still Writing → Sent to Boss → Boss Approved → Ready for Parents*",
      "When done, **Close for Edits (Lock)** locks the CA marks for that class/subject",
    ],
    facts: [
      "Weighting shows as `10+10+10+70` (CA1+CA2+CA3 : Exam) — set it in Settings",
      "**Quick Fill**, hover **Set All Students**, **Copy Prev Term** and **Import** (Excel/CSV) speed up entry",
      "**Marks Completion** shows which classes still owe marks",
      "Only Dean/headmaster can approve; only headmaster can publish",
    ],
    tip: "After grades are approved, avoid **Save Grades** — it puts them back to draft. Use the workflow buttons instead.",
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
    title: "Generate report cards",
    where: "**Report Cards** — after grades are *Published*",
    steps: [
      "Open **Report Cards** — subjects, marks and comments auto-fill",
      "Add the **headmaster's comment** per student (HODs add subject remarks)",
      "Print one student, or use **Batch Reports** to print a whole class in one job",
      "Need comment ideas? **Comments** generates remarks from the scores in bulk",
    ],
    facts: [
      "UNEB-style layout: Class Teacher comment, HOD remark, Principal signature",
      "Printing works **offline** — jobs queue and upload when you reconnect",
      "Signatures are set up in **Settings → Signatures** (optional post-setup step)",
    ],
  },
  {
    id: "exams",
    keywords: ["exam", "exams", "ca1", "ca2", "ca3", "mid term", "mid-term", "eot", "end of term", "test", "paper"],
    pages: ["exams"],
    title: "Exams & tests",
    where: "**Exams** (sidebar → Teaching & Exams)",
    facts: [
      "Exam types: **CA, Mid Term, End of Term** (plus Saturday/BOT tests)",
      "**Exam Timetable** schedules papers by class and subject",
      "Enter marks per exam, then publish to unlock report cards",
      "Analyse results with **UNEB Analysis** (divisions) and **Analytics**",
    ],
  },
  {
    id: "uneb",
    keywords: ["uneb", "ple", "uce", "uace", "candidate", "index number", "division"],
    pages: ["uneb", "uneb-registration"],
    title: "UNEB registration & analysis",
    where: "**UNEB Registration** / **UNEB** in the sidebar",
    steps: [
      "Register candidates by class: PLE (P7), UCE (S4), UACE (S6)",
      "Assign each candidate an **index number**",
      "Export the list in UNEB-compatible format",
      "Check divisions in **UNEB Analysis**",
    ],
    facts: [
      "Candidates need their National ID / birth certificate (NIRA) number on file",
      "Registration links to NCDC syllabus tracking for exam prep",
    ],
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
    title: "MoES / government reporting",
    where: "**MoES** and **MoES Reports** in the sidebar",
    facts: [
      "**MoES** → Headcount return (enrolment by gender, class, age)",
      "**MoES Reports** → EMIS exports as **.xlsx / .json**",
      "Teacher qualification and deployment reports",
      "Set your EMIS code in **Settings → School Profile**",
    ],
    tip: "Termly returns export straight from SkoolMate — no re-typing into ministry forms.",
  },
  {
    id: "analytics",
    keywords: ["analytics", "insights", "stats", "statistics", "trends", "dashboard", "data quality"],
    pages: ["analytics", "trends", "class-comparison", "data-quality"],
    title: "Analytics & data quality",
    where: "**Analytics** (sidebar → Daily Work)",
    facts: [
      "Dashboards for enrolment, performance, fees and attendance trends",
      "**Trends** compares results across terms; **Class Comparison** ranks classes",
      "**Data Quality** flags missing or duplicate records before you report",
      "**Board Report** exports a PDF for governors",
    ],
  },
  {
    id: "early-warnings",
    keywords: ["warning", "warnings", "at risk", "risk", "dropout", "failing", "concern", "flag student"],
    pages: ["warnings", "dropout-tracking"],
    title: "Early warnings & dropout tracking",
    where: "**Warnings** and **Dropout Tracking**",
    facts: [
      "Flags students with long absence streaks, falling grades, or overdue fees",
      "**Dropout Tracking** lists students with repeated absences",
      "Pair with **Automation** to auto-SMS parents when a student is flagged",
      "Open the student's profile to see the full pattern",
    ],
  },

  // ── Curriculum & teaching ─────────────────────────────────────────────────
  {
    id: "ncdc",
    keywords: ["ncdc", "curriculum", "syllabus", "topics", "scheme", "coverage"],
    pages: ["syllabus", "syllabus-tracker", "scheme-of-work"],
    title: "NCDC syllabus & coverage",
    where: "**Syllabus** (sidebar → Teaching & Exams)",
    steps: [
      "Select class, subject and term, then click **NCDC Topics** to load the national curriculum",
      "Mark each topic **Not Started / In Progress / Completed**",
      "**Scheme of Work** turns completed topics into weekly lesson breakdowns",
      "**Syllabus Tracker** shows coverage % per subject (P1–P7, S1–S6)",
    ],
    tip: "SkoolMate ships with the revised NCDC curriculum — you usually don't type topics yourself.",
  },
  {
    id: "lesson-plans",
    keywords: ["lesson plan", "lesson plans", "plan lesson", "weekly plan"],
    pages: ["lesson-plans"],
    title: "Lesson plans",
    where: "**Lesson Plans** (sidebar → Teaching & Exams)",
    steps: [
      "Create a plan for the class, subject and week you're teaching",
      "Base it on the syllabus topic you're covering",
      "Print or export it — inspectors ask for these",
    ],
    facts: ["Related: **Scheme of Work** (weekly overview) and **Homework** (assignments)"],
  },
  {
    id: "homework",
    keywords: ["homework", "assignment", "assignments", "classwork", "submit", "submission"],
    pages: ["homework", "homework-submissions"],
    title: "Homework & assignments",
    where: "**Homework** (sidebar → Teaching & Exams)",
    steps: [
      "Assign work to a class with a due date",
      "**Homework Submissions** tracks who handed in and who didn't",
      "Post a reminder to parents via **Notices** or **Messages**",
    ],
    facts: ["Teachers see pending assignments on their dashboard"],
  },
  {
    id: "timetable",
    keywords: ["timetable", "schedule", "period", "lesson", "slot", "free period", "double period"],
    pages: ["timetable", "allocations", "substitutions", "workload"],
    title: "Build the timetable",
    where: "**Timetable** (sidebar → Daily Work)",
    steps: [
      "Select a class, then click any empty slot",
      "Assign the **teacher and subject** — teacher double-bookings are flagged automatically",
      "Delete a slot by hovering it and clicking the trash icon",
    ],
    facts: [
      "**Term Calendar** tab shows holidays, midterms and EOT dates",
      "**Substitutions** covers an absent teacher; **Workload** shows each teacher's load",
      "School-wide period slots are configured in **Settings → Timetable Slots**",
    ],
  },
  {
    id: "calendar",
    keywords: ["calendar", "event", "events", "holiday", "term dates", "school calendar", "activities"],
    pages: ["calendar", "academic-terms"],
    title: "School calendar",
    where: "**Calendar** (sidebar → Daily Work)",
    facts: [
      "Month/week/day views of events, holidays and activities",
      "Add term dates, sports days, parents' meetings",
      "**Academic Terms** manages term names and date ranges (used by fees, grades and reports)",
      "Events can be published to parents via **Notices**",
    ],
  },
  {
    id: "subjects",
    keywords: ["subject", "subjects", "course", "courses", "class", "classes", "stream", "streaming"],
    pages: ["subjects", "classes", "courses"],
    title: "Classes & subjects",
    where: "**Classes** and **Subjects** (also step 1 of the Setup Wizard)",
    facts: [
      "**Classes** — create classes/streams and assign class teachers",
      "**Subjects** — subjects offered and which grades each subject uses",
      "**Courses** — course offerings for senior secondary",
      'Set these up before entering marks, otherwise imports fail with `Class "X" not found`',
    ],
  },

  // ── People ────────────────────────────────────────────────────────────────
  {
    id: "students",
    keywords: ["student", "students", "learner", "enrol", "enroll", "admission", "pupil", "registry"],
    pages: ["students", "student-enrollments", "student-lookup"],
    title: "Student records",
    where: "**Students** (sidebar → Daily Work)",
    facts: [
      "Tabs: **Registry · Transfers · Dropouts · Promotion**",
      "Add one student with **+ Add**, or bulk-import a list (see *import students*)",
      "Each student gets a unique **student number** (used on ID cards and receipts)",
      "Open a student for the full profile: attendance, grades, fees, conduct, health",
      "**Students → Photos** uploads photos in batch by student number",
    ],
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
    pages: ["promotion", "rollover"],
    title: "Transfers, promotion & rollover",
    steps: [
      "**Students → Transfers** — move a student in/out with dates and reason",
      "**Promotion** — move a whole class up (or mark repeaters)",
      "**Term End** / **Rollover** — close the term: lock grades, promote, prep the next term",
      "**Graduation** and **Alumni** keep leaver records",
    ],
  },
  {
    id: "id-cards",
    keywords: ["id card", "id cards", "identity", "badge", "admission package", "letter"],
    pages: ["idcards"],
    title: "ID cards & admission package",
    where: "**ID Cards** (sidebar → Reports & Readiness) or **Students → Identity Center**",
    steps: [
      "Generate student ID cards with photo, student number and school logo",
      "Print them in batches",
      "**Students → Admission Package** produces official enrolment documents",
    ],
    tip: "Update photos first via **Students → Photos** so cards aren't blank.",
  },
  {
    id: "staff",
    keywords: ["staff", "teacher", "teachers", "employee", "employees", "hire", "add staff", "tsc", "directory"],
    pages: ["staff", "users", "staff-activity", "staff-performance"],
    title: "Staff directory",
    where: "**Staff** (sidebar → Daily Work)",
    facts: [
      "**Staff Directory** lists everyone with role, subjects and classes",
      "Add staff from the Staff hub (or **Settings → Staff & Users**)",
      "**Staff Activity** shows recent actions; **Staff Performance** shows metrics",
      "Invite colleagues from the **Invite staff** button in the sidebar footer",
    ],
  },
  {
    id: "leave",
    keywords: ["leave", "vacation", "sick leave", "annual leave", "approve leave"],
    pages: ["leave", "leave-approvals"],
    title: "Staff leave",
    where: "**Leave** to apply · **Leave Approvals** to approve",
    steps: [
      "Staff submit a leave request with dates and reason",
      "Headmaster approves or rejects in **Leave Approvals**",
      "Approved leave shows on the timetable — use **Substitutions** to cover the lessons",
    ],
  },
  {
    id: "roles",
    keywords: ["role", "roles", "permission", "permissions", "access", "who can", "restrict", "admin", "bursar"],
    pages: ["permissions", "users"],
    title: "Roles & permissions",
    where: "**Role Permissions** (sidebar → Other Tools)",
    facts: [
      "Roles: **Headmaster, Dean of Studies, Bursar, Teacher, Secretary, Dorm Master**",
      "Each role sees only its own sidebar pages (e.g. bursar → Fees, Budget, Payroll)",
      "Admins can override per-school route access on the same screen",
      "Change a user's role in **Settings → Staff & Users**",
    ],
  },
  {
    id: "parent-portal",
    keywords: ["parent", "guardian", "parent portal", "parent access", "parent view", "father", "mother"],
    pages: ["parent"],
    title: "Parent (and student) portal",
    facts: [
      "Parents open your school's portal link in any phone browser — **no app needed**",
      "They log in with their child's **student number** or registered phone",
      "They see attendance, grades, fees & receipts, homework and notices",
      "Students have their own **Student Portal** too",
      "Share the link from Settings; SMS notifications keep parents informed",
    ],
  },
  {
    id: "role-overview",
    keywords: ["headmaster", "bursar role", "secretary", "dorm master", "dean", "what does the"],
    answer:
      "👥 **What each role sees:**\n\n• **Headmaster** — everything: dashboard, approvals, staff, analytics\n• **Dean of Studies** — academics: syllabus, exams, UNEB, lesson plans, workload\n• **Bursar** — fees, invoicing, cashbook, budget, payroll, billing\n• **Teacher** — own timetable, attendance, marks, homework, plans\n• **Secretary** — notices, messages, bulk SMS\n• **Dorm Master** — dorm, dorm attendance, health, discipline\n\nPermissions are editable in **Role Permissions**.",
  },

  // ── Communication ─────────────────────────────────────────────────────────
  {
    id: "sms",
    keywords: ["sms", "message", "messages", "bulk", "bulk sms", "notify", "text", "send to parents", "whatsapp"],
    pages: ["messages", "bulk-sms", "sms-delivery", "sms-templates"],
    title: "Send bulk SMS to parents",
    where: "**Messages → Bulk SMS** (Communication Hub) — or **SMS Centre** in the sidebar",
    steps: [
      "Pick a **Target Audience**: All Parents · By Class · Outstanding Fees · Custom Selection",
      "Choose **Use Template** (Fee Reminder, Attendance, Exam…) or type your own message",
      "Check the **Summary**: recipients, SMS per parent, total SMS, **Est. Cost (UGX …)**",
      "Click **Send Bulk SMS** → **Confirm & Send**",
    ],
    facts: [
      "Tabs in the hub: **Messages · Bulk SMS · Automation · Templates · Notices**",
      "One-parent messages support channel **Auto / WhatsApp / SMS**",
      "Hub messages are capped at 640 characters",
      "SMS Centre supports variables: `{student_name}`, `{date}`, `{amount}`, `{school_name}`",
      "Needs a **Starter plan or higher**; MTN and Airtel Uganda are supported with WhatsApp fallback",
    ],
    tip: "**SMS Centre → Parents with Overdue Fees** is the fastest fee reminder — it filters by real balance.",
  },
  {
    id: "automation",
    keywords: ["automation", "automatic", "trigger", "reminder", "auto", "workflow", "scheduled"],
    pages: ["auto-sms", "automation", "workflows"],
    title: "Automation & auto-reminders",
    where: "**Auto SMS Triggers** · **Workflows** · **Messages → Automation**",
    facts: [
      "Auto SMS Triggers (one-tap switches): **fee overdue (7/14/30 days)**, **absentee alert**, **payment confirmation**, **report card ready**",
      "Workflows = if-this-then-that: trigger (student absent, canteen balance low, payment received, grade published) → action (SMS, push notification, email bursar, block exam card)",
      "Every run is logged in **Automation Logs** (`/dashboard/automation/logs`)",
    ],
    tip: "Start with the two switches every school needs: fee overdue + absentee alert.",
  },
  {
    id: "notices",
    keywords: ["notice", "notices", "announcement", "post announcement", "bulletin", "circular"],
    pages: ["notices", "suggestions"],
    title: "Notices & announcements",
    where: "**Notices** (sidebar) or **Messages → Notices**",
    steps: [
      "Write the notice and choose the audience (everyone or a specific class)",
      "Publish — it appears in the parent and student portals",
      "For parents without portal access, follow up with SMS in **Messages**",
    ],
    facts: ["The **Suggestion Box** collects anonymous staff and student feedback"],
  },

  // ── School services ───────────────────────────────────────────────────────
  {
    id: "library",
    keywords: ["library", "books", "reading", "borrow", "return", "lend", "isbn"],
    pages: ["library"],
    title: "Library",
    where: "**Library** (sidebar → School Office)",
    steps: [
      "Add books with ISBN, title, author and number of copies",
      "Issue books to students and set the return date",
      "Overdue books show in red; reports show most-borrowed titles by class",
    ],
  },
  {
    id: "health",
    keywords: ["health", "sick", "medical", "nurse", "clinic", "first aid", "sick bay", "nursing"],
    pages: ["health", "health-log"],
    title: "Health / sick bay",
    where: "**Health** (sidebar → School Office)",
    steps: [
      "Log a visit: symptoms, treatment given, referral",
      "Track chronic conditions on the student's record",
      "Export health summaries for term reports",
    ],
    facts: ["Regular logging shows outbreaks (malaria, measles) affecting multiple learners"],
  },
  {
    id: "discipline",
    keywords: ["discipline", "behavior", "behaviour", "incident", "misconduct", "punishment", "suspension", "merit"],
    pages: ["discipline", "behavior"],
    title: "Discipline & behaviour",
    where: "**Discipline / Behavior** (sidebar)",
    steps: [
      "Log the incident: student, date, description, action taken",
      "Record warnings, suspensions — and commendations too",
      "Patterns appear in the student's profile and report comments",
    ],
    facts: ["Regular logging helps identify at-risk students early"],
  },
  {
    id: "dorm",
    keywords: ["hostel", "boarding", "dormitory", "dorm", "bed", "boarder", "night"],
    pages: ["dorm", "dorm-attendance", "dorm-supplies"],
    title: "Boarding & dorm",
    where: "**Boarding / Dorm** (sidebar → School Office)",
    steps: [
      "Mark students **Day** or **Boarding** in their profile",
      "**Dorm Attendance** for nightly roll calls (e.g. 5:30 AM and 9:00 PM)",
      "Add boarding charges to the **Fee Structure**",
      "**Dorm Supplies** tracks bedding and provisions",
    ],
    facts: ["You can SMS all boarding parents at once from **Messages**"],
  },
  {
    id: "transport",
    keywords: ["transport", "bus", "route", "vehicle", "driver", "school van", "pick up", "pickup"],
    pages: ["transport"],
    title: "Transport",
    where: "**Transport** (sidebar → School Office)",
    steps: [
      "Define **routes** with pickup points",
      "Register vehicles and drivers",
      "Assign students to routes (bill transport fees in the Fee Structure)",
    ],
    facts: ["Useful for sending route-specific SMS updates"],
  },
  {
    id: "canteen",
    keywords: ["canteen", "pos", "tuck shop", "shop", "sell", "sale", "wallet", "meal", "lunch", "food", "inventory"],
    pages: ["store", "canteen", "inventory"],
    title: "Canteen, POS & wallets",
    where: "**Store** section: Canteen POS · Student Wallets · Meal Scan · Inventory",
    facts: [
      "**Canteen POS** — quick sales; **F2** opens an exact-cash fast sale",
      "**Student Wallets** — pre-paid balances parents top up",
      "**Meal Scan** — scan a student at the counter to bill their wallet",
      "**Inventory** — stock levels for supplies",
      "Low canteen balances can trigger a workflow automation",
    ],
  },
  {
    id: "assets",
    keywords: ["asset", "assets", "equipment", "maintenance", "stock", "supplies"],
    pages: ["assets", "inventory"],
    title: "Assets & inventory",
    where: "**Assets** or **Store → Inventory**",
    facts: [
      "Register equipment (computers, desks, projectors) with location and condition",
      "Track consumables and reorder points",
      "Feeds the **Budget** (maintenance costs) and inspection readiness",
    ],
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
    ],
    pages: ["sync-center"],
    title: "Offline mode & sync",
    where: "**Sync Center** (sidebar → Other Tools) — status dot is in the sidebar footer",
    facts: [
      "**Attendance, marks, fee payments, students, messages and timetable** keep working with no internet",
      "Changes queue on the device; reconnect and they upload automatically",
      "Conflicts: the **server wins** when its record is newer, but your edit is kept locally for review",
      "Report cards can be **printed offline**",
      "**Sync Now** in Sync Center forces a push; the **Offline queue** tile shows what's pending",
    ],
    tip: "Waiting too long? The queue retries 3 times — check Sync Center if something is stuck.",
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
    title: "Settings",
    where: "**Settings** (sidebar → Other Tools)",
    facts: [
      "Tabs: **School Details · School Config · Staff & Users · Notifications · Messaging & Payments · Setup Checklist · Backup & Export · Billing & Plans**",
      "Update name, logo, EMIS code, district and school colours under School Details",
      "Term dates, classes and grading live in the **Setup Wizard**",
    ],
  },
  {
    id: "audit",
    keywords: ["audit", "log", "activity", "history", "who changed", "tracked", "security", "scan events"],
    pages: ["audit"],
    title: "Audit log",
    where: "**Audit Log** (sidebar → Reports & Readiness)",
    facts: [
      "Every create/update/delete is recorded with user, time and record",
      "**Scan Events** shows meal/attendance scans with terminal IDs",
      "Check here when a record went missing or changed",
      "Only admins see the full log",
    ],
  },
  {
    id: "backup",
    keywords: ["backup", "restore", "recover", "data lost", "lost data"],
    title: "Backup & recovery",
    where: "**Settings → Backup & Export**",
    steps: [
      "Download a full copy of your data from **Backup & Export**",
      "For a specific table, use **Export Data** (Excel) or the page's CSV button",
      "Lost a record? Check **Sync Center** first, then the **Audit Log**",
    ],
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
    title: "Account & access",
    steps: [
      "Sign in from the login page with your email + password",
      "Forgot it? Click **Forgot Password** for a reset link",
      "Locked out? A school admin resets you in **Settings → Staff & Users**",
    ],
    facts: [
      "Sessions time out after **30 minutes** of inactivity (5-minute warning first)",
      "Super admins manage schools from the admin panel",
    ],
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
    title: "End-of-term workflow",
    where: "**Term End** (sidebar)",
    steps: [
      "Confirm all marks are **Approved/Published** (it can lock grades for you)",
      "Generate **report cards** and print/collect signatures",
      "**Promote** classes to the next grade",
      "Roll dates forward and set the new term's fee structure",
    ],
    facts: ["Use **Rollover** for the year-end move of all classes"],
  },
  {
    id: "reporting-other",
    keywords: ["custom report", "build a report", "board report", "inspection", "school inspection", "gss report"],
    pages: ["custom-reports", "inspection-report", "board-report", "reports"],
    title: "More reports",
    facts: [
      "**Reports** — single-student PDF report generator",
      "**Custom Reports** — pick columns, preview, export CSV",
      "**Board Report** — PDF summary for governors",
      "**Inspection Report** — MoE school inspection document",
      "**Batch Reports** — whole-class report cards in one print job",
    ],
  },
];

const HEURISTIC_CHECKS: { test: RegExp; answer: string }[] = [
  {
    test: /\b(add|create|new|register)\b/,
    answer:
      "➕ To **add** something, look for the **+ / Add** button at the top of the page — most pages open a form or modal.\n\nTell me *what* you want to add (student, class, payment, book…) and I'll give you the exact steps.",
  },
  {
    test: /\b(delete|remove|erase)\b/,
    answer:
      "🗑️ To **delete**, use the trash icon on the row/card (sometimes you must hover first).\n\nSome records are kept for audit instead of deleting — check the **Audit Log** if something won't go away.",
  },
  {
    test: /\b(edit|change|update|rename|correct)\b/,
    answer:
      "✏️ Open the record (click its row/card) and use the **edit/pencil** button, then **Save**.\n\nFor school-wide changes (name, logo, term dates) go to **Settings**.",
  },
];

export const OWLY_TOPICS = [
  "fees",
  "attendance",
  "grades",
  "import students",
  "bulk SMS",
  "timetable",
  "report cards",
  "offline sync",
  "setup",
];

/** Minimum keyword evidence needed before a topic answer is used. */
const MIN_KEYWORD_SCORE = 2;

function pickEntry(lower: string, tokens: string[], page?: string): OwlyEntry | null {
  let best: OwlyEntry | null = null;
  let bestScore = 0;
  let bestPage = 0;
  let bestIndex = Number.MAX_SAFE_INTEGER;

  KNOWLEDGE.forEach((entry, index) => {
    const kw = keywordScore(entry, lower, tokens);
    if (kw < MIN_KEYWORD_SCORE) return;
    const pg = pageScore(entry, page);
    // Topic match wins; the current page only breaks ties.
    if (kw > bestScore || (kw === bestScore && (pg > bestPage || (pg === bestPage && index < bestIndex)))) {
      best = entry;
      bestScore = kw;
      bestPage = pg;
      bestIndex = index;
    }
  });
  if (best) return best;

  // No topic matched — fall back to whatever page the user is on.
  let onPage: OwlyEntry | null = null;
  let onPageScore = 0;
  KNOWLEDGE.forEach((entry) => {
    const pg = pageScore(entry, page);
    if (pg > onPageScore) {
      onPage = entry;
      onPageScore = pg;
    }
  });
  return onPage;
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
  const entry = pickEntry(lower, tokens, ctx.page);
  if (entry) return renderEntry(entry);

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
  if (path.includes("grades") || path.includes("marks")) return ["How do I publish grades?", "How do I lock CA marks?"];
  if (path.includes("report")) return ["How do I print report cards?", "How do I add headmaster comments?"];
  if (path.includes("import")) return ["How do I fix a skipped row?", "Which columns are required?"];
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
  return ["How do I import students from CSV?", "How do I record a payment?", "What works offline?"];
}
