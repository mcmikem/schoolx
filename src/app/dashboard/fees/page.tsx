"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";

// NOTE: If your school uses fee_terms as the primary system, this fees page
// uses fee_structure instead. The fee_terms module at /dashboard/fee-terms is
// legacy and kept for backward compatibility only. See the deprecation notice
// in fee-terms/page.tsx for details.
import {
  useClasses,
  useFeeAdjustments,
  useFeePayments,
  useFeeStructure,
} from "@/lib/hooks";
import { useOfflineStudents, useOfflineFees } from "@/lib/offline-hooks";
import { useToast } from "@/components/Toast";
import { useFormDraft } from "@/lib/useAutoSave";
import { PAYMENT_METHODS } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import FeeStats from "@/components/fees/FeeStats";
import { StudentBalance } from "@/components/fees/FeeTable";
import FeeTable from "@/components/fees/FeeTable";
import PaymentModal from "@/components/fees/PaymentModal";
import FeeFormModal from "@/components/fees/FeeFormModal";
import ReceiptModal from "@/components/fees/ReceiptModal";
import InvoiceModal from "@/components/fees/InvoiceModal";
import AdjustmentModal from "@/components/fees/AdjustmentModal";
import FeePaymentHistory from "@/components/fees/FeePaymentHistory";
import FeeAdjustmentsList from "@/components/fees/FeeAdjustmentsList";
import FeeStructureManager from "@/components/fees/FeeStructureManager";
import FeePaymentPlans from "@/components/fees/FeePaymentPlans";
import FeeInvoiceList from "@/components/fees/FeeInvoiceList";
import FeeCashbook from "@/components/fees/FeeCashbook";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/index";
import FinanceSummaryPulse from "@/components/fees/FinanceSummaryPulse";
import { calculateStudentFeePosition } from "@/lib/operations";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useUndo, UndoNotification } from "@/lib/useUndo";
import { PageGuidance } from "@/components/PageGuidance";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { getErrorMessage } from "@/lib/validation";
import { APP_NAME } from "@/lib/app-name";

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

type FinanceTab = "balances" | "payment-plans" | "invoices" | "cashbook";

const MAX_FINANCE_AMOUNT = 100_000_000;

export default function FinanceHubPage() {
  const { school, isDemo, user } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const toast = useToast();
  const searchParams = useSearchParams();

  const [paymentsPage, setPaymentsPage] = useState(1);
  const itemsPerPage = 50;

  const {
    data: students,
    loading: studentsLoading,
    error: studentsError,
  } = useOfflineStudents(school?.id);

  const offset = (paymentsPage - 1) * itemsPerPage;
  const {
    data: payments,
    loading: paymentsLoading,
    error: paymentsError,
    totalCount: paymentsTotalCount,
  } = useOfflineFees(school?.id, { limit: itemsPerPage, offset });

  const { classes, loading: classesLoading } = useClasses(school?.id);
  const {
    feeStructure,
    createFeeStructure,
    deleteFeeStructure,
    refetch: refetchFeeStructure,
  } = useFeeStructure(school?.id);
  const { adjustments, createAdjustment, deleteAdjustment } = useFeeAdjustments(
    school?.id,
  );
  const { createPayment, deletePayment } = useFeePayments(school?.id);
  const receiptRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<FinanceTab>("balances");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "payment" | "fee" | "adjustment";
    id: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const undo = useUndo();
  const [selectedStudent, setSelectedStudent] = useState<StudentBalance | null>(
    null,
  );
  const [selectedClass, setSelectedClass] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "unpaid" | "partial" | "paid" | "written_off"
  >("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [balanceSubTab, setBalanceSubTab] = useState("balances");

  useKeyboardShortcuts([
    {
      key: "n",
      ctrl: true,
      action: () => setShowPaymentModal(true),
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
  const [newFee, setNewFee] = useState({
    name: "",
    class_id: "",
    amount: "",
    term: currentTerm || 1,
    due_date: "",
  });

  const [newPayment, setNewPayment] = useState<{
    student_id: string;
    amount_paid: string;
    payment_method: "cash" | "mobile_money" | "bank" | "installment";
    payment_reference: string;
    momo_provider: "mtn" | "airtel";
    momo_transaction_id: string;
    paid_by: string;
    notes: string;
  }>({
    student_id: "",
    amount_paid: "",
    payment_method: PAYMENT_METHODS.CASH,
    payment_reference: "",
    momo_provider: "mtn" as const,
    momo_transaction_id: "",
    paid_by: "",
    notes: "",
  });

  const [newAdjustment, setNewAdjustment] = useState<{
    student_id: string;
    adjustment_type:
      | "discount"
      | "scholarship"
      | "penalty"
      | "manual_credit"
      | "write_off"
      | "bursary";
    amount: string;
    description: string;
  }>({
    student_id: "",
    adjustment_type: "bursary",
    amount: "",
    description: "",
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

  const [feePage, setFeePage] = useState(1);
  const feesPerPage = 10;
  const feeOffset = (feePage - 1) * feesPerPage;
  const feeTotalPages = Math.max(
    1,
    Math.ceil(feeStructure.length / feesPerPage),
  );

  useEffect(() => {
    setFeePage(1);
  }, [school?.id]);

  useEffect(() => {
    if (
      feeStructure.length > 0 &&
      feePage > Math.ceil(feeStructure.length / feesPerPage)
    ) {
      setFeePage(1);
    }
  }, [feeStructure.length, feePage, feesPerPage]);

  const paginatedFeeStructure = feeStructure.slice(
    feeOffset,
    feeOffset + feesPerPage,
  );

  const [invoiceClassFilter, setInvoiceClassFilter] = useState("all");
  const [cashbookDateFilter, setCashbookDateFilter] = useState("today");

  useEffect(() => {
    const requestedTab = searchParams?.get("tab");
    if (
      requestedTab === "balances" ||
      requestedTab === "payment-plans" ||
      requestedTab === "invoices" ||
      requestedTab === "cashbook"
    ) {
      setTab(requestedTab);
    }
  }, [searchParams]);

  const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;

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

  const paymentsByStudent = useMemo(() => {
    const map = new Map<string, typeof payments>();
    payments.forEach((p) => {
      if (!map.has(p.student_id)) map.set(p.student_id, []);
      map.get(p.student_id)!.push(p);
    });
    return map;
  }, [payments]);

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
      const key = f.class_id;
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
        ...(feesByClass.get(studentClassId ?? null) || []),
      ];
      const studentAdjustments = adjustmentsByStudent.get(student.id) || [];
      const feePosition = calculateStudentFeePosition({
        feeTotal: applicableFees.reduce(
          (sum, f) => sum + Number(f.amount || 0),
          0,
        ),
        payments: studentPayments,
        adjustments: studentAdjustments,
        openingBalance: Number(student.opening_balance || 0),
      });

      return {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        student_number: student.student_number || "",
        class_name: student.classes?.name
          ? `${student.classes.name}${student.classes.stream ? ` ${student.classes.stream}` : ""}`
          : "",
        expected: feePosition.totalExpected,
        paid: feePosition.totalPaid,
        balance: feePosition.balance,
        status: feePosition.status,
        payments: studentPayments.map((p) => ({
          id: p.id,
          amount: Number(p.amount_paid),
          method: p.payment_method,
          reference: p.payment_reference || "",
          date: p.payment_date,
        })),
        adjustments: studentAdjustments.map((a) => ({
          id: a.id,
          adjustment_type: a.adjustment_type,
          amount: Number(a.amount),
          description: a.notes || "",
        })),
      };
    },
    [paymentsByStudent, adjustmentsByStudent, feesByClass],
  );

  const studentBalanceMap = useMemo(() => {
    const map = new Map<string, StudentBalance>();
    students.forEach((s) => {
      map.set(s.id, computeStudentBalance(s));
    });
    return map;
  }, [students, computeStudentBalance]);

  const studentBalances: StudentBalance[] = useMemo(() => {
    return students.map((s) => studentBalanceMap.get(s.id)!);
  }, [students, studentBalanceMap]);

  const filteredBalances = useMemo(() => {
    return studentBalances
      .filter((s) => {
        const matchesSearch =
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.student_number.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesClass =
          selectedClass === "all" || s.class_name === selectedClass;
        const matchesStatus =
          statusFilter === "all" || s.status === statusFilter;
        return matchesSearch && matchesClass && matchesStatus;
      })
      .sort((a, b) => b.balance - a.balance);
  }, [studentBalances, searchTerm, selectedClass, statusFilter]);

  const stats = useMemo(() => {
    const totalExpected = studentBalances.reduce(
      (sum, s) => sum + s.expected,
      0,
    );
    const totalPaid = studentBalances.reduce((sum, s) => sum + s.paid, 0);
    const totalBalance = studentBalances.reduce((sum, s) => sum + s.balance, 0);
    const fullyPaid = studentBalances.filter((s) => s.balance === 0).length;
    const partialPaid = studentBalances.filter(
      (s) => s.paid > 0 && s.balance > 0,
    ).length;
    const notPaid = studentBalances.filter((s) => s.paid === 0).length;
    const momoPayments = payments.filter(
      (p) => p.payment_method === "mobile_money",
    );
    const momoTotal = momoPayments.reduce(
      (sum, p) => sum + Number(p.amount_paid),
      0,
    );
    const cashTotal = payments
      .filter((p) => p.payment_method === "cash")
      .reduce((sum, p) => sum + Number(p.amount_paid), 0);
    const bankTotal = payments
      .filter((p) => p.payment_method === "bank")
      .reduce((sum, p) => sum + Number(p.amount_paid), 0);
    return {
      totalExpected,
      totalPaid,
      totalBalance,
      fullyPaid,
      partialPaid,
      notPaid,
      momoTotal,
      cashTotal,
      bankTotal,
    };
  }, [studentBalances, payments]);

  const invoices = useMemo(() => {
    return students.map((student) => {
      const studentFeeItems = feeStructure.filter(
        (f) => !f.class_id || f.class_id === student.class_id,
      );
      const feeItems = studentFeeItems.map((f) => ({
        name: f.name,
        amount: Number(f.amount),
      }));
      const totalAmount = feeItems.reduce((sum, f) => sum + f.amount, 0);
      const amountPaid = payments
        .filter((p) => p.student_id === student.id)
        .reduce((sum, p) => sum + Number(p.amount_paid), 0);
      return {
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        student_number: student.student_number || "",
        class_name: student.classes?.name || "",
        fee_items: feeItems,
        total_amount: totalAmount,
        amount_paid: amountPaid,
        balance: Math.max(0, totalAmount - amountPaid),
        class_id: student.class_id ?? "",
      };
    });
  }, [students, feeStructure, payments]);

  const filteredInvoices = useMemo(() => {
    if (invoiceClassFilter === "all") return invoices;
    return invoices.filter((i) => i.class_id === invoiceClassFilter);
  }, [invoices, invoiceClassFilter]);

  const invoiceStats = useMemo(
    () => ({
      totalInvoiced: filteredInvoices.reduce(
        (sum, i) => sum + i.total_amount,
        0,
      ),
      totalCollected: filteredInvoices.reduce(
        (sum, i) => sum + i.amount_paid,
        0,
      ),
      totalBalance: filteredInvoices.reduce((sum, i) => sum + i.balance, 0),
      fullyPaid: filteredInvoices.filter((i) => i.balance === 0).length,
      hasBalance: filteredInvoices.filter((i) => i.balance > 0).length,
    }),
    [filteredInvoices],
  );

  const filteredCashbookPayments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return payments.filter((p) => {
      const paymentDate = new Date(p.payment_date);
      paymentDate.setHours(0, 0, 0, 0);
      if (cashbookDateFilter === "today") {
        return paymentDate.getTime() === today.getTime();
      } else if (cashbookDateFilter === "week") {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return paymentDate >= weekAgo;
      } else if (cashbookDateFilter === "month") {
        return (
          paymentDate.getMonth() === today.getMonth() &&
          paymentDate.getFullYear() === today.getFullYear()
        );
      }
      return true;
    });
  }, [payments, cashbookDateFilter]);

  const cashbookSummary = useMemo(() => {
    const cash = filteredCashbookPayments.filter(
      (p) => p.payment_method === "cash",
    );
    const momo = filteredCashbookPayments.filter(
      (p) => p.payment_method === "mobile_money",
    );
    const bank = filteredCashbookPayments.filter(
      (p) => p.payment_method === "bank",
    );
    return {
      total: filteredCashbookPayments.reduce(
        (sum, p) => sum + Number(p.amount_paid),
        0,
      ),
      cash: cash.reduce((sum, p) => sum + Number(p.amount_paid), 0),
      momo: momo.reduce((sum, p) => sum + Number(p.amount_paid), 0),
      bank: bank.reduce((sum, p) => sum + Number(p.amount_paid), 0),
      count: filteredCashbookPayments.length,
    };
  }, [filteredCashbookPayments]);

  const activePlanCount = plans.filter((p) => p.status === "active").length;
  const completedPlanCount = plans.filter(
    (p) => p.status === "completed",
  ).length;
  const totalOutstanding = plans
    .filter((p) => p.status === "active")
    .reduce((sum, p) => {
      const planInstallments = installments.filter(
        (i) => i.plan_id === p.id && !i.paid,
      );
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
      toast.error(
        "Payment amount seems too large. Please check and try again.",
      );
      return;
    }
    try {
      setSaving(true);
      let reference = newPayment.payment_reference;
      if (
        newPayment.payment_method === PAYMENT_METHODS.MOBILE_MONEY &&
        newPayment.momo_transaction_id
      ) {
        reference = `${newPayment.momo_provider.toUpperCase()}-${newPayment.momo_transaction_id}`;
      }
      const paymentResult = await createPayment({
        student_id: newPayment.student_id,
        amount_paid: parsedAmount,
        payment_method: newPayment.payment_method,
        payment_reference: reference || undefined,
        paid_by: newPayment.paid_by || undefined,
        notes: newPayment.notes || undefined,
      });

      if (!isDemo && school?.id && paymentResult?.id) {
        const { data: lastReceipt } = await supabase
          .from("receipts")
          .select("receipt_number")
          .eq("school_id", school.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastNum = lastReceipt?.receipt_number
          ? parseInt(lastReceipt.receipt_number.replace("RCP-", ""), 10) || 0
          : 0;
        const receiptNumber = `RCP-${String(lastNum + 1).padStart(6, "0")}`;

        await supabase.from("receipts").insert({
          school_id: school.id,
          student_id: newPayment.student_id,
          payment_id: paymentResult.id,
          receipt_number: receiptNumber,
          amount: parsedAmount,
          issued_at: new Date().toISOString(),
        });
      }

      const student = studentBalances.find(
        (s) => s.id === newPayment.student_id,
      );
      if (student) {
        setSelectedStudent({
          ...student,
          paid: student.paid + parsedAmount,
          balance: Math.max(0, student.balance - parsedAmount),
        });
        setShowReceiptModal(true);
      }
      toast.success("Payment recorded successfully");
      setShowPaymentModal(false);
      setNewPayment({
        student_id: "",
        amount_paid: "",
        payment_method: "cash",
        payment_reference: "",
        momo_provider: "mtn",
        momo_transaction_id: "",
        paid_by: "",
        notes: "",
      });
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to record payment",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (user?.role === 'bursar') {
      toast.error("Bursars cannot delete payments. Please contact the Headmaster.");
      return;
    }
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
      toast.error(
        err instanceof Error ? err.message : "Failed to delete payment",
      );
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
      await createFeeStructure({
        name: newFee.name,
        class_id: newFee.class_id || undefined,
        amount: Number(newFee.amount),
        term: Number(newFee.term),
        academic_year: academicYear,
        due_date: newFee.due_date || undefined,
      });
      toast.success("Fee structure created");
      setShowFeeModal(false);
      feeDraft.clearSaved();
      setNewFee({
        name: "",
        class_id: "",
        amount: "",
        term: currentTerm || 1,
        due_date: "",
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create fee");
    } finally {
      setSaving(false);
    }
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
      iframe.style.cssText =
        "position:absolute;width:0;height:0;border:none;overflow:hidden;";
      document.body.appendChild(iframe);
    }

    const onLoad = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        toast.error("Printing failed. Please use Ctrl+P/Cmd+P instead.");
      }
      iframe.removeEventListener("load", onLoad);
    };
    iframe.addEventListener("load", onLoad);
    iframe.srcdoc = html;
  };

  const handlePrintReceipt = () => {
    if (receiptRef.current) {
      const printContent = receiptRef.current.innerHTML;
      const logoUrl = school?.logo_url || "";
      const schoolName = school?.name || "School";
      const schoolColor = school?.primary_color || "#002045";
      const escapeHtml = (s: string) =>
        String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      const html = `
          <html><head><title>Fee Receipt</title><style>
          body{font-family:Arial,sans-serif;padding:20px;max-width:400px;margin:0 auto}
          .header{text-align:center;border-bottom:2px solid ${schoolColor};padding-bottom:15px;margin-bottom:15px}
          .logo{max-width:80px;max-height:60px;margin-bottom:10px}
          .school-name{font-size:20px;font-weight:bold;color:${schoolColor};margin:5px 0}
          .school-info{font-size:11px;color:#666;margin-bottom:5px}
          .receipt-title{font-size:14px;color:#666;margin-top:5px;font-weight:bold}
          .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #ddd}
          .label{color:#666;font-size:13px}
          .value{font-weight:bold;font-size:13px}
          .total{font-size:16px;border-top:2px solid ${schoolColor};margin-top:10px;padding-top:10px;font-weight:bold}
          .footer{text-align:center;margin-top:25px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:15px}
          .thank-you{font-weight:bold;color:${schoolColor};margin-bottom:5px}
        </style></head><body>
          <div class="header">
            ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" class="logo" alt="${escapeHtml(schoolName)}">` : ""}
            <div class="school-name">${escapeHtml(schoolName)}</div>
            <div class="school-info">Tel: ${escapeHtml(school?.phone || "")} | Email: ${escapeHtml(school?.email || "")}</div>
            <div class="receipt-title">OFFICIAL RECEIPT</div>
          </div>
          ${printContent}
          <div class="footer">
            <div class="thank-you">Thank you for your payment!</div>
            <div>Powered by ${APP_NAME}</div>
          </div>
        </body></html>`;

      let iframe = document.getElementById("print-iframe") as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "print-iframe";
        iframe.style.cssText =
          "position:absolute;width:0;height:0;border:none;overflow:hidden;";
        document.body.appendChild(iframe);
      }

      const onLoad = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
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

  const handlePaymentChange = (updates: Partial<typeof newPayment>) => {
    setNewPayment((prev) => ({ ...prev, ...updates }));
  };

  const handleAdjustmentChange = (updates: Partial<typeof newAdjustment>) => {
    setNewAdjustment((prev) => ({ ...prev, ...updates }));
  };

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !newAdjustment.student_id ||
      !newAdjustment.amount ||
      !newAdjustment.description.trim()
    ) {
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
      });
      toast.success("Adjustment recorded");
      setShowAdjustmentModal(false);
      setNewAdjustment({
        student_id: "",
        adjustment_type: "bursary",
        amount: "",
        description: "",
      });
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to record adjustment",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAdjustment = async (adjustmentId: string) => {
    if (user?.role === 'bursar') {
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
      toast.error(
        err instanceof Error ? err.message : "Failed to delete adjustment",
      );
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

    const installmentAmount = Math.round(
      newPlan.total_amount / newPlan.installments,
    );
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
      const { data: plan, error } = await supabase
        .from("payment_plans")
        .insert(planData)
        .select()
        .single();
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

      const { withTimeout, timeoutFallback } = await import('@/lib/hooks/utils');
      const installmentResult = await withTimeout(
        supabase
          .from("payment_plan_installments")
          .insert(installmentData),
        15000,
        timeoutFallback()
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
      const { withTimeout, timeoutFallback } = await import('@/lib/hooks/utils');
      const paymentResult = await withTimeout(
        supabase
          .from("payment_plan_installments")
          .update({ paid: true, paid_date: new Date().toISOString() })
          .eq("id", installmentId),
        15000,
        timeoutFallback()
      );
      const paymentError = paymentResult?.error;
      if (paymentError) throw paymentError;

      const updated = installments.map((i) =>
        i.id === installmentId ? { ...i, paid: true } : i,
      );
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
      iframe.style.cssText =
        "position:absolute;width:0;height:0;border:none;overflow:hidden;";
      document.body.appendChild(iframe);
    }

    const onLoad = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
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
      await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: student.parent_phone,
          message,
          schoolId: school?.id,
        }),
      });
      toast.success("Invoice sent via SMS");
    } catch {
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
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");
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
      const res = await fetch("/api/automation/auto-fee-reminder", {
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
    } catch {
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
            <div className="flex items-center gap-3 flex-wrap justify-start lg:justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowPaymentModal(true)}
              >
                <MaterialIcon icon="payments" />
                Add Payment
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAdjustmentModal(true)}
              >
                <MaterialIcon icon="tune" />
                Scholarship/Discount
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowCreatePlan(true)}
              >
                <MaterialIcon icon="event_note" />
                Pay in Bits
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowFeeModal(true)}
                className="shadow-md shadow-navy/20"
              >
                <MaterialIcon icon="add" />
                Set New Fees
              </Button>
            </div>
          }
        />

        <FinanceSummaryPulse
          totalExpected={stats.totalExpected}
          totalPaid={stats.totalPaid}
          totalBalance={stats.totalBalance}
          realizationRate={
            stats.totalExpected > 0
              ? Math.round((stats.totalPaid / stats.totalExpected) * 100)
              : 0
          }
          formatValue={(val) => formatCurrency(val).split(" ").pop() || "0"}
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Payments", value: `${payments.length}`, tone: "text-emerald-700 bg-emerald-50" },
            { label: "Active plans", value: `${activePlanCount}`, tone: "text-blue-700 bg-blue-50" },
            { label: "Classes", value: `${classes.length}`, tone: "text-amber-700 bg-amber-50" },
            { label: "Unpaid", value: `${stats.notPaid}`, tone: "text-rose-700 bg-rose-50" },
          ].map((item) => (
            <div key={item.label} className={`rounded-xl border border-[var(--border)] p-3 ${item.tone}`}>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] opacity-80">{item.label}</div>
              <div className="mt-1 text-lg font-bold">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="dashboard-toolbar">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--t3)] mb-1">
                Finance pulse
              </div>
              <div className="text-lg font-bold text-[var(--t1)]">
                Collections, arrears, and payment-plan activity in one cleaner
                workflow
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="dashboard-pill bg-emerald-50 text-emerald-700">
                {payments.length} payments
              </span>
              <span className="dashboard-pill bg-blue-50 text-blue-700">
                {activePlanCount} active plans
              </span>
              <span className="dashboard-pill bg-amber-50 text-amber-700">
                {classes.length} classes
              </span>
              <span className="dashboard-pill bg-rose-50 text-rose-700">
                {stats.notPaid} unpaid
              </span>
            </div>
          </div>
        </div>

        <PageGuidance
          title="How to Manage Fees"
          tips={[
            {
              icon: "account_balance",
              text: "Create Fee: Set up fee items (Tuition, Development, etc.) per class",
            },
            {
              icon: "payments",
              text: "Record Payment: Click a student's row to record payment received",
            },
            {
              icon: "receipt",
              text: "Get Receipt: After recording payment, click to print receipt",
            },
            {
              icon: "sms",
              text: "Send Reminders: Click 'Auto Fee Reminders' to SMS parents with balances",
            },
            {
              icon: "tune",
              text: "Adjustments: Use to add scholarships, fines, or corrections",
            },
          ]}
        />

        <div className="flex gap-1 p-1 bg-[var(--surface-container-low)] rounded-xl mb-6 overflow-x-auto">
          {[
            { id: "balances" as const, label: "Student Balances" },
            { id: "payment-plans" as const, label: "Paying in Bits" },
            { id: "invoices" as const, label: "Invoices" },
            { id: "cashbook" as const, label: "Daily Money Log" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                tab === t.id
                  ? "bg-[var(--surface)] text-[var(--t1)] shadow-sm"
                  : "text-[var(--t3)] hover:text-[var(--t2)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "balances" && (
          <>
            <FeeStats
              stats={stats}
              paymentsCount={payments.length}
              onFilter={(status) =>
                setStatusFilter(
                  status === "unpaid"
                    ? "unpaid"
                    : status === "paid"
                      ? "paid"
                      : status === "partial"
                        ? "partial"
                        : "all",
                )
              }
              activeFilter={
                statusFilter === "written_off" ? "all" : statusFilter
              }
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
                    className="w-full bg-surface-container-lowest border-none rounded-xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div className="flex gap-3 w-full lg:w-auto overflow-x-auto no-scrollbar">
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-xs font-bold text-primary cursor-pointer min-w-[140px]"
                  >
                    <option value="all">All Classes</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                        {c.stream ? ` ${c.stream}` : ""}
                      </option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as typeof statusFilter)
                    }
                    className="bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-xs font-bold text-primary cursor-pointer min-w-[150px]"
                  >
                    <option value="all">All Statuses</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                    <option value="written_off">Written Off</option>
                  </select>
                </div>
              </div>
            </div>

            <Tabs
              tabs={[
                { id: "balances", label: "Balances" },
                { id: "payments", label: "Payments" },
                { id: "structure", label: "Fee Structure" },
              ]}
              activeTab={balanceSubTab}
              onChange={(id) => {
                setBalanceSubTab(id);
                if (id === "structure") {
                  setShowFeeModal(true);
                }
              }}
              className="mb-6"
            />

            {balanceSubTab === "balances" && (
              filteredBalances.length === 0 ? (
                <div className="text-center py-12 text-on-surface-variant">
                  <MaterialIcon className="text-4xl text-on-surface-variant/30 mb-4">
                    account_balance
                  </MaterialIcon>
                  <h3 className="text-lg font-semibold text-on-surface mb-2">
                    No student balances
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    Add students and fee structures to see balances
                  </p>
                </div>
              ) : (
                <FeeTable
                  balances={filteredBalances}
                  onViewReceipt={handleViewReceipt}
                />
              )
            )}

            {balanceSubTab === "payments" && (
              <>
                <FeePaymentHistory
                  payments={payments}
                  students={students}
                  formatCurrency={formatCurrency}
                  onDeletePayment={handleDeletePayment}
                  onRecordPayment={() => setShowPaymentModal(true)}
                />
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-[var(--t3)]">
                    Showing {offset + 1} to {Math.min(offset + itemsPerPage, paymentsTotalCount)} of {paymentsTotalCount} payments
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
                onAddFee={() => setShowFeeModal(true)}
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
          }))}
          onSubmit={handleRecordPayment}
          newPayment={newPayment}
          onPaymentChange={handlePaymentChange}
          saving={saving}
        />

        <ReceiptModal
          isOpen={showReceiptModal}
          student={selectedStudent}
          schoolName={school?.name || "School"}
          onClose={() => setShowReceiptModal(false)}
          onPrint={handlePrintReceipt}
        />

        <FeeFormModal
          isOpen={showFeeModal}
          onClose={() => setShowFeeModal(false)}
          classes={classes}
          classesLoading={classesLoading}
          onSubmit={handleCreateFee}
          newFee={newFee}
          onFeeChange={handleNewFeeChange}
          saving={saving}
          draftLastSaved={feeDraft.lastSaved}
          draftIsDirty={feeDraft.isDirty}
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
            <div className="bg-surface-container-lowest rounded-2xl w-full max-w-sm p-6 max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto shadow-xl my-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MaterialIcon icon="restore" className="text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-on-surface">Restore Draft?</h3>
                  <p className="text-sm text-on-surface-variant">
                    You have an unsaved fee form
                  </p>
                </div>
              </div>
              <p className="text-sm text-on-surface-variant mb-6">
                Would you like to restore your previous draft from{" "}
                {feeDraft.lastSaved?.toLocaleTimeString()}?
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
          onConfirm={() =>
            confirmDelete && executeDeletePayment(confirmDelete.id)
          }
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
          onConfirm={() =>
            confirmDelete && executeDeleteAdjustment(confirmDelete.id)
          }
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
