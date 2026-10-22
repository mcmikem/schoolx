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
      "Hello! 👋 I'm **Owly**, your SkoolMate guide.\n\nAsk me about fees, attendance, marks, reports, SMS, setup or offline sync. I will show you where to tap. I also work without internet.",
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
      "I can help with most of SkoolMate:\n\n• **Money** — fees, invoices, payment plans, cashbook, budget, payroll\n• **Teaching** — attendance, marks, exams, syllabus, lesson plans, timetable\n• **People** — pupils, staff, ID cards, transfers, promotion\n• **Messages** — SMS, notices, templates, automation\n• **Admin** — setup, roles, billing, reports, offline sync\n\nType your question in your own words.",
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
      "**SkoolMate OS** is a school management system for Ugandan schools.\n\nIt helps you manage pupils, staff and attendance. It also handles marks, report cards, fees, timetables and SMS to parents. You can use it for the library, health, boarding, payroll and budgets too.\n\nIt also works without internet and uploads your work when you get signal.",
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
    where: "**Left sidebar** — grouped by job. Use **Find page…** at the top of the sidebar to filter it.",
    facts: [
      "**Today:** Dashboard, Attendance, Fees, Messages.",
      "**Daily Work:** Students, Staff, Grades & Reports, Timetable, Calendar, Analytics.",
      "**Teaching & Exams:** Exams, Assignments, Syllabus, Terms, Subjects, SMS Centre.",
      "**Reports & Readiness:** ID Cards, Financial Reports, Teacher Performance, Audit Log.",
      "**School Office:** Budget, Payroll, Health, Transport, Library, Boarding.",
      "**Other Tools:** Inventory, Settings, Role Permissions, Offline Sync.",
      "Cannot see a page? Your role or plan may not include it. Ask the head teacher to check **Role Permissions**.",
    ],
    tip: "Press Ctrl+K or ⌘K to search pages, pupils and actions from anywhere.",
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
      "**Ctrl+K / ⌘K** — search pages, pupils and actions. Use the arrow keys and Enter.",
      "**Ctrl+N** — make a new record, like a fee payment or a new pupil.",
      "**Ctrl+F** — jump to the search box on the page.",
      "**Esc** — close any window, menu or the sidebar.",
      "**F2** — quick cash sale in the Canteen.",
      "**Ctrl+P** — print report cards, receipts or ID cards.",
    ],
    facts: [
      "The sidebar has a **Find page…** box. It also remembers your last pages under *Continue where you left off*.",
      "In this chat, press **Enter** to send. Press **Shift+Enter** for a new line.",
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
      "**School and subjects:** write your school name, phone, district and school type. Add your logo if you have one.",
      "**Calendar and fees:** enter the term dates and what each class pays.",
      "**Grading and reports:** choose how your school grades pupils and what the report card looks like.",
      "**Boarding and features:** turn on boarding if you have it. Turn on only the parts your school uses.",
      "**Launch:** tap **Finish Setup & Launch**.",
      "Then add pupils, add staff, take attendance and record your first payment.",
    ],
    facts: [
      "It takes about 5 to 10 minutes. Your work is saved, so you can stop and come back.",
      "You can also open the checklist later in **Settings → Setup Checklist**.",
      'In a hurry? Tap "Skip for now — finish in dashboard".',
    ],
    tip: "Stuck? Tap the WhatsApp button in this chat. A real person can guide you.",
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
    title: "Import pupils from a spreadsheet",
    where: "**Students → Import CSV**, or the Import page at `/dashboard/import`",
    steps: [
      "Download the template if you do not have a list. You can use Excel, Word or a CSV file.",
      "Choose how to add the pupils: **Upload a file**, **Paste a list**, or **Google Sheets**.",
      "Check the **Review your students** table. Each row says **Ready** or needs fixing.",
      "Tap **Confirm & Import** and read the results.",
    ],
    facts: [
      "Each pupil needs a first name, last name and gender. Rows without these are skipped.",
      "The class must already exist. If it does not, the app says the class was not found.",
      "A parent phone number must be a real Ugandan number, like 0771234567.",
      "The app gives each pupil a student number, like STU00001.",
      "If the list is very big, import about 10 pupils at a time.",
    ],
    tip: "Add photos later from **Students → Photos**.",
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
    where: "**Fees** (sidebar) — tabs: Student Balances · Payment Plans · Invoices · Daily Money Log · Payment Claims",
    steps: [
      "Tap **Add Payment**. You can also press **Ctrl+N**.",
      "**Pupil:** choose the pupil. Type the **Amount (UGX)**. You can tap Full, Half, 50k or 100k.",
      "**How paid:** choose Cash, Mobile Money, Bank Transfer, Installment or In Kind.",
      "For mobile money, choose MTN or Airtel. Type the **Transaction ID** from the parent's phone. This is required.",
      "Tap **Pay UGX …**. A receipt opens. Tap **Print Receipt** to print or share it.",
    ],
    facts: [
      "To set the term's charges, use **Set New Fees**. Add the name, class, amount, term and due date.",
      "To let a parent pay in parts, open **Payment Plans** and tap **Create Payment Plan**.",
      "For a scholarship or discount, use **Scholarship/Discount**, then **Record Fee Adjustment**.",
      "If the parent pays more than the balance, tick **Record excess as credit**.",
      "The payment date is added for you. There is no date picker.",
    ],
    tip: "This works offline. The payment waits on the phone and uploads when you have signal.",
  },
  {
    id: "mobile-money",
    keywords: ["momo", "mtn", "airtel", "mobile money", "ush", "pay by phone", "cash", "bank transfer"],
    title: "How parents can pay",
    steps: [
      "**Cash:** record it in **Add Payment**, then tap **Print Receipt**.",
      "**MTN MoMo or Airtel Money:** choose Mobile Money and type the **Transaction ID** from the parent's phone.",
      "**Bank transfer:** choose Bank Transfer and type the reference number.",
    ],
    facts: [
      "Set your school's MoMo and Airtel numbers in **Settings → Messaging & Payments**.",
      "When a parent pays your number, record it when the message arrives.",
    ],
    tip: "Always keep the Transaction ID. It is your proof if the payment is questioned later.",
  },
  {
    id: "payment-plans",
    keywords: ["installment", "instalment", "payment plan", "pay in bits", "part payment", "structure"],
    title: "Let parents pay in parts",
    where: "**Fees → Payment Plans**",
    steps: [
      "Open **Payment Plans**. Tap **Create Payment Plan**.",
      "Choose the pupil and the number of parts (2, 3, 4...).",
      "Tap **Create Plan**. The plan appears next to the pupil's balance.",
      "Record each part like a normal payment. The plan shows what is left.",
    ],
    facts: [
      "For a whole-school plan, like 40% / 30% / 30%, use **Fee Terms**.",
      "To remind parents on a plan, go to **Messages → Bulk SMS → Outstanding Fees**.",
    ],
  },
  {
    id: "cashbook",
    keywords: ["cashbook", "daily money log", "money log", "cash log", "income"],
    title: "Daily Money Log (cashbook)",
    where: "**Fees → Daily Money Log**",
    facts: [
      "It shows every payment received each day, with how it was paid and the receipt number.",
      "Use **Budget → Log Expense** to keep a full record of money in and money out.",
      "Export it from **Export Data** or the CSV button on the page.",
      "Bursars see a cashbook shortcut on their dashboard.",
    ],
  },
  {
    id: "budget",
    keywords: ["budget", "expense", "expenditure", "spending", "approve", "approval", "funds"],
    pages: ["budget", "expense-approvals"],
    title: "Budget and expenses",
    where: "**Budget** (sidebar → School Office)",
    steps: [
      "Tap **Log Expense** and choose a category, like Staff, Maintenance, Supplies or Activities.",
      "A big expense goes to **Expense Approvals** for the head teacher.",
      "The head teacher says yes or no there. It also appears in *Needs Attention* on the dashboard.",
      "Reports compare what you spent with the fees you collected for the term.",
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
      "Choose the class and the date. Today is already chosen.",
      "Mark each pupil: **Present**, **Absent**, **Late** or **Excused**. Tap a pupil to mark Present, tap again for Absent. Swipe left for Present, right for Absent. Use the row buttons for Late or Excused.",
      "Marked pupils move out of the way. Tap **Show marked** to see them again.",
      "Tap **Save**. Any pupil you did not mark is saved as Present.",
      "For many days at once, open the **⋯ menu**, then **Bulk date-range marking**.",
    ],
    facts: [
      "**Quick Mark Absent:** choose the absent pupils. Everyone else is saved as Present.",
      "**Copy Yesterday** fills the register from the day before.",
      "**Absentee SMS Alerts** in the **⋯ menu** texts parents when a pupil is absent.",
      "**Export** downloads the register as a CSV file.",
      "Without internet, the register waits on the phone and uploads later.",
    ],
    tip: "Staff and boarders have their own registers: **Staff Attendance** and **Dorm Attendance**.",
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
    title: "Enter and publish marks",
    where: "**Grades** (sidebar → Daily Work) — *Grades & Marks*",
    steps: [
      "Choose the class. Then choose the subject.",
      "Type each pupil's mark in the boxes. The boxes may be BOT, MOT and EOT, or class work (CA) and exam.",
      "Marks save by themselves after a moment. Tap **Save Grades** to save all at once.",
      "When the marks are ready, send them to the person who checks them: **Submit to Dean** or **Submit to HM**.",
      "That person taps **Approve Grades**. Then the head teacher taps **Publish Grades**.",
    ],
    facts: [
      "The status shows where the marks are: Still Writing, Sent to Boss, Boss Approved, Ready for Parents.",
      "**Quick Fill**, **Copy Prev Term** and **Import** help you enter many marks faster.",
      "**Marks Completion** shows which classes still need marks.",
      "When the marks are final, tap **Close for Edits (Lock)**.",
    ],
    tip: "After marks are approved, do not tap **Save Grades** again. That can send them back to draft. Use the workflow buttons.",
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
    where: "**Report Cards** — after the marks are published",
    steps: [
      "Open **Report Cards**. The subjects, marks and comments fill in by themselves.",
      "Write the head teacher's comment for each pupil. Heads of department can add subject remarks.",
      "Print one pupil, or open **Batch Reports** to print a whole class at once.",
      "Need comment ideas? Open **Comments**. It writes remarks from the marks for you.",
    ],
    facts: [
      "The report follows the Uganda layout: class teacher comment, head of department remark, and head teacher signature.",
      "You can print without internet. The job waits and uploads later.",
      "Set up signatures in **Settings → Signatures**. This is optional.",
    ],
  },
  {
    id: "exams",
    keywords: ["exam", "exams", "ca1", "ca2", "ca3", "mid term", "mid-term", "eot", "end of term", "test", "paper"],
    pages: ["exams"],
    title: "Exams and tests",
    where: "**Exams** (sidebar → Teaching & Exams)",
    facts: [
      "Exam types: **CA** (class work), **Mid Term** and **End of Term**, plus Saturday and BOT tests.",
      "**Exam Timetable** plans which paper is written by which class and subject.",
      "Enter the marks for each exam. Then publish them to open the report cards.",
      "See results with **UNEB Analysis** (divisions) and **Analytics**.",
    ],
  },
  {
    id: "uneb",
    keywords: ["uneb", "ple", "uce", "uace", "candidate", "index number", "division"],
    pages: ["uneb", "uneb-registration"],
    title: "UNEB registration and analysis",
    where: "**UNEB Registration** / **UNEB** in the sidebar",
    steps: [
      "Register candidates by class: PLE (P7), UCE (S4) and UACE (S6).",
      "Give each candidate an **index number**.",
      "Export the list in the UNEB format.",
      "Check the divisions in **UNEB Analysis**.",
    ],
    facts: [
      "Each candidate needs their National ID or birth certificate (NIRA) number on file.",
      "Registration also links to the NCDC syllabus tracker for exam preparation.",
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
    title: "MoES and government reports",
    where: "**MoES** and **MoES Reports** in the sidebar",
    facts: [
      "**MoES:** headcount return with enrolment by gender, class and age.",
      "**MoES Reports:** EMIS exports as Excel or JSON files.",
      "Reports on teacher qualifications and where teachers are posted.",
      "Put your EMIS code in **Settings → School Profile**.",
    ],
    tip: "You can export the termly return straight from SkoolMate. You do not need to type it into the ministry forms again.",
  },
  {
    id: "analytics",
    keywords: ["analytics", "insights", "stats", "statistics", "trends", "dashboard", "data quality"],
    pages: ["analytics", "trends", "class-comparison", "data-quality"],
    title: "Analytics and data quality",
    where: "**Analytics** (sidebar → Daily Work)",
    facts: [
      "Charts for enrolment, performance, fees and attendance over time.",
      "**Trends** compares terms. **Class Comparison** ranks classes.",
      "**Data Quality** finds missing or duplicate records before you report.",
      "**Board Report** makes a PDF for the school governors.",
    ],
  },
  {
    id: "early-warnings",
    keywords: ["warning", "warnings", "at risk", "risk", "dropout", "failing", "concern", "flag student"],
    pages: ["warnings", "dropout-tracking"],
    title: "Early warnings and dropouts",
    where: "**Warnings** and **Dropout Tracking**",
    facts: [
      "The app marks pupils with many absences, falling marks, or unpaid fees.",
      "**Dropout Tracking** lists pupils who keep missing school.",
      "Use **Automation** to text parents when a pupil is marked.",
      "Open a pupil's profile to see the full picture.",
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
      "Make a plan for the class, subject and week you are teaching.",
      "Use the syllabus topic you are covering.",
      "Print or export it. Inspectors ask for these.",
    ],
    facts: ["Related: **Scheme of Work** (weekly overview) and **Homework** (assignments)."],
  },
  {
    id: "homework",
    keywords: ["homework", "assignment", "assignments", "classwork", "submit", "submission"],
    pages: ["homework", "homework-submissions"],
    title: "Homework and assignments",
    where: "**Homework** (sidebar → Teaching & Exams)",
    steps: [
      "Give work to a class and choose the date it is due.",
      "**Homework Submissions** shows who handed it in and who did not.",
      "Tell the head office if a parent needs reminding -- notices and parent SMS are sent by the office, not by teachers.",
    ],
    facts: ["Homework still waiting on you is listed under Homework Submissions."],
  },
  {
    id: "timetable",
    keywords: ["timetable", "schedule", "period", "lesson", "slot", "free period", "double period"],
    pages: ["timetable", "allocations", "substitutions", "workload"],
    title: "Build the timetable",
    where: "**Timetable** (sidebar → Daily Work)",
    steps: [
      "Choose a class. Tap an empty slot.",
      "Choose the **teacher and subject** for that slot.",
      "If the teacher is already busy, the app shows a warning.",
      "To remove a slot, point at it and tap the trash icon.",
    ],
    facts: [
      "The **Term Calendar** tab shows holidays, mid-terms and EOT dates.",
      "**Substitutions** covers a teacher who is away. **Workload** shows how many lessons each teacher has.",
      "Set the school period times in **Settings → Timetable Slots**.",
    ],
  },
  {
    id: "calendar",
    keywords: ["calendar", "event", "events", "holiday", "term dates", "school calendar", "activities"],
    pages: ["calendar", "academic-terms"],
    title: "School calendar",
    where: "**Calendar** (sidebar → Daily Work)",
    facts: [
      "See events, holidays and activities by month, week or day.",
      "Add term dates, sports days and parents' meetings.",
      "**Academic Terms** sets the term names and dates. Fees, marks and reports use these.",
      "You can show an event to parents through **Notices**.",
    ],
  },
  {
    id: "subjects",
    keywords: ["subject", "subjects", "course", "courses", "class", "classes", "stream", "streaming"],
    pages: ["subjects", "classes", "courses"],
    title: "Classes and subjects",
    where: "**Classes** and **Subjects** (also step 1 of the Setup Wizard)",
    facts: [
      "**Classes:** make each class or stream and choose a class teacher.",
      "**Subjects:** list the subjects your school teaches and the classes that use each one.",
      "**Courses:** course choices for senior secondary.",
      'Set these up before you enter marks. If a class is missing, the import stops with `Class "X" not found`.',
    ],
  },

  // ── People ────────────────────────────────────────────────────────────────
  {
    id: "students",
    keywords: ["student", "students", "learner", "enrol", "enroll", "admission", "pupil", "registry"],
    pages: ["students", "student-enrollments", "student-lookup"],
    title: "Pupil records",
    where: "**Students** (sidebar → Daily Work)",
    facts: [
      "The tabs are **Registry**, **Transfers**, **Dropouts** and **Promotion**.",
      "Add one pupil with **+ Add**. For many pupils, import a list.",
      "Each pupil gets a student number. It is used on ID cards and receipts.",
      "Tap a pupil to see attendance, marks, fees, behaviour and health.",
      "To add photos, open **Students → Photos** and upload by student number.",
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
    title: "Staff list",
    where: "**Staff** (sidebar → Daily Work)",
    facts: [
      "The **Staff Directory** shows each person's role, subjects and classes.",
      "Add staff from the Staff page, or from **Settings → Staff & Users**.",
      "**Staff Activity** shows what people have done. **Staff Performance** shows their results.",
      "To invite a colleague, use **Invite staff** at the bottom of the sidebar.",
    ],
  },
  {
    id: "leave",
    keywords: ["leave", "vacation", "sick leave", "annual leave", "approve leave"],
    pages: ["leave", "leave-approvals"],
    title: "Staff leave",
    where: "**Leave** to apply · **Leave Approvals** to approve",
    steps: [
      "Staff ask for leave. They choose the dates and give a reason.",
      "The head teacher says yes or no in **Leave Approvals**.",
      "Approved leave shows on the timetable. Use **Substitutions** to cover the lessons.",
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
    title: "Send SMS to parents",
    where: "**Messages → Bulk SMS** (Communication Hub) — or **SMS Centre** in the sidebar",
    steps: [
      "Choose who gets the message: **All Parents**, **By Class**, **Outstanding Fees**, or **Custom Selection**.",
      "Choose a **Template** if you have one, or type your own message.",
      "Check the **Summary**: how many parents, how many messages, and the estimated cost in UGX.",
      "Tap **Send Bulk SMS**, then **Confirm & Send**.",
    ],
    facts: [
      "The tabs are **Messages**, **Bulk SMS**, **Automation**, **Templates** and **Notices**.",
      "A message to one parent can go by **Auto**, **WhatsApp** or **SMS**.",
      "Messages in the hub can be up to 640 characters.",
      "You can use names and numbers in the message, like `{student_name}`, `{date}`, `{amount}` and `{school_name}`.",
      "SMS needs a Starter plan or higher. MTN and Airtel Uganda are supported.",
    ],
    tip: "The fastest fee reminder is **SMS Centre → Parents with Overdue Fees**. It uses the real balance.",
  },
  {
    id: "automation",
    keywords: ["automation", "automatic", "trigger", "reminder", "auto", "workflow", "scheduled"],
    pages: ["auto-sms", "automation", "workflows"],
    title: "Automation & auto-reminders",
    where: "**Auto SMS Triggers** · **Workflows** · **Messages → Automation**",
    facts: [
      "Auto SMS Triggers (one-tap switches): **fee overdue (7/14/30 days)**, **absentee alert**, **payment confirmation**, **report card ready**",
      "**Workflows** are rules. You pick a trigger, like a pupil absent or a payment received. Then you pick an action, like sending an SMS or telling the bursar.",
      "Every run is logged in **Automation Logs** (`/dashboard/automation/logs`)",
    ],
    tip: "Start with the two switches every school needs: fee overdue + absentee alert.",
  },
  {
    id: "notices",
    keywords: ["notice", "notices", "announcement", "post announcement", "bulletin", "circular"],
    pages: ["notices", "suggestions"],
    title: "Post a notice",
    where: "**Notices** (sidebar) or **Messages → Notices**",
    steps: [
      "Write the notice. Choose who can see it: everyone, or one class.",
      "Tap **Publish**. It appears in the parent and pupil portals.",
      "If some parents cannot use the portal, send them an SMS from **Messages**.",
    ],
    facts: ["The **Suggestion Box** lets staff and pupils send feedback without their name."],
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
    title: "Work without internet",
    where: "**Sync Center** (sidebar → Other Tools) — the status dot is at the bottom of the sidebar",
    facts: [
      "These keep working without internet: attendance, marks, fee payments, pupils, messages and the timetable.",
      "Your work waits on the phone. When the internet comes back, it uploads by itself.",
      "If two people change the same record, the newer server record wins. Your change is kept on the phone for review.",
      "You can print report cards offline.",
      "Tap **Sync Now** in Sync Center to try again. The **Offline queue** shows what is waiting.",
    ],
    tip: "If something is stuck, open Sync Center. The app tries three times, then shows the problem.",
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
      "Tabs: **School Details**, **School Config**, **Staff & Users**, **Notifications**, **Messaging & Payments**, **Setup Checklist**, **Backup & Export**, **Billing & Plans**.",
      "Change the school name, logo, EMIS code, district and colours under **School Details**.",
      "Term dates, classes and grading are in the **Setup Wizard**.",
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
    title: "Backup and recovery",
    where: "**Settings → Backup & Export**",
    steps: [
      "Open **Backup & Export** and tap **Export All Data** to download a full copy.",
      "For one table, use **Export Data** (Excel) or the CSV button on that page.",
      "Lost a record? Check **Sync Center** first. Then check the **Audit Log**.",
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
    title: "Sign in and passwords",
    steps: [
      "Sign in with your email and password.",
      "Forgot your password? Tap **Forgot Password**. We send you a reset link.",
      "Still locked out? Ask your school admin to reset you in **Settings → Staff & Users**.",
    ],
    facts: [
      "The app signs you out after 30 minutes with no activity. It warns you 5 minutes before.",
      "Super admins manage schools from the admin panel.",
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
      "🆘 **Need help?**\n\n• Ask me. I can explain any part of the app, online or offline.\n• Tap the green **WhatsApp** button in this chat to reach a real person.\n• If you have no data, send an **SMS**.\n• We usually reply within a few hours on school days.\n\nTell us the page you are on and what you were trying to do.",
  },
  {
    id: "term-end",
    keywords: ["end of term", "term end", "close term", "new term", "lock grades", "finalise", "finalize"],
    pages: ["term-end", "rollover"],
    title: "End of term",
    where: "**Term End** (sidebar)",
    steps: [
      "Check that all marks are **Approved** or **Published**. The app can lock them for you.",
      "Generate the **report cards**. Print them and collect signatures.",
      "**Promote** each class to the next class.",
      "Move the dates forward and set the fees for the new term.",
    ],
    facts: ["Use **Rollover** at the end of the year to move all classes at once."],
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
  if (path.includes("report")) return ["How do I print report cards?", "How do I add head teacher comments?"];
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
