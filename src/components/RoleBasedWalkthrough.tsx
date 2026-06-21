"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import MaterialIcon from "@/components/MaterialIcon";
import OwlMascot from "@/components/brand/OwlMascot";

interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  detail: string;
  icon: string;
  href: string;
}

const HEADMASTER_STEPS: WalkthroughStep[] = [
  {
    id: "welcome",
    title: "Welcome to SkoolMate",
    description: "Your all-in-one school management dashboard",
    detail: "This is your command centre. From here you can manage students, staff, fees, attendance, grades, and parent communication — all in one place.",
    icon: "celebration",
    href: "/dashboard",
  },
  {
    id: "setup",
    title: "Complete School Setup",
    description: "Configure your school profile and academic structure",
    detail: "Set up your school name, term dates, class structure, and curriculum subjects. This is the foundation everything else builds on.",
    icon: "settings_applications",
    href: "/dashboard/setup",
  },
  {
    id: "staff",
    title: "Add Staff Members",
    description: "Build your team — teachers, admins, bursars",
    detail: "Add staff accounts with role-based permissions. Teachers get access to attendance and grades, bursars handle fees, admins oversee operations.",
    icon: "badge",
    href: "/dashboard/staff",
  },
  {
    id: "students",
    title: "Register Students",
    description: "Add learners individually or bulk-import",
    detail: "Register students with parent contact details. Use the CSV import for large batches — the system assigns admission numbers automatically.",
    icon: "group_add",
    href: "/dashboard/students",
  },
  {
    id: "fees",
    title: "Set Up Fee Structure",
    description: "Define fee items, amounts, and payment terms",
    detail: "Create fee items (tuition, meals, transport, etc.), set amounts per class and term. The system tracks balances and sends reminders automatically.",
    icon: "payments",
    href: "/dashboard/fees",
  },
  {
    id: "grades",
    title: "Configure Grading",
    description: "Set up grading rules and report card templates",
    detail: "Define grade boundaries (A–E), passing marks, and report card layouts. Supports UNEB-compliant grading for Ugandan schools.",
    icon: "grade",
    href: "/dashboard/grades",
  },
  {
    id: "attendance",
    title: "Take Daily Attendance",
    description: "Mark who is present, away, or late",
    detail: "Select a class and date, then tap to cycle through statuses. Use Roll Call mode for quick entry — parents of absentees get automatic SMS alerts.",
    icon: "how_to_reg",
    href: "/dashboard/attendance",
  },
  {
    id: "reports",
    title: "Generate Reports",
    description: "Report cards, analytics, and government submissions",
    detail: "Generate termly report cards, view class performance analytics, and prepare UNEB/MoES submissions — all pre-formatted and printable.",
    icon: "assessment",
    href: "/dashboard/reports",
  },
  {
    id: "sms",
    title: "Communicate with Parents",
    description: "Send SMS alerts, notices, and fee reminders",
    detail: "Use bulk SMS for fee reminders and school notices. Automated triggers can notify parents on absenteeism, payment due dates, and report card releases.",
    icon: "sms",
    href: "/dashboard/messages",
  },
];

const TEACHER_STEPS: WalkthroughStep[] = [
  {
    id: "welcome",
    title: "Welcome, Teacher!",
    description: "Your classroom command centre",
    detail: "This is where you manage your daily classroom tasks — attendance, grades, homework, timetable, and student communication. Everything you need is a click away.",
    icon: "celebration",
    href: "/dashboard",
  },
  {
    id: "attendance",
    title: "Take Daily Attendance",
    description: "Mark students present, away, or late in seconds",
    detail: "Go to Attendance, pick your class, and tap each student to mark them. Use Roll Call mode to quickly mark everyone present first, then just tap absentees.",
    icon: "how_to_reg",
    href: "/dashboard/attendance",
  },
  {
    id: "grades",
    title: "Enter Student Marks",
    description: "Record assessments and track progress",
    detail: "Navigate to Grades, select your class and assessment type, then enter marks per subject. The system calculates totals, averages, and grade positions automatically.",
    icon: "grade",
    href: "/dashboard/grades",
  },
  {
    id: "homework",
    title: "Post Homework",
    description: "Assign and track homework submissions",
    detail: "Create homework assignments with instructions and due dates. Students and parents can view them through the parent portal.",
    icon: "assignment",
    href: "/dashboard/homework",
  },
  {
    id: "timetable",
    title: "Check Your Timetable",
    description: "View your daily and weekly class schedule",
    detail: "See your full timetable at a glance — which classes, subjects, and periods you have each day. Print or share with colleagues.",
    icon: "calendar_month",
    href: "/dashboard/timetable",
  },
  {
    id: "students",
    title: "View Student Profiles",
    description: "Access student info, history, and contacts",
    detail: "Each student has a complete profile — personal details, parent contacts, attendance history, grades, fee status, and disciplinary records.",
    icon: "group",
    href: "/dashboard/students",
  },
  {
    id: "communicate",
    title: "Send Parent Updates",
    description: "Share progress and important notices",
    detail: "Use SMS to alert parents about attendance issues, upcoming exams, or school events. You can message individual parents or whole classes at once.",
    icon: "sms",
    href: "/dashboard/messages",
  },
];

function getStepsForRole(role: string | undefined): WalkthroughStep[] {
  if (role === "headmaster" || role === "admin" || role === "super_admin") {
    return HEADMASTER_STEPS;
  }
  return TEACHER_STEPS;
}

function isRoleBased(role: string | undefined): boolean {
  return role === "headmaster" || role === "admin" || role === "super_admin" || role === "teacher";
}

function getStorageKey(userId: string): string {
  return `skm_walkthrough_${userId}`;
}

function getCompleted(userId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCompleted(userId: string, completed: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(completed));
  } catch {}
}

export default function RoleBasedWalkthrough() {
  const { user, school, isDemo } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);

  const role = user?.role;
  const steps = getStepsForRole(role);
  const userId = user?.id || "anon";
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? Math.round((completed.length / totalSteps) * 100) : 0;

  useEffect(() => {
    if (!userId) return;
    const saved = getCompleted(userId);
    setCompleted(saved);
  }, [userId]);

  useEffect(() => {
    if (!user?.id || !school || isDemo || !role || !isRoleBased(role)) return;
    const saved = getCompleted(user.id);
    if (saved.length >= totalSteps) return;
    const delay = setTimeout(() => setIsActive(true), 800);
    return () => clearTimeout(delay);
  }, [user?.id, school, isDemo, role, totalSteps]);

  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep, totalSteps]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const handleMarkDone = useCallback(() => {
    if (!userId) return;
    const step = steps[currentStep];
    if (!step) return;
    const updated = completed.includes(step.id) ? completed : [...completed, step.id];
    setCompleted(updated);
    saveCompleted(userId, updated);
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      setIsActive(false);
    }
  }, [currentStep, steps, completed, userId, totalSteps]);

  const handleSkip = useCallback(() => {
    setIsActive(false);
    setDismissed(true);
    if (userId) {
      saveCompleted(userId, Array.from({ length: totalSteps }, (_, i) => steps[i]?.id || `step_${i}`));
    }
  }, [userId, totalSteps, steps]);

  const handleNavigate = useCallback(() => {
    const step = steps[currentStep];
    if (step?.href) {
      router.push(step.href);
    }
  }, [currentStep, steps, router]);

  const handleDismiss = useCallback(() => {
    setIsActive(false);
    setDismissed(true);
  }, []);

  if (!isActive || dismissed) return null;

  const step = steps[currentStep];
  if (!step) return null;

  const isLastStep = currentStep === totalSteps - 1;
  const isDone = completed.includes(step.id);

  return (
    <div className="fixed inset-0 z-[999] flex items-start justify-center pt-12 sm:pt-24 px-4">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
        onClick={handleDismiss}
      />

      <div className="relative w-full max-w-[520px] bg-white rounded-[28px] shadow-[0_32px_80px_rgba(0,0,0,0.2)] border border-[var(--border)] overflow-hidden animate-fade-in">
        <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--border)]">
          <div
            className="h-full bg-[var(--primary)] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="absolute top-3 right-3 flex items-center gap-1">
          <span className="text-[11px] font-semibold text-[var(--t4)] tracking-wide">
            {completed.length}/{totalSteps}
          </span>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-container-low)] text-[var(--t4)] hover:text-[var(--t1)] transition-colors"
            aria-label="Close walkthrough"
          >
            <MaterialIcon icon="close" className="text-lg" />
          </button>
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4 mb-5">
            <div className="flex-shrink-0">
              <div className="w-14 h-14 rounded-[18px] bg-[linear-gradient(135deg,var(--primary)_0%,var(--primary-700)_100%)] flex items-center justify-center shadow-lg">
                <MaterialIcon icon={step.icon} className="text-2xl text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h2 className="text-lg font-extrabold text-[var(--t1)] tracking-tight leading-snug">
                {step.title}
              </h2>
              <p className="text-sm font-medium text-[var(--primary)] mt-0.5">
                {step.description}
              </p>
            </div>
          </div>

          <div className="bg-[var(--surface-container-low)] rounded-2xl p-4 mb-6 border border-[var(--border)]">
            <p className="text-sm text-[var(--t2)] leading-relaxed">
              {step.detail}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={handleNavigate}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white text-[13px] font-bold hover:bg-[var(--primary-600)] active:scale-[0.98] transition-all shadow-[var(--sh1)]"
            >
              <MaterialIcon icon="open_in_new" className="text-base" />
              Show me this
            </button>

            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handlePrevious}
                  className="px-3 py-2 rounded-xl text-[var(--t3)] text-[13px] font-semibold hover:bg-[var(--surface-container-low)] active:scale-[0.98] transition-all"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleMarkDone}
                className={`px-4 py-2.5 rounded-xl text-[13px] font-bold active:scale-[0.98] transition-all ${
                  isDone
                    ? "bg-[var(--green-soft)] text-[var(--green)]"
                    : isLastStep
                      ? "bg-[var(--green)] text-white hover:bg-[var(--green)] shadow-[var(--sh1)]"
                      : "bg-[var(--primary)] text-white hover:bg-[var(--primary-600)] shadow-[var(--sh1)]"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <MaterialIcon icon={isDone ? "check_circle" : isLastStep ? "check_circle" : "arrow_forward"} className="text-base" />
                  {isDone ? "Done" : isLastStep ? "Finish" : "Next"}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-4">
          <div className="flex items-center gap-1.5">
            {steps.map((s, i) => {
              const isCurrent = i === currentStep;
              const isComp = completed.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => setCurrentStep(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    isCurrent
                      ? "bg-[var(--primary)] w-6"
                      : isComp
                        ? "bg-[var(--green)] w-2"
                        : "bg-[var(--border)] w-2 hover:bg-[var(--border2)]"
                  }`}
                  aria-label={`Go to step ${i + 1}: ${s.title}`}
                />
              );
            })}
          </div>
        </div>

        <div className="border-t border-[var(--border)] px-6 sm:px-8 py-3 bg-[var(--surface-container-low)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <OwlMascot size={28} premium />
            <span className="text-[11px] text-[var(--t3)] font-medium">
              {role === "headmaster" || role === "admin" || role === "super_admin"
                ? "Headmaster guide"
                : "Teacher guide"}
            </span>
          </div>
          <button
            onClick={handleSkip}
            className="text-[11px] font-semibold text-[var(--t4)] hover:text-[var(--t1)] transition-colors"
          >
            Skip all
          </button>
        </div>
      </div>
    </div>
  );
}
