"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import type { FeeOption } from "@/components/fees/FeePicker";
import { pickDefaultFee } from "@/lib/fee-default";
import { isMealFee } from "@/lib/meal-fee";
import { isNewAdmissionFee } from "@/lib/new-admission-fee";
import { allocateAcrossFees } from "@/lib/fee-allocation";
import type { FeeFormData } from "@/components/fees/FeeFormModal";
import FeeStats from "@/components/fees/FeeStats";
import FeeTable, { StudentBalance } from "@/components/fees/FeeTable";
import MaterialIcon from "@/components/MaterialIcon";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { OwlyTrigger } from "@/components/owly/OwlyTrigger";
import { useToast } from "@/components/Toast";
import { FilterBar } from "@/components/ui/FilterBar";
import { Button } from "@/components/ui/index";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAcademic } from "@/lib/academic-context";
import { APP_NAME } from "@/lib/app-name";
import { useAuth } from "@/lib/auth-context";
import { PAYMENT_METHODS } from "@/lib/constants";
import { updateRecord } from "@/lib/crud-service";
import { formatCurrency } from "@/lib/currency";
import { generateWhatsAppShareLink } from "@/lib/whatsapp";
import { bucketTriageBalances, matchesFeeStatus, partitionFeeRoster, TRIAGE_BANDS } from "@/lib/fee-triage";
// NOTE: If your school uses fee_terms as the primary system, this fees page
// uses fee_structure instead. The fee_terms module at /dashboard/fee-terms is
// legacy and kept for backward compatibility only. See the deprecation notice
// in fee-terms/page.tsx for details.
import {
  generatePaymentReference,
  useClasses,
  useFeeAdjustments,
  useCompleteFeePayments,
  useTransactionRecorders,
  useFeePayments,
  useFeeStructure,
  usePaymentParentNames,
} from "@/lib/hooks";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useUrlSyncedFilters } from "@/lib/hooks/useUrlSyncedFilters";
import { getLocalDateString, timeoutFallback, withTimeout } from "@/lib/hooks/utils";
import { lazyWithIdlePrefetch } from "@/lib/lazy-prefetch";
import { logger } from "@/lib/logger";
import { useOfflineFees, useOfflineStudents } from "@/lib/offline-hooks";
import { calculateStudentFeePosition, feeAppliesToStudent } from "@/lib/operations";
import { computeArrearsSplit } from "@/lib/arrears";
import { supabase } from "@/lib/supabase";
import { useFormDraft } from "@/lib/useAutoSave";
import { UndoNotification, useUndo } from "@/lib/useUndo";
import { getErrorMessage } from "@/lib/validation";
import type { FeeStructure } from "@/types";

// Split out of the first-load bundle (old phones parse less up front) and warmed in
// idle time so the forms and tabs still open offline once the page has been visited.
const PaymentModal = lazyWithIdlePrefetch(() => import("@/components/fees/PaymentModal"));
const FeeFormModal = lazyWithIdlePrefetch(() => import("@/components/fees/FeeFormModal"));
const FeeImportModal = lazyWithIdlePrefetch(() => import("@/components/fees/FeeImportModal"));
const MobileMoneyImportModal = lazyWithIdlePrefetch(() => import("@/components/fees/MobileMoneyImportModal"));
const ReceiptModal = lazyWithIdlePrefetch(() => import("@/components/fees/ReceiptModal"));
const ReceiptPrompt = lazyWithIdlePrefetch(() => import("@/components/fees/ReceiptPrompt"));
const InvoiceModal = lazyWithIdlePrefetch(() => import("@/components/fees/InvoiceModal"));
const AdjustmentModal = lazyWithIdlePrefetch(() => import("@/components/fees/AdjustmentModal"));
const FeePaymentHistory = lazyWithIdlePrefetch(() => import("@/components/fees/FeePaymentHistory"));
const FeeAdjustmentsList = lazyWithIdlePrefetch(() => import("@/components/fees/FeeAdjustmentsList"));
const FeeStructureManager = lazyWithIdlePrefetch(() => import("@/components/fees/FeeStructureManager"));
const FeePaymentPlans = lazyWithIdlePrefetch(() => import("@/components/fees/FeePaymentPlans"));
const FeeInvoiceList = lazyWithIdlePrefetch(() => import("@/components/fees/FeeInvoiceList"));
const FeeCashbook = lazyWithIdlePrefetch(() => import("@/components/fees/FeeCashbook"));
const PaymentClaimsPanel = lazyWithIdlePrefetch(() => import("@/components/fees/PaymentClaimsPanel"));

interface PaymentPlan {
  id: string;
  student_id: string;
  total_amount: number;
  installments: number;
  start_date: string;
  status: "active" | "completed" | "defaulted";
  students?: {
    first_name: string;
    last_name: string;
    classes: { name: string };
  };
}

interface Installment {
  id: string;
  plan_id: string;
  due_date: string;
  amount: number;
  paid: boolean;
  paid_date?: string;
}

type PaymentClaimRow = {
  id: string;
  amount: number;
  claimed_method: string;
  reference: string | null;
  note: string | null;
  status: string;
  created_at: string;
  student_id: string;
  students?: { first_name?: string; last_name?: string; class?: { name?: string } | null } | null;
};

type FinanceTab = "balances" | "payment-plans" | "invoices" | "cashbook" | "claims";

/**
 * The single tab row. Balances/Payments/Structure all live under the
 * `balances` FinanceTab; the first three entries select that tab and a
 * sub-view, the rest select a tab of their own.
 */
const FINANCE_TABS = [
  { id: "balances" as const, label: "Balances" },
  { id: "payments" as const, label: "Payments" },
  { id: "structure" as const, label: "Fee Structure" },
  { id: "payment-plans" as const, label: "Payment Plans" },
  { id: "invoices" as const, label: "Invoices" },
  { id: "cashbook" as const, label: "Daily Money Log" },
  { id: "claims" as const, label: "Payment Claims" },
];

const MAX_FINANCE_AMOUNT = 100_000_000;

export default function FinanceHubPage() {
  const { school, isDemo, user } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const toast = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const urlFilters = useUrlSyncedFilters();

  const [paymentsPage, setPaymentsPage] = useState(() => {
    const p = urlFilters.get("page");
    return p ? Math.max(1, parseInt(p, 10) || 1) : 1;
  });
  const itemsPerPage = 50;

  const { data: students, loading: studentsLoading, error: studentsError } = useOfflineStudents(school?.id);

  // Keep loading=true while the auth context is still hydrating the school:
  // flipping it to false here made every consumer render its "0 students" state
  // for the window between mount and school?.id arriving.
  const studentsInitialLoading = studentsLoading && !school?.id;

  // Surface any fetch errors so the bursar knows if students failed to load.
  useEffect(() => {
    if (studentsError) {
      logger.error("Fees page — students fetch error:", studentsError);
      toast.error(
        "Failed to load students: " +
          ((studentsError as unknown as Error) instanceof Error
            ? (studentsError as unknown as Error).message
            : String(studentsError)),
      );
    }
  }, [studentsError, toast]);

  const offset = (paymentsPage - 1) * itemsPerPage;
  const {
    data: payments,
    loading: paymentsLoading,
    error: paymentsError,
    totalCount: paymentsTotalCount,
    refetch: refetchPayments,
  } = useOfflineFees(school?.id, { limit: itemsPerPage, offset });

  const { classes, loading: classesLoading } = useClasses(school?.id);
  const {
    feeStructure,
    createFeeStructure,
    updateFeeStructure,
    deleteFeeStructure,
    refetch: refetchFeeStructure,
  } = useFeeStructure(school?.id);

  // Fees offered to the mobile-money importer: this year's lines, with the
  // tuition line preselected because that is what most MoMo payments settle.
  const mobileFeeOptions = useMemo(
    () =>
      feeStructure
        .filter((fee) => !academicYear || !fee.academic_year || fee.academic_year === academicYear)
        .map((fee) => ({ id: fee.id, name: fee.name, class_name: fee.classes?.name ?? null })),
    [feeStructure, academicYear],
  );
  const mobileDefaultFeeId = useMemo(() => {
    const tuition = mobileFeeOptions.find((fee) => /tuition|school fees/i.test(fee.name));
    return (tuition || mobileFeeOptions[0])?.id || "";
  }, [mobileFeeOptions]);
  const { adjustments, createAdjustment, deleteAdjustment } = useFeeAdjustments(school?.id);
  const { createPayment, deletePayment } = useFeePayments(school?.id, 1, 50);
  const { payments: completePayments, truncated: ledgerTruncated } = useCompleteFeePayments(school?.id);
  // Every transaction carries a recorded_by id. An id is not something a bursar
  // can read, so the ledger resolves them to names once.
  const recordedByName = useTransactionRecorders(school?.id);

  // If the ledger ever hits its safety cap the totals below are incomplete, and
  // a balance that is short is worse than one that says so.
  useEffect(() => {
    if (ledgerTruncated) {
      logger.warn("Payment ledger truncated; fee totals may be incomplete");
    }
  }, [ledgerTruncated]);
  const parentNamesByStudent = usePaymentParentNames(school?.id);
  const receiptRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<FinanceTab>(() => (urlFilters.get("tab") as FinanceTab) || "balances");

  // ---- Parent payment claims (manual fee-payment confirmation) ----
  const [pendingClaims, setPendingClaims] = useState<PaymentClaimRow[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [reviewingClaimId, setReviewingClaimId] = useState<string | null>(null);

  const fetchPendingClaims = useCallback(async () => {
    if (isDemo) return;
    setClaimsLoading(true);
    try {
      const res = await fetch("/api/parent/fee-payment-claims/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", status: "pending" }),
      });
      const data = await res.json();
      if (res.ok && data.success) setPendingClaims(data.claims ?? []);
    } catch {
      // A failed claim list must never block the balances tab.
    } finally {
      setClaimsLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    if (tab === "claims") void fetchPendingClaims();
  }, [tab, fetchPendingClaims]);

  // Keep the tab badge honest so bursars notice claims without hunting.
  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/parent/fee-payment-claims/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list", status: "pending" }),
        });
        const data = await res.json();
        if (!cancelled && res.ok && data.success) setPendingClaims(data.claims ?? []);
      } catch {
        // ignore
      }
    };
    void poll();
    const id = window.setInterval(poll, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isDemo]);

  const reviewClaim = async (claimId: string, decision: "approve" | "reject") => {
    setReviewingClaimId(claimId);
    try {
      const res = await fetch("/api/parent/fee-payment-claims/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review", claimId, decision }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data?.error || "Could not update the claim. Please try again.");
        return;
      }
      toast.success(decision === "approve" ? "Payment recorded" : "Claim rejected");
      setPendingClaims((prev) => prev.filter((c) => c.id !== claimId));
      if (decision === "approve") void refetchPayments();
    } catch {
      toast.error("Network problem. Please try again.");
    } finally {
      setReviewingClaimId(null);
    }
  };
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  /**
   * Open the payment form with a reference already filled in.
   *
   * Every payment gets a reference, so there is nothing left to clash with and
   * nothing to forget -- which is what "clear the reference if this payment has
   * none" was asking people to do by hand. It stays editable, because a school
   * with its own receipt book should be able to type it.
   *
   * Generated once per opening, not once per render and not once per submit:
   * the reference is the idempotency key, so a retry after a timeout must reuse
   * the same value or the duplicate guard cannot see it and the payment is
   * recorded twice.
   */
  const openPaymentModal = () => {
    setNewPayment((prev) => ({
      ...prev,
      student_id: "",
      amount_paid: "",
      payment_date: getLocalDateString(),
      payment_reference: prev.payment_reference.trim() || generatePaymentReference(school?.school_code),
      fee_id: prev.fee_id,
      momo_transaction_id: "",
      paid_by: "",
      notes: "",
    }));
    setShowPaymentModal(true);
  };
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [recordedPaymentDate, setRecordedPaymentDate] = useState("");
  const [recordedPaymentAmount, setRecordedPaymentAmount] = useState<number | undefined>();
  // The payment bar, not a modal. Taking a payment used to open a receipt
  // dialog over the list the bursar was working down; it had to be closed
  // before the next parent could be served. Now the payment lands and a
  // small bar offers the receipt, then gets out of the way.
  const [showReceiptPrompt, setShowReceiptPrompt] = useState(false);
  const [recordedReceiptNumber, setRecordedReceiptNumber] = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [showFeeImport, setShowFeeImport] = useState(false);
  const [showMobileImport, setShowMobileImport] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "payment" | "fee" | "adjustment";
    id: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const undo = useUndo();
  const [selectedStudent, setSelectedStudent] = useState<StudentBalance | null>(null);
  const [selectedClass, setSelectedClass] = useState(() => urlFilters.get("class") || "all");
  const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "partial" | "paid" | "written_off" | "unbilled">(
    () => (urlFilters.get("status") as "all" | "unpaid" | "partial" | "paid" | "written_off" | "unbilled") || "all",
  );
  const [searchTerm, setSearchTerm] = useState(() => urlFilters.get("q") || "");
  const [saving, setSaving] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  // The header card clips its contents (the premium motif uses overflow-hidden),
  // so an absolutely-positioned menu was cut off at the card edge as soon as it
  // opened. Anchor it to the button but render it in a portal under <body>.
  const [headerMenuPosition, setHeaderMenuPosition] = useState<{ top: number; right: number } | null>(null);

  const toggleHeaderMenu = (anchor: HTMLElement) => {
    if (showHeaderMenu) {
      setShowHeaderMenu(false);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    setHeaderMenuPosition({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
    setShowHeaderMenu(true);
  };
  // Seeded from ?tab=structure so other screens (the bursar dashboard's "set
  // fees" prompt) can link straight to the fee list instead of Balances.
  const [balanceSubTab, setBalanceSubTab] = useState(() =>
    searchParams.get("tab") === "structure" ? "structure" : "balances",
  );

  useKeyboardShortcuts([
    {
      key: "n",
      ctrl: true,
      action: () => openPaymentModal(),
      description: "Record new payment",
    },
    {
      key: "f",
      ctrl: true,
      action: () => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      },
      description: "Focus search",
    },
    {
      key: "Escape",
      action: () => {
        setShowPaymentModal(false);
        setShowFeeModal(false);
        setShowAdjustmentModal(false);
      },
      description: "Close modal",
    },
  ]);

  const feeDraft = useFormDraft("fee_add_form");
  const [newFee, setNewFee] = useState<FeeFormData>({
    name: "",
    class_id: "",
    amount: "",
    term: currentTerm || 1,
    due_date: "",
    category: "tuition",
    boarding_status: "both",
    frequency: "per_term",
    transport_zone: "",
  });

  // The fee being edited, or null when the form is creating a new one. Fees
  // change per term and per year in most schools, so a bursar has to be able to
  // adjust an amount in place rather than delete and re-enter it.
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);

  const [newPayment, setNewPayment] = useState<{
    student_id: string;
    amount_paid: string;
    payment_date: string;
    payment_method: "cash" | "mobile_money" | "bank" | "installment" | "in_kind";
    payment_reference: string;
    /** Fee line being paid. "" = whole bill. */
    fee_id: string;
    momo_provider: "mtn" | "airtel";
    momo_transaction_id: string;
    paid_by: string;
    notes: string;
    allow_overpayment: boolean;
  }>({
    student_id: "",
    amount_paid: "",
    payment_date: getLocalDateString(),
    payment_method: PAYMENT_METHODS.CASH,
    payment_reference: "",
    fee_id: "",
    momo_provider: "mtn" as const,
    momo_transaction_id: "",
    paid_by: "",
    notes: "",
    allow_overpayment: false,
  });
  // Fee lines to offer, for one particular class.
  //
  // The only things excluded here are fees that genuinely cannot apply: a line
  // the school has retired, a line belonging to a different class, and a line
  // written for day pupils when this one boards (and vice versa). Fee lines
  // carry their own boarding_status, so that part is exact.
  //
  // Term and academic year deliberately do NOT exclude anything. They only
  // decide the ORDER.
  //
  // An earlier version filtered on both, and that was wrong. Only 3 of the 8
  // schools with fees have a current term marked at all, so currentTerm falls
  // back to 1 for the rest, and one school sets its fees for term 3 only. The
  // filter then matched nothing and the form reported "this class has no fees
  // set up" on a class carrying twelve fees, with money owed on it.
  //
  // A pupil can be owed a fee for a term the app does not consider current:
  // balances come from what was billed, not from today's date. Narrowing to one
  // term therefore hides charges the bursar is obliged to be able to record.
  // Ordering keeps the likely choice first without making the right choice
  // unreachable.
  //
  // Which fee gets preselected is decided by pickDefaultFee in lib/fee-default.
  const feesForClass = useCallback(
    (classId: string, boardingStatus?: string, takesMeals?: boolean | null, isNewAdmission?: boolean | null) => {
      const term = Number(currentTerm || 1);
      const allClasses = !classId || classId === "all";
      return feeStructure
        .filter((f) => {
          if (f.deleted_at) return false;
          if (!allClasses && f.class_id != null && f.class_id !== classId) return false;
          if (
            boardingStatus &&
            f.boarding_status &&
            f.boarding_status !== "both" &&
            f.boarding_status !== boardingStatus
          ) {
            return false;
          }
          // A meal is only owed by a pupil who eats at school. Not every day
          // pupil does -- some go home -- and charging them produces a Meals
          // fee they will refuse and a balance they never settle.
          //
          // Only true opts in. null means nobody has decided yet, and false
          // means the pupil goes home; neither is charged, so an existing
          // school stops billing meals to pupils who do not eat without anyone
          // having to touch a single row first.
          if (isMealFee(f) && takesMeals !== true) return false;
          // Registration and uniform are owed for joining, not for staying. A
          // pupil already on roll has not joined again and already owns their
          // uniform, so offering the line invites a bill nobody can collect.
          // Only an explicit new admission sees it.
          if (isNewAdmissionFee(f) && isNewAdmission !== true) return false;
          return true;
        })
        .sort((a, b) => {
          // A null term is a one-off charge (application, registration) and is
          // as good a candidate as the current term, so the two sort together.
          const aTerm = a.term == null || a.term === term ? 0 : 1;
          const bTerm = b.term == null || b.term === term ? 0 : 1;
          if (aTerm !== bTerm) return aTerm - bTerm;
          const aYear = academicYear && a.academic_year && a.academic_year !== academicYear ? 1 : 0;
          const bYear = academicYear && b.academic_year && b.academic_year !== academicYear ? 1 : 0;
          if (aYear !== bYear) return aYear - bYear;
          return a.name.localeCompare(b.name);
        })
        .map((f) => ({
          id: f.id,
          name: f.name,
          amount: f.amount,
          category: f.category,
          retired: Boolean(f.deleted_at),
        }));
    },
    [feeStructure, currentTerm, academicYear],
  );

  // Adjustments carry a bare fee_id and are not joined to fee_structure, so
  // resolve names from the fee list already loaded for the picker.
  const feeNameById = useMemo(() => new Map(feeStructure.map((f) => [f.id, f.name])), [feeStructure]);

  const [newAdjustment, setNewAdjustment] = useState<{
    student_id: string;
    adjustment_type: "discount" | "scholarship" | "penalty" | "manual_credit" | "write_off" | "bursary" | "amnesty";
    amount: string;
    description: string;
    /** Fee line being discounted. "" = whole bill. */
    fee_id: string;
  }>({
    student_id: "",
    adjustment_type: "bursary",
    amount: "",
    description: "",
    fee_id: "",
  });

  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [planStudents, setPlanStudents] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlan | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [newPlan, setNewPlan] = useState({
    student_id: "",
    total_amount: 0,
    installments: 3,
    start_date: new Date().toISOString().split("T")[0],
  });

  const [feePage, setFeePage] = useState(() => {
    const fp = urlFilters.get("feePage");
    return fp ? Math.max(1, parseInt(fp, 10) || 1) : 1;
  });
  const feesPerPage = 10;
  const feeOffset = (feePage - 1) * feesPerPage;
  const feeTotalPages = Math.max(1, Math.ceil(feeStructure.length / feesPerPage));

  useEffect(() => {
    setFeePage(1);
  }, [school?.id]);

  useEffect(() => {
    if (feeStructure.length > 0 && feePage > Math.ceil(feeStructure.length / feesPerPage)) {
      setFeePage(1);
    }
  }, [feeStructure.length, feePage, feesPerPage]);

  const paginatedFeeStructure = feeStructure.slice(feeOffset, feeOffset + feesPerPage);

  const [invoiceClassFilter, setInvoiceClassFilter] = useState(() => urlFilters.get("invoiceClass") || "all");
  const [cashbookDateFilter, setCashbookDateFilter] = useState(() => urlFilters.get("cashbookDate") || "today");

  useEffect(() => {
    const requestedTab = searchParams?.get("tab");
    if (
      requestedTab === "balances" ||
      requestedTab === "payment-plans" ||
      requestedTab === "invoices" ||
      requestedTab === "cashbook" ||
      requestedTab === "claims"
    ) {
      setTab(requestedTab);
    }
  }, [searchParams]);

  // URL-synced filters (debounced search)
  useEffect(() => {
    urlFilters.setMany({
      tab: tab !== "balances" ? tab : null,
      q: searchTerm || null,
      class: selectedClass !== "all" ? selectedClass : null,
      status: statusFilter !== "all" ? statusFilter : null,
      invoiceClass: invoiceClassFilter !== "all" ? invoiceClassFilter : null,
      cashbookDate: cashbookDateFilter !== "today" ? cashbookDateFilter : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, searchTerm, selectedClass, statusFilter, invoiceClassFilter, cashbookDateFilter]);

  useEffect(() => {
    if (paymentsPage > 1) urlFilters.set("page", String(paymentsPage));
    else {
      const params = new URLSearchParams(urlFilters.searchParams?.toString() || "");
      if (params.has("page")) {
        params.delete("page");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentsPage]);

  useEffect(() => {
    if (feePage > 1) urlFilters.set("feePage", String(feePage));
    else {
      const params = new URLSearchParams(urlFilters.searchParams?.toString() || "");
      if (params.has("feePage")) {
        params.delete("feePage");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feePage]);

  const fetchPlans = useCallback(async () => {
    if (!school?.id) return;
    setPlansLoading(true);
    const { data } = await supabase
      .from("payment_plans")
      .select("*, students(first_name, last_name, classes(name))")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false });
    setPlans(data || []);
    setPlansLoading(false);
  }, [school?.id]);

  const fetchPlanStudents = useCallback(async () => {
    if (!school?.id) return;
    const { data } = await supabase
      .from("students")
      .select("id, first_name, last_name, classes(name)")
      .eq("school_id", school.id)
      .eq("status", "active");
    setPlanStudents(data || []);
  }, [school?.id]);

  const fetchInstallments = useCallback(async () => {
    if (!selectedPlan) return;
    const { data } = await supabase
      .from("payment_plan_installments")
      .select("*")
      .eq("plan_id", selectedPlan.id)
      .order("due_date");
    setInstallments(data || []);
  }, [selectedPlan]);

  useEffect(() => {
    if (school?.id) {
      fetchPlans();
      fetchPlanStudents();
    }
  }, [school?.id, fetchPlans, fetchPlanStudents]);

  useEffect(() => {
    if (selectedPlan) {
      fetchInstallments();
    }
  }, [selectedPlan, fetchInstallments]);

  /**
   * Balances come from the complete ledger, never from the cashbook slice.
   *
   * `payments` is whatever page of the cashbook happens to be on screen -- 50
   * rows. Using it for arithmetic meant a pupil whose payment was the 51st most
   * recent showed UGX 0 paid and their whole balance outstanding, which is a
   * wrong number rather than an incomplete one. The table still pages; the
   * totals do not.
   */
  const paymentsByStudent = useMemo(() => {
    const map = new Map<string, typeof completePayments>();
    completePayments.forEach((p) => {
      if (!map.has(p.student_id)) map.set(p.student_id, []);
      map.get(p.student_id)!.push(p);
    });
    return map;
  }, [completePayments]);

  const adjustmentsByStudent = useMemo(() => {
    const map = new Map<string, typeof adjustments>();
    adjustments.forEach((a) => {
      if (!map.has(a.student_id)) map.set(a.student_id, []);
      map.get(a.student_id)!.push(a);
    });
    return map;
  }, [adjustments]);

  const feesByClass = useMemo(() => {
    const map = new Map<string | null | undefined, typeof feeStructure>();
    feeStructure.forEach((f) => {
      const key = f.class_id || null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    });
    return map;
  }, [feeStructure]);

  const computeStudentBalance = useCallback(
    (student: (typeof students)[number]) => {
      const studentClassId = student.class_id;
      const studentPayments = paymentsByStudent.get(student.id) || [];
      const applicableFees = [
        ...(feesByClass.get(null) || []),
        ...(studentClassId ? feesByClass.get(studentClassId) || [] : []),
      ].filter((fee) => feeAppliesToStudent(fee, student));
      const studentAdjustments = adjustmentsByStudent.get(student.id) || [];
      const feePosition = calculateStudentFeePosition({
        feeTotal: applicableFees.reduce((sum, f) => sum + Number(f.amount || 0), 0),
        payments: studentPayments,
        adjustments: studentAdjustments,
        openingBalance: Number(student.opening_balance || 0),
      });
      const arrearsSplit = computeArrearsSplit({
        fees: applicableFees,
        payments: studentPayments,
        adjustments: studentAdjustments,
        openingBalance: Number(student.opening_balance || 0),
        academicYear,
        currentTerm,
      });

      return {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        student_number: student.student_number || "",
        photo_url: (student as { photo_url?: string | null }).photo_url ?? null,
        class_name: student.classes?.name
          ? `${student.classes.name}${student.classes.stream ? ` ${student.classes.stream}` : ""}`
          : "",
        class_id: student.class_id ?? "",
        expected: feePosition.totalExpected,
        paid: feePosition.totalPaid,
        openingBalance: Number(student.opening_balance || 0),
        // Distinguishes "this class has no fees" from "a discount wiped the
        // bill", so a sponsored pupil is not reported as a setup error.
        billed: applicableFees.length > 0,
        balance: feePosition.balance,
        arrears: arrearsSplit.arrears,
        currentDue: arrearsSplit.currentDue,
        status: feePosition.status,
        feeBreakdown: allocateAcrossFees(
          applicableFees.map((f) => ({
            id: f.id,
            name: f.name,
            category: f.category ?? null,
            term: f.term ?? null,
            amount: Number(f.amount || 0),
          })),
          studentPayments.map((p) => ({
            id: p.id,
            amount_paid: Number(p.amount_paid || 0),
            fee_id: p.fee_id ?? null,
          })),
          studentAdjustments.map((a) => ({
            id: a.id,
            adjustment_type: a.adjustment_type,
            amount: Number(a.amount || 0),
            fee_id: a.fee_id ?? null,
          })),
        ),
        payments: studentPayments.map((p) => ({
          id: p.id,
          amount: Number(p.amount_paid),
          method: p.payment_method,
          reference: p.payment_reference || "",
          date: p.payment_date,
          // Which fee was paid. Resolved from the id against the fee structure
          // the page already holds, so the complete-ledger projection does not
          // have to carry a join. A payment may cover the whole bill and name
          // no fee at all.
          fee: (p.fee_id && feeNameById.get(p.fee_id)) || "",
        })),
        adjustments: studentAdjustments.map((a) => ({
          id: a.id,
          adjustment_type: a.adjustment_type,
          amount: Number(a.amount),
          description: a.notes || "",
          fee: a.fee_id ? feeNameById.get(a.fee_id) || "" : "",
        })),
      };
    },
    [paymentsByStudent, adjustmentsByStudent, feesByClass, feeNameById, academicYear, currentTerm],
  );

  const studentBalanceMap = useMemo(() => {
    if (!school?.id) return new Map();
    const map = new Map<string, StudentBalance>();
    students.forEach((s) => {
      map.set(s.id, computeStudentBalance(s));
    });
    return map;
  }, [students, computeStudentBalance, school?.id]);

  const studentBalances: StudentBalance[] = useMemo(() => {
    if (!school?.id) return [];
    return students.map((s) => studentBalanceMap.get(s.id)!);
  }, [students, studentBalanceMap, school?.id]);

  // A payment is for one pupil, so the fee list follows THAT pupil's class, not
  // the class filter above the table.
  //
  // Those are two different things and the page filter defaults to "All
  // classes", which left the picker listing every fee in the school at once --
  // a P.1 applicant saw P.6 fees and three years of Development Fund. The page
  // filter is only a fallback for before a pupil is chosen.
  const paymentStudent = students.find((s) => s.id === newPayment.student_id);
  const adjustmentStudent = students.find((s) => s.id === newAdjustment.student_id);
  const paymentClassId = paymentStudent?.class_id || selectedClass;
  const adjustmentClassId = adjustmentStudent?.class_id || selectedClass;
  const paymentBoarding = paymentStudent?.boarding_status || "";
  const paymentTakesMeals = paymentStudent?.takes_meals ?? null;
  const paymentIsNewAdmission = paymentStudent?.is_new_admission ?? null;
  const adjustmentBoarding = adjustmentStudent?.boarding_status || "";
  const adjustmentTakesMeals = adjustmentStudent?.takes_meals ?? null;
  const adjustmentIsNewAdmission = adjustmentStudent?.is_new_admission ?? null;

  const paymentFees = useMemo(
    () => feesForClass(paymentClassId, paymentBoarding, paymentTakesMeals, paymentIsNewAdmission),
    [feesForClass, paymentClassId, paymentBoarding, paymentTakesMeals, paymentIsNewAdmission],
  );
  const adjustmentFees = useMemo(
    () => feesForClass(adjustmentClassId, adjustmentBoarding, adjustmentTakesMeals, adjustmentIsNewAdmission),
    [feesForClass, adjustmentClassId, adjustmentBoarding, adjustmentTakesMeals, adjustmentIsNewAdmission],
  );
  const paymentDefaultFeeId = useMemo(
    () => pickDefaultFee(paymentFees, paymentBoarding),
    [pickDefaultFee, paymentFees, paymentBoarding],
  );
  const adjustmentDefaultFeeId = useMemo(
    () => pickDefaultFee(adjustmentFees, adjustmentBoarding),
    [pickDefaultFee, adjustmentFees, adjustmentBoarding],
  );

  const [bandFilter, setBandFilter] = useState<string | null>(null);
  // The bursar's job is collecting: open on pupils who owe, with a visible
  // way back to the full roster (cleared rows included).
  const [hideCleared, setHideCleared] = useState(true);

  const filteredBalances = useMemo(() => {
    // Searching for a pupil must never be defeated by the "hide cleared"
    // toggle. That toggle defaults on because triaging who owes money is the
    // job -- but it meant a name could match and then be filtered straight out
    // again, so a search for "mbab" reported "3 of 263 pupils" when it matched
    // four, and the missing child looked absent from the school rather than
    // paid. Asking for someone by name means wanting them either way.
    const query = searchTerm.trim().toLowerCase();
    const hasSearch = query.length > 0;

    return studentBalances
      .filter((s) => {
        const matchesSearch =
          !hasSearch || s.name.toLowerCase().includes(query) || s.student_number.toLowerCase().includes(query);
        const matchesClass = selectedClass === "all" || s.class_id === selectedClass;
        // Same rules the tiles above use. Unbilled pupils (expected 0) are NOT
        // "paid" — they were never billed — and "unbilled" is the only filter
        // that shows them, so the warning finally has a destination.
        const matchesStatus = matchesFeeStatus(s, statusFilter);
        const band = bandFilter ? TRIAGE_BANDS.find((b) => b.id === bandFilter) : null;
        const matchesBand = !band || (s.balance >= band.min && s.balance < band.max);
        // The debtors-first default hides cleared rows, but it must never hide
        // the rows a bursar just asked for by picking a status or the unbilled
        // warning.
        const matchesOwing = !hideCleared || statusFilter !== "all" || s.balance > 0 || hasSearch;
        return matchesSearch && matchesClass && matchesStatus && matchesBand && matchesOwing;
      })
      .sort((a, b) => b.balance - a.balance);
  }, [studentBalances, searchTerm, selectedClass, statusFilter, bandFilter, hideCleared]);

  // Distribution behind the follow-up threshold: bands of who owes what for
  // the current search/class scope, so the bursar sets cutoffs with eyes
  // open instead of guessing and getting 3 pupils or 300. Tapping a band
  // filters the list to it; tapping again clears.
  const triageBands = useMemo(() => {
    const scoped = studentBalances.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.student_number.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClass = selectedClass === "all" || s.class_id === selectedClass;
      return matchesSearch && matchesClass;
    });
    return bucketTriageBalances(scoped);
  }, [studentBalances, searchTerm, selectedClass]);

  // Totals for exactly what the list is showing, so the sticky bar answers
  // "who owes how much" for this filter — not just the whole school.
  const filteredTotals = useMemo(() => {
    return filteredBalances.reduce(
      (acc, s) => ({
        expected: acc.expected + (s.expected || 0),
        paid: acc.paid + (s.paid || 0),
        balance: acc.balance + (s.balance || 0),
      }),
      { expected: 0, paid: 0, balance: 0 },
    );
  }, [filteredBalances]);
  const filteredCollectionPct =
    filteredTotals.expected > 0 ? Math.round((filteredTotals.paid / filteredTotals.expected) * 100) : 0;

  // One exclusive partition drives every figure on the page. The old inline
  // predicates counted an unbilled pupil (expected 0, paid 0) as BOTH fully paid
  // (balance === 0) and unpaid (paid === 0), so the buckets over-summed the
  // roster and the collection rate was quoted off a base that included pupils
  // nobody had billed.
  const partition = useMemo(() => partitionFeeRoster(studentBalances), [studentBalances]);

  const stats = useMemo(() => {
    const momoPayments = payments.filter((p) => p.payment_method === "mobile_money");
    const momoTotal = momoPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
    const cashTotal = payments
      .filter((p) => p.payment_method === "cash")
      .reduce((sum, p) => sum + Number(p.amount_paid), 0);
    const bankTotal = payments
      .filter((p) => p.payment_method === "bank")
      .reduce((sum, p) => sum + Number(p.amount_paid), 0);
    return {
      momoTotal,
      cashTotal,
      bankTotal,
    };
  }, [payments]);

  const invoices = useMemo(() => {
    // Single source of truth: reuse studentBalanceMap (calculateStudentFeePosition
    // with adjustments + opening_balance). The old inline formula ignored both
    // and disagreed with the balances tab / printed invoice.
    // NOTE: `payments` here is the paginated cashbook slice — invoice totals are
    // only exact when the full ledger is loaded. Balances tab is authoritative.
    return students.map((student) => {
      const studentFeeItems = feeStructure.filter((fee) => feeAppliesToStudent(fee, student));
      const feeItems = studentFeeItems.map((f) => ({
        name: f.name,
        amount: Number(f.amount),
      }));
      const position = studentBalanceMap.get(student.id);
      return {
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        student_number: student.student_number || "",
        class_name: student.classes?.name || "",
        fee_items: feeItems,
        total_amount: position?.expected ?? feeItems.reduce((sum, f) => sum + f.amount, 0),
        amount_paid: position?.paid ?? 0,
        balance: position?.balance ?? 0,
        class_id: student.class_id ?? "",
      };
    });
  }, [students, feeStructure, studentBalanceMap]);

  const filteredInvoices = useMemo(() => {
    if (invoiceClassFilter === "all") return invoices;
    return invoices.filter((i) => i.class_id === invoiceClassFilter);
  }, [invoices, invoiceClassFilter]);

  const invoiceStats = useMemo(
    () => ({
      totalInvoiced: filteredInvoices.reduce((sum, i) => sum + i.total_amount, 0),
      totalCollected: filteredInvoices.reduce((sum, i) => sum + i.amount_paid, 0),
      totalBalance: filteredInvoices.reduce((sum, i) => sum + i.balance, 0),
      fullyPaid: filteredInvoices.filter((i) => i.balance === 0).length,
      hasBalance: filteredInvoices.filter((i) => i.balance > 0).length,
    }),
    [filteredInvoices],
  );

  const filteredCashbookPayments = useMemo(() => {
    // Compare YYYY-MM-DD strings in local time. `new Date(str)` parses as UTC
    // midnight and shifts a day for EAT (UTC+3), bucketing payments wrong.
    const todayStr = getLocalDateString();
    const today = new Date(`${todayStr}T00:00:00`);
    return payments.filter((p) => {
      const paymentStr = String(p.payment_date || "").slice(0, 10);
      if (!paymentStr) return cashbookDateFilter === "all";
      const paymentDate = new Date(`${paymentStr}T00:00:00`);
      if (cashbookDateFilter === "today") {
        return paymentStr === todayStr;
      } else if (cashbookDateFilter === "week") {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return paymentDate >= weekAgo;
      } else if (cashbookDateFilter === "month") {
        return paymentStr.slice(0, 7) === todayStr.slice(0, 7);
      }
      return true;
    });
  }, [payments, cashbookDateFilter]);

  const cashbookSummary = useMemo(() => {
    const cash = filteredCashbookPayments.filter((p) => p.payment_method === "cash");
    const momo = filteredCashbookPayments.filter((p) => p.payment_method === "mobile_money");
    const bank = filteredCashbookPayments.filter((p) => p.payment_method === "bank");
    return {
      total: filteredCashbookPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0),
      cash: cash.reduce((sum, p) => sum + Number(p.amount_paid), 0),
      momo: momo.reduce((sum, p) => sum + Number(p.amount_paid), 0),
      bank: bank.reduce((sum, p) => sum + Number(p.amount_paid), 0),
      count: filteredCashbookPayments.length,
    };
  }, [filteredCashbookPayments]);

  const activePlanCount = plans.filter((p) => p.status === "active").length;
  const completedPlanCount = plans.filter((p) => p.status === "completed").length;
  const totalOutstanding = plans
    .filter((p) => p.status === "active")
    .reduce((sum, p) => {
      const planInstallments = installments.filter((i) => i.plan_id === p.id && !i.paid);
      return sum + planInstallments.reduce((s, i) => s + i.amount, 0);
    }, 0);

  const handleNewFeeChange = (updates: Partial<typeof newFee>) => {
    setNewFee((prev) => {
      const newState = { ...prev, ...updates };
      feeDraft.updateData(newState);
      return newState;
    });
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedAmount = newPayment.amount_paid.trim();

    if (!newPayment.student_id || !normalizedAmount) {
      toast.error("Please fill all required fields");
      return;
    }

    const parsedAmount = Number(normalizedAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Payment amount must be a positive number");
      return;
    }
    if (parsedAmount > MAX_FINANCE_AMOUNT) {
      toast.error("Payment amount seems too large. Please check and try again.");
      return;
    }
    const transactionId = newPayment.momo_transaction_id.trim();
    if (newPayment.payment_method === PAYMENT_METHODS.MOBILE_MONEY && !transactionId) {
      toast.error("Transaction ID is required for mobile money");
      return;
    }
    try {
      setSaving(true);
      let reference = newPayment.payment_reference.trim();
      if (newPayment.payment_method === PAYMENT_METHODS.MOBILE_MONEY) {
        reference = `${newPayment.momo_provider.toUpperCase()}-${transactionId}`;
      }
      const paymentResult = await createPayment({
        student_id: newPayment.student_id,
        amount_paid: parsedAmount,
        payment_date: newPayment.payment_date,
        payment_method: newPayment.payment_method,
        payment_reference: reference || undefined,
        // The picker shows a preselected fee without storing it, so fall back to
        // that here. Otherwise an untouched form would send no fee at all and be
        // rejected by the validator it is meant to satisfy.
        fee_id: newPayment.fee_id || paymentDefaultFeeId || undefined,
        paid_by: newPayment.paid_by || undefined,
        notes: newPayment.notes || undefined,
        allow_overpayment: newPayment.allow_overpayment || undefined,
      });

      // Hoisted: the receipt number belongs on the receipt the bursar hands
      // over, and the block that mints it is conditional on the payment
      // having been written.
      let receiptNumberForRecord: string | null = null;

      if (!isDemo && school?.id && paymentResult?.id) {
        // Retry-after-timeout returns the EXISTING payment row (idempotent),
        // so first check whether it already has a receipt — minting a second
        // number for one payment breaks the receipt book.
        const { data: existingReceipt } = await withTimeout(
          supabase
            .from("receipts")
            .select("receipt_number")
            .eq("school_id", school.id)
            .eq("payment_id", paymentResult.id)
            .maybeSingle(),
          10000,
          timeoutFallback(),
        );
        const existingNumber = (existingReceipt as { receipt_number?: string } | null)?.receipt_number;

        // Atomic per-school counter (next_receipt_number): two devices
        // receipting at once must never mint the same RCP number. Falls back
        // to read-max-plus-one on DBs predating the 20260917 migration.
        let receiptNumber: string | null = existingNumber ?? null;
        if (!receiptNumber) {
          const { data: rpcNumber } = await withTimeout(
            supabase.rpc("next_receipt_number", { p_school_id: school.id }),
            10000,
            timeoutFallback(),
          );
          if (typeof rpcNumber === "string" && rpcNumber) {
            receiptNumber = rpcNumber;
          } else {
            const { data: lastReceipt } = await withTimeout(
              supabase
                .from("receipts")
                .select("receipt_number")
                .eq("school_id", school.id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
              10000,
              timeoutFallback(),
            );

            const lastNum = lastReceipt?.receipt_number
              ? parseInt(lastReceipt.receipt_number.replace("RCP-", ""), 10) || 0
              : 0;
            receiptNumber = `RCP-${String(lastNum + 1).padStart(6, "0")}`;
          }
        }

        receiptNumberForRecord = receiptNumber;

        if (!existingNumber) {
          await withTimeout(
            supabase.from("receipts").insert({
              school_id: school.id,
              student_id: newPayment.student_id,
              payment_id: paymentResult.id,
              receipt_number: receiptNumber,
              amount: parsedAmount,
              issued_at: new Date().toISOString(),
            }),
            10000,
            timeoutFallback(),
          );
        }
      }

      const student = studentBalances.find((s) => s.id === newPayment.student_id);
      if (student) {
        setRecordedPaymentDate(paymentResult.payment_date);
        setRecordedPaymentAmount(Number(paymentResult.amount_paid));
        setRecordedReceiptNumber(receiptNumberForRecord);
        setSelectedStudent({
          ...student,
          paid: student.paid + parsedAmount,
          balance: Math.max(0, student.balance - parsedAmount),
        });
        // Not the whole receipt: a small bar, so the bursar can carry on
        // serving the queue and still send the receipt if the parent wants
        // one.
        setShowReceiptPrompt(true);
      }
      toast.success("Payment recorded successfully");
      if (!isDemo) void refetchPayments();
      setShowPaymentModal(false);
      setNewPayment({
        student_id: "",
        amount_paid: "",
        payment_date: getLocalDateString(),
        payment_method: "cash",
        payment_reference: "",
        fee_id: "",
        momo_provider: "mtn",
        momo_transaction_id: "",
        paid_by: "",
        notes: "",
        allow_overpayment: false,
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    // The previous guard here refused bursars outright, telling them to contact
    // the headmaster -- while the database was already letting them: can_manage_fees()
    // includes 'bursar', and so does FEE_MGMT_ROLES in /api/fees. The whole
    // layer was theatre. Voiding is a soft delete behind a confirm dialog with a
    // five-second undo, and a bursar recording the wrong payment is exactly who
    // most needs to correct it.
    setConfirmDelete({ type: "payment", id: paymentId });
  };

  const executeDeletePayment = async (paymentId: string) => {
    setDeleting(true);
    try {
      await undo.executeWithUndo(
        async () => {
          await deletePayment(paymentId);
        },
        async () => {
          toast.error("Undo not available after page refresh");
        },
        {
          description: "Payment deleted",
          undoDelay: 5000,
          successMessage: "Payment deleted",
          undoMessage: "Payment restored",
        },
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete payment");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const handleCreateFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFee.name || !newFee.amount) {
      toast.error("Please fill fee name and amount");
      return;
    }
    const parsedFeeAmount = Number(newFee.amount);
    if (isNaN(parsedFeeAmount) || parsedFeeAmount <= 0) {
      toast.error("Fee amount must be a positive number");
      return;
    }
    if (parsedFeeAmount > MAX_FINANCE_AMOUNT) {
      toast.error("Fee amount seems too large. Please check and try again.");
      return;
    }
    if (newFee.name.trim().length < 2) {
      toast.error("Fee name must be at least 2 characters");
      return;
    }
    try {
      setSaving(true);
      if (editingFeeId) {
        // Adjusting an existing fee item — same validation, but the row keeps
        // its identity so existing payments still point at it.
        await updateFeeStructure(editingFeeId, {
          name: newFee.name,
          class_id: newFee.class_id || undefined,
          amount: Number(newFee.amount),
          term: newFee.frequency === "per_term" ? Number(newFee.term) : null,
          academic_year: feeStructure.find((fee) => fee.id === editingFeeId)?.academic_year || academicYear,
          due_date: newFee.due_date || undefined,
          category: newFee.category,
          boarding_status: newFee.boarding_status === "both" ? null : newFee.boarding_status,
          frequency: newFee.frequency,
          transport_zone: newFee.transport_zone || undefined,
        });
        toast.success("Fee updated");
      } else {
        await createFeeStructure({
          name: newFee.name,
          class_id: newFee.class_id || undefined,
          amount: Number(newFee.amount),
          term: newFee.frequency === "per_term" ? Number(newFee.term) : null,
          academic_year: academicYear,
          due_date: newFee.due_date || undefined,
          category: newFee.category,
          boarding_status: newFee.boarding_status,
          frequency: newFee.frequency,
          transport_zone: newFee.transport_zone || undefined,
        });
        toast.success("Fee structure created");
      }
      setShowFeeModal(false);
      setEditingFeeId(null);
      feeDraft.clearSaved();
      setNewFee({
        name: "",
        class_id: "",
        amount: "",
        term: currentTerm || 1,
        due_date: "",
        category: "tuition",
        boarding_status: "both",
        frequency: "per_term",
        transport_zone: "",
      });
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? editingFeeId
            ? `Failed to update fee: ${err.message}`
            : err.message
          : editingFeeId
            ? "Failed to update fee"
            : "Failed to create fee",
      );
    } finally {
      setSaving(false);
    }
  };

  // Prefill the form from an existing fee so the bursar can adjust it in place.
  const handleEditFee = (fee: FeeStructure) => {
    setEditingFeeId(fee.id);
    setNewFee({
      name: fee.name,
      class_id: fee.class_id || "",
      amount: String(fee.amount),
      // Both of these must come from the row. Prefilling term from
      // `currentTerm` and due_date from "" silently moved a fee into whatever
      // term was open and wiped its due date, so an edited fee appeared in the
      // structure table but had vanished from the term being collected for.
      term: (fee.term || currentTerm || 1) as 1 | 2 | 3,
      due_date: fee.due_date || "",
      category: (fee.category || "tuition") as FeeFormData["category"],
      boarding_status: fee.boarding_status || "both",
      frequency: fee.frequency || "per_term",
      transport_zone: fee.transport_zone || "",
    });
    setShowFeeModal(true);
  };

  const handleDeleteFee = async (feeId: string) => {
    setConfirmDelete({ type: "fee", id: feeId });
  };

  const executeDeleteFee = async (feeId: string) => {
    setDeleting(true);
    try {
      await undo.executeWithUndo(
        async () => {
          await deleteFeeStructure(feeId);
        },
        async () => {
          toast.error("Undo not available after page refresh");
        },
        {
          description: "Fee structure deleted",
          undoDelay: 5000,
          successMessage: "Fee deleted",
          undoMessage: "Fee restored",
        },
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete fee");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const handleGenerateInvoice = (student: StudentBalance) => {
    setSelectedStudent(student);
    setShowInvoiceModal(true);
  };

  const handlePrintInvoice = () => {
    if (!selectedStudent) return;
    const logoUrl = school?.logo_url || "";
    const schoolName = school?.name || "School";
    const schoolColor = school?.primary_color || "#002045";
    const today = new Date().toLocaleDateString();
    const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;

    const escapeHtml = (s: string) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const html = `
        <html><head><title>Invoice</title><style>
        body{font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto}
        .header{text-align:center;border-bottom:2px solid ${schoolColor};padding-bottom:15px;margin-bottom:15px}
        .logo{max-width:80px;max-height:60px;margin-bottom:10px}
        .school-name{font-size:20px;font-weight:bold;color:${schoolColor};margin:5px 0}
        .school-info{font-size:11px;color:#666;margin-bottom:5px}
        .invoice-title{font-size:16px;font-weight:bold;color:${schoolColor};margin:10px 0}
        .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #ddd}
        .label{color:#666;font-size:13px}
        .value{font-weight:bold;font-size:13px}
        .total{font-size:16px;border-top:2px solid ${schoolColor};margin-top:10px;padding-top:10px;font-weight:bold}
        .footer{text-align:center;margin-top:25px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:15px}
      </style></head><body>
        <div class="header">
          ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" class="logo" alt="${escapeHtml(schoolName)}">` : ""}
          <div class="school-name">${escapeHtml(schoolName)}</div>
          <div class="school-info">Tel: ${escapeHtml(school?.phone || "")} | Email: ${escapeHtml(school?.email || "")}</div>
          <div class="invoice-title">FEES BALANCE SHEET</div>
          <div class="school-info">Ref No: ${escapeHtml(invoiceNo)} | Date: ${escapeHtml(today)}</div>
        </div>
        <div class="row"><span class="label">Student:</span><span class="value">${escapeHtml(selectedStudent.name)}</span></div>
        <div class="row"><span class="label">Student No:</span><span class="value">${escapeHtml(selectedStudent.student_number)}</span></div>
        <div class="row"><span class="label">Class:</span><span class="value">${escapeHtml(selectedStudent.class_name)}</span></div>
        <div class="row"><span class="label">Term:</span><span class="value">Term ${currentTerm}, ${academicYear}</span></div>
        <div class="row"><span class="label">Total to Pay:</span><span class="value">${formatCurrency(selectedStudent.expected)}</span></div>
        <div class="row"><span class="label">Amount Given:</span><span class="value">${formatCurrency(selectedStudent.paid)}</span></div>
        <div class="total"><span class="label">Remaining Debt:</span><span class="value">${formatCurrency(selectedStudent.balance)}</span></div>
        <div class="footer">
          <div>This invoice is generated by ${APP_NAME}</div>
        </div>
      </body></html>`;

    let iframe = document.getElementById("print-iframe") as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "print-iframe";
      iframe.style.cssText = "position:absolute;width:0;height:0;border:none;overflow:hidden;";
      document.body.appendChild(iframe);
    }

    const onLoad = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        logger.warn("Print failed:", err);
        toast.error("Printing failed. Please use Ctrl+P/Cmd+P instead.");
      }
      iframe.removeEventListener("load", onLoad);
    };
    iframe.addEventListener("load", onLoad);
    iframe.srcdoc = html;
  };

  const handlePrintReceipt = () => {
    if (receiptRef.current) {
      // The same paper the bursar saw on screen. The print window has no
      // Tailwind, so the receipt's own class names are what carry the
      // styling -- which is why they are semantic names and not only
      // utility classes.
      const printContent = receiptRef.current.innerHTML;
      const schoolName = school?.name || "School";
      const escapeHtml = (s: string) =>
        String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      const html = `
          <html><head><title>Fee Receipt</title><style>
          body{font-family:Arial,sans-serif;padding:16px;max-width:400px;margin:0 auto;color:#1a1a1a}
          .receipt-paper{border:1px solid #e4e4e7;padding:18px 16px}
          .receipt-header{text-align:center}
          .receipt-logo{width:52px;height:52px;border-radius:10px;object-fit:cover;display:block;margin:0 auto 8px}
          .receipt-school{font-size:18px;font-weight:800;line-height:1.2}
          .receipt-meta{font-size:11px;color:#666;margin-top:4px}
          .receipt-title{font-size:10px;letter-spacing:.18em;color:#888;text-transform:uppercase;font-weight:800;margin-top:10px}
          .receipt-rule{border-top:1px dashed #d4d4d8;margin:12px 0}
          .receipt-row{display:flex;justify-content:space-between;gap:12px;padding:3px 0;font-size:12px}
          .receipt-label{color:#666}
          .receipt-value{font-weight:700}
          .receipt-total{text-align:center;margin-top:14px;border-top:2px solid #000;padding-top:12px}
          .receipt-total-label{font-size:9px;letter-spacing:.2em;color:#888;text-transform:uppercase;font-weight:700}
          .receipt-amount{font-size:24px;font-weight:800;font-family:'Courier New',monospace}
          .receipt-stamp{display:inline-block;border:1px solid #999;border-radius:999px;padding:2px 10px;font-size:9px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;margin-top:6px}
          .receipt-footer{text-align:center;font-size:11px;color:#888}
          .receipt-thanks{font-weight:700;color:#000}
          </style></head><body>
          ${printContent}
        </body></html>`;

      let iframe = document.getElementById("print-iframe") as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "print-iframe";
        iframe.style.cssText = "position:absolute;width:0;height:0;border:none;overflow:hidden;";
        document.body.appendChild(iframe);
      }

      const onLoad = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          logger.warn("Print failed:", err);
          toast.error("Printing failed. Please use Ctrl+P/Cmd+P instead.");
        }
        iframe.removeEventListener("load", onLoad);
      };
      iframe.addEventListener("load", onLoad);
      iframe.srcdoc = html;
    }
  };

  const handleViewReceipt = (student: StudentBalance) => {
    setSelectedStudent(student);
    setShowReceiptModal(true);
  };

  /**
   * Send the receipt to the parent.
   *
   * Two ways, because that is how parents actually receive things: WhatsApp
   * for the ones who use it, SMS for everyone else. Both go out with the
   * receipt number, the amount and what is left, so a parent can answer the
   * question they are really asking -- "how much is left?" -- without
   * ringing the school.
   */
  const receiptParentPhone = useMemo(() => {
    if (!selectedStudent) return null;
    const match = students.find((s) => s.id === selectedStudent.id) as { parent_phone?: string | null } | undefined;
    return match?.parent_phone ?? null;
  }, [selectedStudent, students]);

  const receiptMessage = useMemo(() => {
    if (!selectedStudent) return "";
    const amount = recordedPaymentAmount ?? selectedStudent.paid;
    const parts = [
      `${school?.name || "School"}: payment received`,
      `${selectedStudent.name} (${selectedStudent.student_number})`,
      `Amount: ${formatCurrency(amount)}`,
    ];
    if (recordedReceiptNumber) parts.push(`Receipt: ${recordedReceiptNumber}`);
    if (selectedStudent.balance > 0) {
      parts.push(`Balance: ${formatCurrency(selectedStudent.balance)}`);
    } else {
      parts.push("Paid in full. Thank you.");
    }
    return parts.join("\n");
  }, [selectedStudent, recordedPaymentAmount, recordedReceiptNumber, school?.name]);

  const sendReceiptWhatsApp = () => {
    if (!receiptParentPhone) {
      toast.error("No parent phone number on this pupil");
      return;
    }
    const link = generateWhatsAppShareLink(receiptParentPhone, receiptMessage);
    window.open(link, "_blank", "noopener,noreferrer");
    setShowReceiptPrompt(false);
  };

  const sendReceiptSms = async () => {
    if (!receiptParentPhone) {
      toast.error("No parent phone number on this pupil");
      return;
    }
    try {
      const res = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: receiptParentPhone,
          message: receiptMessage,
          schoolId: school?.id,
        }),
      });
      if (!res.ok) throw new Error(`SMS API returned ${res.status}`);
      const smsResult = await res.json().catch(() => null);
      const smsData = smsResult?.data || {};
      if (smsData.status === "sent") {
        toast.success("Receipt sent to the parent");
        setShowReceiptPrompt(false);
      } else if (smsData.status === "fallback" && typeof smsData.whatsappLink === "string") {
        window.open(smsData.whatsappLink, "_blank", "noopener,noreferrer");
        toast.error("SMS failed. Opened WhatsApp instead.");
        setShowReceiptPrompt(false);
      } else {
        throw new Error("SMS could not be sent");
      }
    } catch (err) {
      logger.warn("Send receipt SMS failed:", err);
      toast.error("Could not send the SMS");
    }
  };

  const handlePaymentChange = (updates: Partial<typeof newPayment>) => {
    setNewPayment((prev) => ({ ...prev, ...updates }));
  };

  const handleAdjustmentChange = (updates: Partial<typeof newAdjustment>) => {
    setNewAdjustment((prev) => ({ ...prev, ...updates }));
  };

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdjustment.student_id || !newAdjustment.amount || !newAdjustment.description.trim()) {
      toast.error("Please complete all adjustment fields");
      return;
    }
    try {
      setSaving(true);
      await createAdjustment({
        student_id: newAdjustment.student_id,
        adjustment_type: newAdjustment.adjustment_type,
        amount: Number(newAdjustment.amount),
        description: newAdjustment.description.trim(),
        fee_id: newAdjustment.fee_id || adjustmentDefaultFeeId || undefined,
      });
      toast.success("Adjustment recorded");
      setShowAdjustmentModal(false);
      setNewAdjustment({
        student_id: "",
        adjustment_type: "bursary",
        amount: "",
        description: "",
        fee_id: "",
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to record adjustment");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAdjustment = async (adjustmentId: string) => {
    if (user?.role === "bursar") {
      toast.error("Bursars cannot delete adjustments. Please contact the Headmaster.");
      return;
    }
    setConfirmDelete({ type: "adjustment", id: adjustmentId });
  };

  const executeDeleteAdjustment = async (adjustmentId: string) => {
    setDeleting(true);
    try {
      await undo.executeWithUndo(
        async () => {
          await deleteAdjustment(adjustmentId);
        },
        async () => {
          toast.error("Undo not available after page refresh");
        },
        {
          description: "Adjustment deleted",
          undoDelay: 5000,
          successMessage: "Adjustment deleted",
          undoMessage: "Adjustment restored",
        },
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete adjustment");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const createPlan = async () => {
    if (!school?.id) {
      toast.error("School not found");
      return;
    }

    if (!newPlan.student_id || newPlan.total_amount <= 0) {
      toast.error("Please fill all fields");
      return;
    }

    if (!newPlan.start_date) {
      toast.error("Plan start date is required");
      return;
    }

    const installmentAmount = Math.round(newPlan.total_amount / newPlan.installments);
    const planData = {
      school_id: school?.id,
      student_id: newPlan.student_id,
      total_amount: newPlan.total_amount,
      installments: newPlan.installments,
      start_date: newPlan.start_date,
      status: "active",
      academic_year: academicYear,
    };
    try {
      const planRes = await withTimeout(
        supabase.from("payment_plans").insert(planData).select().single(),
        15000,
        timeoutFallback(),
      );
      const plan = planRes.data as { id: string };
      const error = planRes.error;
      if (error) throw error;

      const installmentData = [];
      for (let i = 0; i < newPlan.installments; i++) {
        const dueDate = new Date(newPlan.start_date);
        dueDate.setMonth(dueDate.getMonth() + i);
        installmentData.push({
          plan_id: plan.id,
          due_date: dueDate.toISOString().split("T")[0],
          amount: installmentAmount,
          paid: false,
        });
      }

      const installmentResult = await withTimeout(
        supabase.from("payment_plan_installments").insert(installmentData),
        15000,
        timeoutFallback(),
      );
      const installmentError = installmentResult?.error;

      if (installmentError) {
        await supabase.from("payment_plans").delete().eq("id", plan.id);
        throw installmentError;
      }

      toast.success("Payment plan created");
      setShowCreatePlan(false);
      setNewPlan({
        student_id: "",
        total_amount: 0,
        installments: 3,
        start_date: new Date().toISOString().split("T")[0],
      });
      fetchPlans();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to create plan"));
    }
  };

  const markInstallmentPaid = async (installmentId: string) => {
    try {
      const { withTimeout, timeoutFallback } = await import("@/lib/hooks/utils");
      const paymentResult = await withTimeout(
        supabase
          .from("payment_plan_installments")
          .update({ paid: true, paid_date: new Date().toISOString() })
          .eq("id", installmentId),
        15000,
        timeoutFallback(),
      );
      const paymentError = paymentResult?.error;
      if (paymentError) throw paymentError;

      const updated = installments.map((i) => (i.id === installmentId ? { ...i, paid: true } : i));
      setInstallments(updated);
      if (updated.every((i) => i.paid)) {
        const { error: planError } = await supabase
          .from("payment_plans")
          .update({ status: "completed" })
          .eq("id", selectedPlan?.id);
        if (planError) throw planError;
      }
      toast.success("Payment recorded");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to record payment"));
    }
  };

  const printInvoice = (invoice: (typeof invoices)[number]) => {
    const escapeHtml = (s: string) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    const html = `
      <html>
        <head>
          <title>Invoice - ${escapeHtml(invoice.student_name)}</title>
          <style>
            * { font-family: Arial, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
            body { padding: 20px; }
            .invoice { max-width: 600px; margin: 0 auto; }
            .header { background: #1e3a5f; color: white; padding: 20px; text-align: center; }
            .school-name { font-size: 20px; font-weight: bold; }
            .subtitle { font-size: 12px; margin-top: 4px; }
            .info { padding: 15px; background: #f5f5f5; margin-bottom: 15px; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 13px; }
            .info-label { color: #666; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th { background: #1e3a5f; color: white; padding: 10px; text-align: left; }
            td { padding: 10px; border-bottom: 1px solid #eee; }
            .total-row { font-weight: bold; background: #f0f9ff; }
            .balance { text-align: right; padding: 15px; }
            .balance-amount { font-size: 18px; font-weight: bold; color: ${invoice.balance > 0 ? "#dc2626" : "#16a34a"}; }
            .footer { text-align: center; padding: 15px; font-size: 11px; color: #999; border-top: 1px solid #eee; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="invoice">
            <div class="header">
              <div class="school-name">${escapeHtml(school?.name || "School Name")}</div>
              <div class="subtitle">Fee Invoice - Term ${currentTerm}, ${academicYear}</div>
            </div>
            <div class="info">
              <div class="info-row"><span class="info-label">Student Name:</span><span>${escapeHtml(invoice.student_name)}</span></div>
              <div class="info-row"><span class="info-label">Student Number:</span><span>${escapeHtml(invoice.student_number)}</span></div>
              <div class="info-row"><span class="info-label">Class:</span><span>${escapeHtml(invoice.class_name)}</span></div>
              <div class="info-row"><span class="info-label">Date:</span><span>${new Date().toLocaleDateString()}</span></div>
            </div>
            <table>
              <thead><tr><th>Fee Item</th><th style="text-align: right;">Amount (UGX)</th></tr></thead>
              <tbody>
                ${invoice.fee_items.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td style="text-align: right;">${item.amount.toLocaleString()}</td></tr>`).join("")}
                <tr class="total-row"><td>Total</td><td style="text-align: right;">${invoice.total_amount.toLocaleString()}</td></tr>
                <tr><td>Paid</td><td style="text-align: right; color: green;">${invoice.amount_paid.toLocaleString()}</td></tr>
              </tbody>
            </table>
            <div class="balance">
              <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Balance Due</div>
              <div class="balance-amount">${formatCurrency(invoice.balance)}</div>
            </div>
            <div class="footer">Thank you for your payment. Please present this invoice when making payments.</div>
          </div>
        </body>
      </html>
    `;

    let iframe = document.getElementById("print-iframe") as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "print-iframe";
      iframe.style.cssText = "position:absolute;width:0;height:0;border:none;overflow:hidden;";
      document.body.appendChild(iframe);
    }

    const onLoad = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        logger.warn("Print failed:", err);
        toast.error("Printing failed. Please use Ctrl+P/Cmd+P instead.");
      }
      iframe.removeEventListener("load", onLoad);
    };
    iframe.addEventListener("load", onLoad);
    iframe.srcdoc = html;
  };

  const sendInvoiceSMS = async (invoice: (typeof invoices)[number]) => {
    try {
      const student = students.find((s) => s.id === invoice.student_id);
      if (!student?.parent_phone) {
        toast.error("No parent phone number");
        return;
      }
      const message = `Dear Parent, ${invoice.student_name} (${invoice.student_number}) fee invoice: Total ${formatCurrency(invoice.total_amount)}, Paid ${formatCurrency(invoice.amount_paid)}, Balance ${formatCurrency(invoice.balance)}. ${school?.name}`;
      const res = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: student.parent_phone,
          message,
          schoolId: school?.id,
        }),
      });
      if (!res.ok) throw new Error(`SMS API returned ${res.status}`);
      const smsResult = await res.json().catch(() => null);
      const smsData = smsResult?.data || {};
      if (smsData.status === "sent") {
        toast.success("Invoice sent to the parent");
      } else if (smsData.status === "fallback" && typeof smsData.whatsappLink === "string") {
        window.open(smsData.whatsappLink, "_blank", "noopener,noreferrer");
        toast.error("SMS failed. Opened WhatsApp fallback for manual send.");
      } else {
        throw new Error("SMS could not be sent");
      }
    } catch (err) {
      logger.warn("Send invoice SMS failed:", err);
      toast.error("Failed to send SMS");
    }
  };

  const exportCashbookCSV = () => {
    const headers = ["Date", "Student", "Amount", "Method", "Reference"];
    const rows = filteredCashbookPayments.map((p) => [
      p.payment_date,
      `${(p as { students?: { first_name?: string; last_name?: string } }).students?.first_name || ""} ${(p as { students?: { first_name?: string; last_name?: string } }).students?.last_name || ""}`,
      String(p.amount_paid),
      p.payment_method,
      p.payment_reference || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cashbook_${cashbookDateFilter}.csv`;
    a.click();
  };

  const handleAutoFeeReminders = async () => {
    if (!school?.id) {
      toast.error("School not found");
      return;
    }
    setSendingReminders(true);
    try {
      const res = await fetch("/api/automation/auto-fee-reminder/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: school.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `Reminders sent: ${data.summary.remindersSent} sent, ${data.summary.skipped} skipped, ${data.summary.errors} errors`,
        );
      } else {
        toast.error(data.error || "Failed to send reminders");
      }
    } catch (err) {
      logger.warn("Send fee reminders failed:", err);
      toast.error("Failed to send fee reminders");
    } finally {
      setSendingReminders(false);
    }
  };

  return (
    <PageErrorBoundary>
      <div className="space-y-6 pb-24 md:pb-6">
        <PageHeader
          title="Fees Tracker"
          subtitle={`Term ${currentTerm}, ${academicYear}`}
          variant="premium"
          actions={
            <div className="flex items-center gap-2 justify-start lg:justify-end">
              <Button variant="primary" size="sm" onClick={openPaymentModal}>
                <MaterialIcon icon="payments" />
                Add Payment
              </Button>
              {/* Six free-standing buttons pushed "Add Payment" off the
                  first screenful and made every action look equally urgent.
                  One primary, the rest behind a menu. */}
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(event) => toggleHeaderMenu(event.currentTarget)}
                  aria-expanded={showHeaderMenu}
                  aria-haspopup="menu"
                  aria-label="More fee actions"
                >
                  <MaterialIcon icon="more_horiz" />
                  More
                </Button>
              </div>
            </div>
          }
        />

        {showHeaderMenu &&
          headerMenuPosition &&
          typeof document !== "undefined" &&
          createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-[60] cursor-default"
                aria-label="Close menu"
                onClick={() => setShowHeaderMenu(false)}
              />
              <div
                role="menu"
                style={{ top: headerMenuPosition.top, right: headerMenuPosition.right }}
                className="fixed z-[70] w-60 max-w-[calc(100vw-1rem)] rounded-xl border border-outline-variant bg-surface-container-lowest p-1.5 shadow-lg"
              >
                {[
                  { label: "Scholarship/Discount", icon: "tune", run: () => setShowAdjustmentModal(true) },
                  { label: "Payment Plans", icon: "event_note", run: () => setShowCreatePlan(true) },
                  { label: "Bulk Import", icon: "upload_file", run: () => setShowFeeImport(true) },
                  { label: "MoMo Import", icon: "smartphone", run: () => setShowMobileImport(true) },
                  { label: "Set New Fees", icon: "add", run: () => setShowFeeModal(true), id: "set-new-fees" },
                ].map((item) => (
                  <button
                    key={item.label}
                    id={item.id}
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setShowHeaderMenu(false);
                      item.run();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 min-h-[44px] text-left text-sm font-medium text-on-surface hover:bg-surface-container"
                  >
                    <MaterialIcon icon={item.icon} className="text-[18px] text-on-surface-variant" />
                    {item.label}
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )}

        {/*
          The money story, told once. This used to be rendered four separate
          times (FinanceSummaryPulse, a 4-pill grid, FeeStats' cards and the
          sticky list bar), each with its own rounding, so the same number
          appeared in several places and none of them agreed.
        */}
        <section
          aria-label="Term position"
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-container-lowest)] overflow-hidden"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
            {[
              { label: "Expected", value: partition.totalExpected, tone: "text-[var(--t1)]" },
              { label: "Collected", value: partition.totalPaid, tone: "text-[var(--green)]" },
              { label: "Outstanding", value: partition.totalBalance, tone: "text-[var(--red)]" },
            ].map((cell, i) => (
              <div key={cell.label} className="px-4 sm:px-5 py-4">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-[var(--t3)]">{cell.label}</div>
                <div className={`mt-1.5 text-xl sm:text-2xl font-extrabold tabular-nums leading-none ${cell.tone}`}>
                  {formatCurrency(cell.value)}
                </div>
                {i === 0 && partition.billed < partition.roster && (
                  <div className="mt-1.5 text-xs text-[var(--t3)] tabular-nums">
                    {partition.billed} of {partition.roster} pupils billed
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="px-4 sm:px-5 py-3 bg-[var(--surface-container-low)] border-t border-[var(--border)]">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--t2)]">
                {partition.realizationRate}% collected
              </span>
              <span className="text-xs text-[var(--t3)] tabular-nums">
                {partition.cleared} cleared · {partition.partial + partition.owing} still owing
              </span>
            </div>
            <div
              className="h-2 w-full rounded-full bg-[var(--surface-container)] overflow-hidden"
              role="progressbar"
              aria-valuenow={partition.realizationRate}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Fees collected"
            >
              <div
                className="h-full rounded-full bg-[var(--green)] transition-all duration-700"
                style={{ width: `${Math.min(100, Math.max(0, partition.realizationRate))}%` }}
              />
            </div>
          </div>
        </section>

        <OwlyTrigger guideId="fees" label="How do I manage fees?" className="mb-4" />

        {/*
          One tab row. Balances, Payments and Fee Structure used to be a second
          tab bar nested inside the first, so the screen had two "where am I"
          indicators and the list sat three quarters of a way down the page.
        */}
        <div className="flex gap-1 p-1 bg-[var(--surface-container-low)] rounded-xl mb-5 overflow-x-auto">
          {FINANCE_TABS.map((t) => {
            const active =
              t.id === "balances"
                ? tab === "balances" && balanceSubTab === "balances"
                : t.id === "payments"
                  ? tab === "balances" && balanceSubTab === "payments"
                  : t.id === "structure"
                    ? tab === "balances" && balanceSubTab === "structure"
                    : tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  if (t.id === "balances" || t.id === "payments" || t.id === "structure") {
                    setTab("balances");
                    setBalanceSubTab(t.id);
                  } else {
                    setTab(t.id as FinanceTab);
                  }
                }}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap inline-flex items-center gap-1.5 ${
                  active ? "bg-[var(--surface)] text-[var(--t1)] shadow-sm" : "text-[var(--t3)] hover:text-[var(--t2)]"
                }`}
              >
                {t.label}
                {t.id === "claims" && pendingClaims.length > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-[var(--primary)] text-white text-xs font-bold flex items-center justify-center">
                    {pendingClaims.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === "balances" && (
          <>
            <FeeStats
              stats={partition}
              paymentsCount={completePayments.length}
              onFilter={(status) =>
                setStatusFilter(
                  status === "unpaid" || status === "paid" || status === "partial" || status === "unbilled"
                    ? status
                    : "all",
                )
              }
              activeFilter={statusFilter === "written_off" ? "all" : statusFilter}
              onSetFees={() => setShowFeeModal(true)}
            />

            <div className="dashboard-toolbar mb-6">
              <div className="flex flex-col lg:flex-row gap-4 items-center">
                <div className="relative w-full lg:flex-1">
                  <MaterialIcon
                    icon="search"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search by name or student number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-surface-container-lowest border-none rounded-xl py-3 pl-12 pr-4 text-base font-medium focus:ring-2 focus:ring-primary/20 transition-all min-h-[44px]"
                  />
                </div>
                <div className="flex gap-3 w-full lg:w-auto overflow-x-auto no-scrollbar">
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-sm font-bold text-primary cursor-pointer min-w-[140px] min-h-[44px]"
                  >
                    <option value="all">All Classes</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.stream ? ` ${c.stream}` : ""}
                      </option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-sm font-bold text-primary cursor-pointer min-w-[150px] min-h-[44px]"
                  >
                    <option value="all">All Statuses</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                    <option value="written_off">Written Off</option>
                    <option value="unbilled">No fee structure</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setHideCleared((v) => !v)}
                    aria-pressed={hideCleared}
                    title={hideCleared ? "Show cleared pupils too" : "Show only pupils who owe"}
                    className={`rounded-xl px-4 text-sm font-bold cursor-pointer min-h-[44px] whitespace-nowrap border-none transition-colors ${
                      hideCleared ? "bg-[var(--primary)] text-white" : "bg-surface-container-lowest text-primary"
                    }`}
                  >
                    {hideCleared ? `Owing (${filteredBalances.length})` : `All (${filteredBalances.length})`}
                  </button>
                </div>
              </div>
            </div>
            {(searchTerm || selectedClass !== "all" || statusFilter !== "all") && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {searchTerm && (
                  <span className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-[var(--primary-50)] border border-[var(--primary-200)] text-xs font-medium text-[var(--primary-700)]">
                    Search: “{searchTerm}”{" "}
                    <button
                      onClick={() => setSearchTerm("")}
                      className="w-5 h-5 rounded-full bg-white/70 hover:bg-white flex items-center justify-center"
                    >
                      <MaterialIcon icon="close" className="text-[14px]" />
                    </button>
                  </span>
                )}
                {selectedClass !== "all" && (
                  <span className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-[var(--primary-50)] border border-[var(--primary-200)] text-xs font-medium text-[var(--primary-700)]">
                    Class: {classes.find((c) => c.id === selectedClass)?.name || selectedClass}{" "}
                    <button
                      onClick={() => setSelectedClass("all")}
                      className="w-5 h-5 rounded-full bg-white/70 hover:bg-white flex items-center justify-center"
                    >
                      <MaterialIcon icon="close" className="text-[14px]" />
                    </button>
                  </span>
                )}
                {statusFilter !== "all" && (
                  <span className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-[var(--primary-50)] border border-[var(--primary-200)] text-xs font-medium text-[var(--primary-700)]">
                    Status: {statusFilter}{" "}
                    <button
                      onClick={() => setStatusFilter("all")}
                      className="w-5 h-5 rounded-full bg-white/70 hover:bg-white flex items-center justify-center"
                    >
                      <MaterialIcon icon="close" className="text-[14px]" />
                    </button>
                  </span>
                )}
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedClass("all");
                    setStatusFilter("all");
                    setBandFilter(null);
                    setHideCleared(true);
                  }}
                  className="text-xs font-semibold text-[var(--primary)] hover:underline ml-1"
                >
                  Clear all
                </button>
              </div>
            )}

            {balanceSubTab === "balances" &&
              (filteredBalances.length === 0 ? (
                <EmptyState
                  icon="account_balance"
                  title="No student balances"
                  description="Add students and fee structures to see balances"
                  owlyQuestion="How do I set up fees and record the first payment?"
                />
              ) : (
                <>
                  {/*
                    Scope bar. Sticky because the bursar filters while scrolling
                    a long debtor list, and it answers "what am I looking at"
                    for the CURRENT filter — not the whole school, which the
                    hero above already covers.
                  */}
                  <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-[var(--bg)]/95">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 shadow-sm text-sm">
                      <span className="text-[var(--t3)] text-xs font-black uppercase tracking-[0.16em]">
                        {filteredBalances.length === studentBalances.length ? "Showing" : "Filtered to"}
                      </span>
                      <span className="text-[var(--t2)]">
                        Expected{" "}
                        <strong className="tabular-nums text-[var(--t1)]">
                          {formatCurrency(filteredTotals.expected)}
                        </strong>
                      </span>
                      <span className="text-[var(--t2)]">
                        Collected{" "}
                        <strong className="tabular-nums text-[var(--green)]">
                          {formatCurrency(filteredTotals.paid)}
                        </strong>
                      </span>
                      <span className="font-bold tabular-nums text-[var(--red)]">
                        Balance {formatCurrency(filteredTotals.balance)}
                      </span>
                      <span className="ml-auto text-xs font-semibold text-[var(--t3)] tabular-nums">
                        {filteredBalances.length} of {studentBalances.length} pupils · {filteredCollectionPct}%
                        collected
                      </span>
                    </div>
                  </div>

                  {/*
                    Arrears distribution. Doubles as the follow-up control: tap a
                    band to narrow the list to it. Sorted by value so the bands
                    read as a descending scale rather than an arbitrary order.
                  */}
                  <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3 mb-2.5">
                      <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--t3)]">
                        Who owes what
                      </span>
                      {bandFilter && (
                        <button
                          type="button"
                          onClick={() => setBandFilter(null)}
                          className="text-xs font-bold text-[var(--primary)] hover:underline"
                        >
                          Clear band
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      {[...triageBands]
                        .sort((a, b) => b.min - a.min)
                        .map((band) => {
                          const active = bandFilter === band.id;
                          const empty = band.count === 0;
                          return (
                            <button
                              key={band.id}
                              type="button"
                              disabled={empty}
                              onClick={() => setBandFilter(active ? null : band.id)}
                              aria-pressed={active}
                              className={`relative overflow-hidden rounded-xl border px-3 py-2.5 min-h-[72px] text-left transition-colors disabled:opacity-40 ${
                                active
                                  ? "border-[var(--primary)] bg-[var(--primary)]/[0.06]"
                                  : "border-[var(--border)] hover:bg-[var(--surface-container-low)]"
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className="absolute inset-x-0 bottom-0 h-1 bg-[var(--red)]"
                                style={{ width: `${band.widthPct}%` }}
                              />
                              <span className="block text-xs font-bold uppercase tracking-wider text-[var(--t3)]">
                                {band.label}
                              </span>
                              <span className="mt-1 block text-lg font-extrabold tabular-nums leading-none text-[var(--t1)]">
                                {band.count}
                              </span>
                              <span className="mt-0.5 block text-xs tabular-nums text-[var(--t3)]">
                                {formatCurrency(band.total)}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  <FeeTable
                    balances={filteredBalances}
                    recordedByName={recordedByName}
                    onViewReceipt={handleViewReceipt}
                  />
                </>
              ))}

            {balanceSubTab === "payments" && (
              <>
                <FeePaymentHistory
                  payments={payments}
                  students={students}
                  formatCurrency={formatCurrency}
                  onDeletePayment={handleDeletePayment}
                  onRecordPayment={openPaymentModal}
                />
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-[var(--t3)]">
                    Showing {offset + 1} to {Math.min(offset + itemsPerPage, paymentsTotalCount)} of{" "}
                    {paymentsTotalCount} payments
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setPaymentsPage((p) => Math.max(1, p - 1))}
                      disabled={paymentsPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setPaymentsPage((p) => p + 1)}
                      disabled={offset + itemsPerPage >= paymentsTotalCount}
                    >
                      Next
                    </Button>
                  </div>
                </div>
                <FeeAdjustmentsList
                  adjustments={adjustments}
                  students={students}
                  formatCurrency={formatCurrency}
                  onDeleteAdjustment={handleDeleteAdjustment}
                  onAddAdjustment={() => setShowAdjustmentModal(true)}
                />
              </>
            )}

            {balanceSubTab === "structure" && (
              <FeeStructureManager
                feeStructure={feeStructure}
                paginatedFeeStructure={paginatedFeeStructure}
                formatCurrency={formatCurrency}
                onDeleteFee={handleDeleteFee}
                onEditFee={handleEditFee}
                onAddFee={() => {
                  // Default the new fee to the class being viewed.
                  //
                  // The form's first option is school-wide, so without this a
                  // bursar working inside one class added a fee and it silently
                  // applied to every class in the school -- which is why the fee
                  // table is mostly "All Classes". School-wide is still
                  // available, but it now has to be chosen on purpose.
                  if (selectedClass !== "all") {
                    setNewFee((prev) => ({ ...prev, class_id: selectedClass }));
                  }
                  setShowFeeModal(true);
                }}
                feePage={feePage}
                feeTotalPages={feeTotalPages}
                setFeePage={setFeePage}
              />
            )}
          </>
        )}

        {tab === "payment-plans" && (
          <FeePaymentPlans
            plans={plans}
            activePlanCount={activePlanCount}
            completedPlanCount={completedPlanCount}
            totalOutstanding={totalOutstanding}
            formatCurrency={formatCurrency}
            showCreatePlan={showCreatePlan}
            setShowCreatePlan={setShowCreatePlan}
            newPlan={newPlan}
            setNewPlan={setNewPlan}
            planStudents={planStudents}
            createPlan={createPlan}
            selectedPlan={selectedPlan}
            setSelectedPlan={setSelectedPlan}
            installments={installments}
            markInstallmentPaid={markInstallmentPaid}
            plansLoading={plansLoading}
          />
        )}

        {tab === "invoices" && (
          <FeeInvoiceList
            invoiceStats={invoiceStats}
            formatCurrency={formatCurrency}
            classes={classes}
            invoiceClassFilter={invoiceClassFilter}
            setInvoiceClassFilter={setInvoiceClassFilter}
            filteredInvoices={filteredInvoices}
            printInvoice={printInvoice}
            sendInvoiceSMS={sendInvoiceSMS}
          />
        )}

        {tab === "claims" && (
          <div className="max-w-2xl">
            <PaymentClaimsPanel
              claims={pendingClaims}
              loading={claimsLoading}
              onReview={reviewClaim}
              busyId={reviewingClaimId}
            />
          </div>
        )}

        {tab === "cashbook" && (
          <FeeCashbook
            cashbookSummary={cashbookSummary}
            formatCurrency={formatCurrency}
            cashbookDateFilter={cashbookDateFilter}
            setCashbookDateFilter={setCashbookDateFilter}
            exportCashbookCSV={exportCashbookCSV}
            filteredCashbookPayments={filteredCashbookPayments}
          />
        )}

        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          students={studentBalances.map((s) => ({
            id: s.id,
            name: s.name,
            balance: s.balance,
            student_number: s.student_number,
            class_name: s.class_name,
          }))}
          parentNamesByStudent={parentNamesByStudent}
          fees={paymentFees}
          defaultFeeId={paymentDefaultFeeId}
          feeId={newPayment.fee_id}
          onFeeChange={(feeId) => setNewPayment((prev) => ({ ...prev, fee_id: feeId }))}
          onSubmit={handleRecordPayment}
          newPayment={newPayment}
          onPaymentChange={handlePaymentChange}
          saving={saving}
        />

        <ReceiptPrompt
          isOpen={showReceiptPrompt}
          studentName={selectedStudent?.name}
          amount={recordedPaymentAmount}
          parentPhone={receiptParentPhone}
          onSendWhatsApp={sendReceiptWhatsApp}
          onSendSms={sendReceiptSms}
          onViewReceipt={() => {
            setShowReceiptPrompt(false);
            setShowReceiptModal(true);
          }}
          onDismiss={() => setShowReceiptPrompt(false)}
        />

        <ReceiptModal
          isOpen={showReceiptModal}
          student={selectedStudent}
          schoolName={school?.name || "School"}
          onClose={() => setShowReceiptModal(false)}
          onPrint={handlePrintReceipt}
          paymentDate={recordedPaymentDate}
          paymentAmount={recordedPaymentAmount}
          receiptNumber={recordedReceiptNumber}
          schoolDetails={{
            phone: school?.phone ?? undefined,
            email: school?.email ?? undefined,
            code: school?.school_code ?? undefined,
            logoUrl: school?.logo_url ?? undefined,
            color: school?.primary_color ?? undefined,
          }}
          contentRef={receiptRef}
        />

        <FeeFormModal
          isOpen={showFeeModal}
          onClose={() => {
            setShowFeeModal(false);
            setEditingFeeId(null);
          }}
          classes={classes}
          classesLoading={classesLoading}
          onSubmit={handleCreateFee}
          newFee={newFee}
          onFeeChange={handleNewFeeChange}
          saving={saving}
          isEditing={Boolean(editingFeeId)}
          draftLastSaved={feeDraft.lastSaved}
          draftIsDirty={feeDraft.isDirty}
        />

        <FeeImportModal
          isOpen={showFeeImport}
          onClose={() => setShowFeeImport(false)}
          classes={classes}
          academicYear={academicYear}
          defaultTerm={currentTerm || 1}
          existingFees={feeStructure}
          createFeeStructure={createFeeStructure}
          onComplete={refetchFeeStructure}
        />

        <MobileMoneyImportModal
          isOpen={showMobileImport}
          onClose={() => setShowMobileImport(false)}
          students={students ?? []}
          fees={mobileFeeOptions}
          defaultFeeId={mobileDefaultFeeId}
          createPayment={createPayment}
          onComplete={refetchPayments}
        />

        <AdjustmentModal
          isOpen={showAdjustmentModal}
          onClose={() => setShowAdjustmentModal(false)}
          students={studentBalances.map((s) => ({
            id: s.id,
            name: s.name,
            balance: s.balance,
          }))}
          onSubmit={handleCreateAdjustment}
          newAdjustment={newAdjustment}
          onAdjustmentChange={handleAdjustmentChange}
          saving={saving}
        />

        <InvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          students={studentBalances.map((s) => ({
            id: s.id,
            name: s.name,
            student_number: s.student_number,
            class_name: s.class_name,
            class_id: s.class_id,
            balance: s.balance,
            expected: s.expected ?? 0,
            paid: s.paid ?? 0,
            payments: s.payments || [],
            adjustments: s.adjustments || [],
          }))}
          selectedStudent={selectedStudent}
          onSelectStudent={handleGenerateInvoice}
          onPrintInvoice={handlePrintInvoice}
        />

        {feeDraft.showRestoreDialog && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
            <div aria-hidden="true" className="absolute inset-0 bg-black/50 backdrop-blur-none" />
            {/* relative is load-bearing: without it this static panel paints
                UNDER the absolute backdrop above, dimming the dialog and
                swallowing every click (dead Discard/Restore buttons). */}
            <div className="relative bg-surface-container-lowest rounded-2xl w-full max-w-sm p-6 max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto shadow-xl my-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MaterialIcon icon="restore" className="text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-on-surface">Restore Draft?</h3>
                  <p className="text-sm text-on-surface-variant">You have an unsaved fee form</p>
                </div>
              </div>
              <p className="text-sm text-on-surface-variant mb-6">
                Would you like to restore your previous draft from {feeDraft.lastSaved?.toLocaleTimeString()}?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={feeDraft.discardDraft}
                  className="flex-1 py-3 bg-surface-container font-semibold rounded-xl text-on-surface-variant"
                >
                  Discard
                </button>
                <button
                  onClick={() => {
                    setNewFee(feeDraft.savedDraft as typeof newFee);
                    feeDraft.restoreDraft();
                  }}
                  className="flex-1 py-3 bg-primary text-white font-semibold rounded-xl"
                >
                  Restore
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          isOpen={confirmDelete?.type === "payment"}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => confirmDelete && executeDeletePayment(confirmDelete.id)}
          title="Delete Payment"
          message="Are you sure you want to delete this payment? This action can be undone."
          confirmLabel="Delete"
          loading={deleting}
          variant="danger"
        />

        <ConfirmDialog
          isOpen={confirmDelete?.type === "fee"}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => confirmDelete && executeDeleteFee(confirmDelete.id)}
          title="Delete Fee Structure"
          message="Are you sure you want to delete this fee structure? This action can be undone."
          confirmLabel="Delete"
          loading={deleting}
          variant="danger"
        />

        <ConfirmDialog
          isOpen={confirmDelete?.type === "adjustment"}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => confirmDelete && executeDeleteAdjustment(confirmDelete.id)}
          title="Delete Adjustment"
          message="Are you sure you want to delete this fee adjustment? This action can be undone."
          confirmLabel="Delete"
          loading={deleting}
          variant="danger"
        />

        <UndoNotification
          actions={undo.pendingActions}
          onUndo={(id) => {
            const action = undo.pendingActions.find((a) => a.id === id);
            if (action) action.undo();
          }}
        />
      </div>
    </PageErrorBoundary>
  );
}
