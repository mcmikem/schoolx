"use client";
import Link from "next/link";
import MaterialIcon from "@/components/MaterialIcon";

interface EmptyStateGuideAction {
  label: string;
  href: string;
}

interface EmptyStateGuideProps {
  title?: string;
  description?: string;
  action?: EmptyStateGuideAction;
  icon?: string;
  module?: keyof typeof MODULE_GUIDES;
}

const MODULE_GUIDES = {
  students: {
    title: "No students yet",
    description:
      "Add your first student manually or import them in bulk from an Excel or CSV file. You'll need their name, class, and admission number.",
    action: { label: "Import Students", href: "/dashboard/import" },
  },
  staff: {
    title: "No staff members",
    description: "Add teachers and staff to get started. You can add them one by one or import from a spreadsheet.",
    action: { label: "Add Staff", href: "/dashboard/staff" },
  },
  classes: {
    title: "No classes created",
    description: "Classes are the foundation of your school structure. Create classes like Primary 1, Senior 2, etc.",
    action: { label: "Create Classes", href: "/dashboard/classes" },
  },
  subjects: {
    title: "No subjects configured",
    description: "Add the subjects your school offers. Uganda-standard subjects are pre-loaded and ready to enable.",
    action: { label: "Manage Subjects", href: "/dashboard/subjects" },
  },
  fees: {
    title: "No fee structure",
    description:
      "Set up your fee structure to track payments. Define fee items, amounts, and which classes they apply to.",
    action: { label: "Setup Fees", href: "/dashboard/fees" },
  },
  attendance: {
    title: "No attendance records",
    description: "Start taking attendance for your classes. You can mark students as present, absent, or late.",
    action: { label: "Take Attendance", href: "/dashboard/attendance" },
  },
  grades: {
    title: "No grades entered",
    description: "Enter exam scores and continuous assessment marks for your students.",
    action: { label: "Enter Grades", href: "/dashboard/grades" },
  },
  timetable: {
    title: "No timetable created",
    description: "Create a class timetable to organize lessons, teachers, and periods.",
    action: { label: "Create Timetable", href: "/dashboard/timetable" },
  },
  library: {
    title: "Library is empty",
    description: "Add books to your library catalog. You can enter details manually or import a list.",
    action: { label: "Add Books", href: "/dashboard/library" },
  },
  transport: {
    title: "No transport routes",
    description: "Set up bus routes and assign students. Parents will be able to see route information.",
    action: { label: "Setup Transport", href: "/dashboard/transport" },
  },
  canteen: {
    title: "Canteen is empty",
    description: "Add items to your school canteen with prices. Students can order and pay using their wallets.",
    action: { label: "Add Items", href: "/dashboard/canteen" },
  },
  expenses: {
    title: "No expenses recorded",
    description: "Record school expenses to track spending. You can categorize them and attach receipts.",
    action: { label: "Record Expense", href: "/dashboard/budget" },
  },
  notices: {
    title: "No notices posted",
    description: "Post announcements and notices for parents and staff to see.",
    action: { label: "Create Notice", href: "/dashboard/notices" },
  },
  homework: {
    title: "No homework assigned",
    description: "Create homework assignments for your classes with instructions and due dates.",
    action: { label: "Assign Homework", href: "/dashboard/homework" },
  },
};

export default function EmptyStateGuide({ title, description, action, icon = "info", module }: EmptyStateGuideProps) {
  const guide = module ? MODULE_GUIDES[module] : undefined;
  const resolvedTitle = guide?.title ?? title ?? "No data";
  const resolvedDescription = guide?.description ?? description ?? "There is nothing here yet.";
  const resolvedAction = guide?.action ?? action;

  return (
    <div
      className="flex flex-col items-center justify-center py-20 px-8 text-center rounded-[var(--r2)] bg-motif-fade border border-dashed border-[var(--border)] transition-all animate-fade-in"
      role="status"
      aria-label={resolvedTitle}
    >
      <div className="relative mb-6">
        <div className="absolute -inset-4 bg-[var(--navy-soft)] rounded-full blur-2xl opacity-50 animate-pulse" />
        <div className="relative w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center border border-[var(--border)] group hover:scale-110 transition-transform">
          <MaterialIcon
            icon={icon}
            className="text-4xl text-[var(--navy)] group-hover:rotate-12 transition-transform"
          />
        </div>
      </div>
      <h3 className="text-xl font-heading text-[var(--t1)] mb-3 tracking-tight">{resolvedTitle}</h3>
      <p className="text-[13px] text-[var(--t3)] font-medium max-w-sm mb-6 leading-relaxed">{resolvedDescription}</p>
      {resolvedAction && (
        <Link href={resolvedAction.href} className="btn btn-primary shadow-lg shadow-navy/20 tap-effect">
          {resolvedAction.label}
        </Link>
      )}
      <a
        href="/contact"
        className="mt-6 text-xs text-[var(--t3)] hover:text-[var(--navy)] underline underline-offset-2 transition-colors"
      >
        Need help?
      </a>
    </div>
  );
}
