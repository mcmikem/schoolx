import { deepFreeze } from "./deep-freeze";
import type {
  ParentPortalAttendanceRecord,
  ParentPortalChild,
  ParentPortalFeeStructureItem,
  ParentPortalHomeworkAssignment,
  ParentPortalMessageThreadItem,
  ParentPortalNotice,
  ParentPortalPayment,
  ParentPortalGradeRecord,
  ParentPortalWalletTransaction,
} from "./parent-portal";

const TODAY = "2026-04-17";

const DEMO_CHILDREN: ParentPortalChild[] = [
  {
    id: "child-1",
    first_name: "Isaac",
    last_name: "Mugisha",
    class_id: "cls-1",
    class_name: "P.5 Blue",
    school_id: "demo-school",
    attendance: "94%",
    fees_balance: "120,000 UGX",
    next_exam: "Mid-Term Exams (April 22)",
  },
  {
    id: "child-2",
    first_name: "Asha",
    last_name: "Namugenyi",
    class_id: "cls-2",
    class_name: "P.3 Gold",
    school_id: "demo-school",
    attendance: "97%",
    fees_balance: "Clear",
    next_exam: "Reading Assessment (April 24)",
  },
];

const DEMO_NOTICES: ParentPortalNotice[] = [
  {
    id: "demo-notice-1",
    title: "Visitation Day",
    content: "Parents are invited this Saturday from 9:00 AM to 1:00 PM.",
    created_at: `${TODAY}T08:30:00.000Z`,
  },
  {
    id: "demo-notice-2",
    title: "Easter Break",
    content: "School will close on Friday and reopen on Tuesday morning.",
    created_at: "2026-04-12T10:00:00.000Z",
  },
];

const DEMO_ATTENDANCE: Record<string, ParentPortalAttendanceRecord[]> = {
  "child-1": Array.from({ length: 20 }, (_, index) => ({
    id: `child-1-att-${index + 1}`,
    date: new Date(Date.UTC(2026, 3, 17 - index)).toISOString().split("T")[0],
    status: ["present", "present", "late", "present", "absent"][index % 5] as
      | "present"
      | "late"
      | "absent",
    notes: index % 5 === 4 ? "Parent informed the school." : null,
  })),
  "child-2": Array.from({ length: 20 }, (_, index) => ({
    id: `child-2-att-${index + 1}`,
    date: new Date(Date.UTC(2026, 3, 17 - index)).toISOString().split("T")[0],
    status: ["present", "present", "present", "late", "present"][index % 5] as
      | "present"
      | "late",
    notes: null,
  })),
};

const DEMO_GRADES: Record<string, ParentPortalGradeRecord[]> = {
  "child-1": [
    {
      id: "child-1-grade-1",
      subject_name: "Mathematics",
      score: 82,
      max_score: 100,
      grade: "B2",
      term: "Term 1",
      exam_type: "End of Term",
      teacher_comment: "Shows steady confidence in problem solving.",
    },
    {
      id: "child-1-grade-2",
      subject_name: "English",
      score: 74,
      max_score: 100,
      grade: "C3",
      term: "Term 1",
      exam_type: "End of Term",
      teacher_comment: "Needs more reading practice at home.",
    },
    {
      id: "child-1-grade-3",
      subject_name: "Science",
      score: 91,
      max_score: 100,
      grade: "D1",
      term: "Term 1",
      exam_type: "End of Term",
    },
    {
      id: "child-1-grade-4",
      subject_name: "Mathematics",
      score: 88,
      max_score: 100,
      grade: "D1",
      term: "Term 2",
      exam_type: "Mid-Term",
      teacher_comment: "Excellent improvement this term.",
    },
    {
      id: "child-1-grade-5",
      subject_name: "English",
      score: 79,
      max_score: 100,
      grade: "B3",
      term: "Term 2",
      exam_type: "Mid-Term",
    },
  ],
  "child-2": [
    {
      id: "child-2-grade-1",
      subject_name: "Literacy",
      score: 90,
      max_score: 100,
      grade: "D1",
      term: "Term 1",
      exam_type: "End of Term",
      teacher_comment: "Very strong comprehension.",
    },
    {
      id: "child-2-grade-2",
      subject_name: "Numeracy",
      score: 84,
      max_score: 100,
      grade: "B2",
      term: "Term 1",
      exam_type: "End of Term",
    },
    {
      id: "child-2-grade-3",
      subject_name: "Environmental Studies",
      score: 87,
      max_score: 100,
      grade: "B1",
      term: "Term 1",
      exam_type: "End of Term",
    },
  ],
};

const DEMO_FEE_STRUCTURE: Record<string, ParentPortalFeeStructureItem[]> = {
  "child-1": [
    { id: "child-1-fee-1", name: "Tuition Fee", amount: 800000, term: "Term 1" },
    {
      id: "child-1-fee-2",
      name: "Development Levy",
      amount: 150000,
      term: "Term 1",
    },
    { id: "child-1-fee-3", name: "Lunch", amount: 250000, term: "Term 1" },
  ],
  "child-2": [
    { id: "child-2-fee-1", name: "Tuition Fee", amount: 500000, term: "Term 1" },
    { id: "child-2-fee-2", name: "Meals", amount: 180000, term: "Term 1" },
  ],
};

const DEMO_PAYMENTS: Record<string, ParentPortalPayment[]> = {
  "child-1": [
    {
      id: "child-1-payment-1",
      amount_paid: 800000,
      payment_date: "2026-01-15",
      payment_method: "Mobile Money",
      payment_reference: "RCP-001",
      fee_structure: { name: "Tuition Fee" },
    },
    {
      id: "child-1-payment-2",
      amount_paid: 150000,
      payment_date: "2026-01-20",
      payment_method: "Bank",
      payment_reference: "RCP-002",
      fee_structure: { name: "Development Levy" },
    },
  ],
  "child-2": [
    {
      id: "child-2-payment-1",
      amount_paid: 680000,
      payment_date: "2026-01-18",
      payment_method: "Cash",
      payment_reference: "RCP-101",
      fee_structure: { name: "Term 1 Fees" },
    },
  ],
};

const DEMO_WALLET_BALANCES: Record<string, number> = {
  "child-1": 8500,
  "child-2": 12500,
};

const DEMO_WALLET_TRANSACTIONS: Record<string, ParentPortalWalletTransaction[]> = {
  "child-1": [
    {
      id: "child-1-wallet-1",
      amount: 10000,
      type: "topup",
      reference: "PAR-1001",
      description: "Pocket money top-up",
      created_at: "2026-04-16T07:45:00.000Z",
    },
    {
      id: "child-1-wallet-2",
      amount: 1500,
      type: "spend",
      reference: "CAN-2201",
      description: "Canteen snack purchase",
      created_at: "2026-04-16T10:15:00.000Z",
    },
    {
      id: "child-1-wallet-3",
      amount: 5000,
      type: "topup",
      reference: "PAR-1000",
      description: "Pocket money top-up",
      created_at: "2026-04-10T08:20:00.000Z",
    },
  ],
  "child-2": [
    {
      id: "child-2-wallet-1",
      amount: 15000,
      type: "topup",
      reference: "PAR-2001",
      description: "Pocket money top-up",
      created_at: "2026-04-15T09:00:00.000Z",
    },
    {
      id: "child-2-wallet-2",
      amount: 2500,
      type: "spend",
      reference: "CAN-2202",
      description: "Lunch purchase",
      created_at: "2026-04-15T12:30:00.000Z",
    },
  ],
};

const DEMO_MESSAGES: ParentPortalMessageThreadItem[] = [
  {
    id: "msg-1",
    subject: "Fee Inquiry",
    body: "Hello, I would like to confirm the Term 2 fee timeline for Isaac.",
    sender_role: "parent",
    created_at: "2026-04-12T08:00:00.000Z",
    is_read: true,
  },
  {
    id: "msg-2",
    subject: "Re: Fee Inquiry",
    body: "Thank you. The full schedule is already available under Fees & Receipts.",
    sender_role: "school",
    created_at: "2026-04-12T11:15:00.000Z",
    is_read: true,
  },
  {
    id: "msg-3",
    subject: "Visitation Day Confirmation",
    body: "I will attend visitation day on Saturday and would like to meet the class teacher.",
    sender_role: "parent",
    created_at: "2026-04-16T07:00:00.000Z",
    is_read: false,
  },
];

const DEMO_HOMEWORK: Record<string, ParentPortalHomeworkAssignment[]> = {
  "child-1": [
    {
      id: "child-1-hw-1",
      title: "Multiplication Tables",
      description: "Complete exercises on pages 24-28 covering multiplication tables 6-10.",
      subject_name: "Mathematics",
      due_date: "2026-04-22",
      marks: 20,
      class_name: "P.5 Blue",
      academic_year: "2026",
      term: 1,
      created_at: "2026-04-15T08:00:00.000Z",
      submission: {
        status: "graded",
        submitted_at: "2026-04-20T14:30:00.000Z",
        marks: 18,
        feedback: "Excellent work — neat and all correct!",
      },
    },
    {
      id: "child-1-hw-2",
      title: "English Composition",
      description: "Write a 300-word composition titled 'My Best Day at School'.",
      subject_name: "English",
      due_date: "2026-04-25",
      marks: 15,
      class_name: "P.5 Blue",
      academic_year: "2026",
      term: 1,
      created_at: "2026-04-18T09:00:00.000Z",
      submission: {
        status: "submitted",
        submitted_at: "2026-04-23T10:00:00.000Z",
      },
    },
    {
      id: "child-1-hw-3",
      title: "Science Project: Plant Growth",
      description: "Observe a bean seed for 7 days and record daily observations in your notebook.",
      subject_name: "Science",
      due_date: "2026-05-01",
      marks: 25,
      class_name: "P.5 Blue",
      academic_year: "2026",
      term: 1,
      created_at: "2026-04-20T11:00:00.000Z",
      submission: null,
    },
  ],
  "child-2": [
    {
      id: "child-2-hw-1",
      title: "Reading Comprehension",
      description: "Read the story 'The Tortoise and the Hare' and answer questions 1-5.",
      subject_name: "Literacy",
      due_date: "2026-04-23",
      marks: 10,
      class_name: "P.3 Gold",
      academic_year: "2026",
      term: 1,
      created_at: "2026-04-16T08:00:00.000Z",
      submission: {
        status: "graded",
        submitted_at: "2026-04-22T09:15:00.000Z",
        marks: 9,
        feedback: "Great effort! Try reading aloud for fluency.",
      },
    },
    {
      id: "child-2-hw-2",
      title: "Counting Practice",
      description: "Count and write numbers 1-100. Write them in groups of 10.",
      subject_name: "Numeracy",
      due_date: "2026-04-28",
      marks: 10,
      class_name: "P.3 Gold",
      academic_year: "2026",
      term: 1,
      created_at: "2026-04-19T10:00:00.000Z",
      submission: {
        status: "submitted",
        submitted_at: "2026-04-26T11:30:00.000Z",
      },
    },
  ],
};

export const PARENT_PORTAL_DEMO = deepFreeze({
  children: DEMO_CHILDREN,
  notices: DEMO_NOTICES,
  attendance: DEMO_ATTENDANCE,
  grades: DEMO_GRADES,
  feeStructure: DEMO_FEE_STRUCTURE,
  payments: DEMO_PAYMENTS,
  walletBalances: DEMO_WALLET_BALANCES,
  walletTransactions: DEMO_WALLET_TRANSACTIONS,
  messages: DEMO_MESSAGES,
  homework: DEMO_HOMEWORK,
});

export function getDemoChildren() {
  return PARENT_PORTAL_DEMO.children.slice();
}

export function getDemoNotices() {
  return PARENT_PORTAL_DEMO.notices.slice();
}

export function getDemoAttendance(childId?: string | null) {
  return (PARENT_PORTAL_DEMO.attendance[childId || "child-1"] || []).slice();
}

export function getDemoGrades(childId?: string | null) {
  return (PARENT_PORTAL_DEMO.grades[childId || "child-1"] || []).slice();
}

export function getDemoFeeStructure(childId?: string | null) {
  return (PARENT_PORTAL_DEMO.feeStructure[childId || "child-1"] || []).slice();
}

export function getDemoPayments(childId?: string | null) {
  return (PARENT_PORTAL_DEMO.payments[childId || "child-1"] || []).slice();
}

export function getDemoWalletBalance(childId?: string | null) {
  return PARENT_PORTAL_DEMO.walletBalances[childId || "child-1"] ?? 0;
}

export function getDemoWalletTransactions(childId?: string | null) {
  return (
    PARENT_PORTAL_DEMO.walletTransactions[childId || "child-1"] || []
  ).slice();
}

export function getDemoMessages() {
  return PARENT_PORTAL_DEMO.messages.slice();
}

export function getDemoHomework(childId?: string | null) {
  return (PARENT_PORTAL_DEMO.homework[childId || "child-1"] || []).slice();
}
