"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import {
  useStudents,
  useFeePayments,
  useFeeStructure,
  useClasses,
  useFeeAdjustments,
} from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { useFormDraft, AutoSaveIndicator } from "@/lib/useAutoSave";
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
import { PageHeader, PageSection } from "@/components/ui/PageHeader";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { TableSkeleton, FullPageLoader } from "@/components/ui/Skeleton";
import { EmptyState, NoData } from "@/components/EmptyState";
import { calculateStudentFeePosition } from "@/lib/operations";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useUndo, UndoNotification } from "@/lib/useUndo";

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

export default function FinanceHubPage() {
  const { school } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const toast = useToast();

  const { students } = useStudents(school?.id);
  const { classes } = useClasses(school?.id);
  const { payments, createPayment, deletePayment } = useFeePayments(school?.id);
  const { feeStructure, createFeeStructure, deleteFeeStructure } =
    useFeeStructure(school?.id);
  const { adjustments, createAdjustment, deleteAdjustment } = useFeeAdjustments(
    school?.id,
  );
  const receiptRef = useRef<HTMLDivElement>(null);

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

  const [invoiceClassFilter, setInvoiceClassFilter] = useState("all");
  const [cashbookDateFilter, setCashbookDateFilter] = useState("today");

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
          description: a.description || a.notes || "",
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
        class_id: student.class_id,
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
    if (!newPayment.student_id || !newPayment.amount_paid) {
      toast.error("Please fill all required fields");
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
      await createPayment({
        student_id: newPayment.student_id,
        amount_paid: Number(newPayment.amount_paid),
        payment_method: newPayment.payment_method,
        payment_reference: reference || undefined,
        paid_by: newPayment.paid_by || undefined,
        notes: newPayment.notes || undefined,
      });
      const student = studentBalances.find(
        (s) => s.id === newPayment.student_id,
      );
      if (student) {
        setSelectedStudent({
          ...student,
          paid: student.paid + Number(newPayment.amount_paid),
          balance: Math.max(
            0,
            student.balance - Number(newPayment.amount_paid),
          ),
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
          <div class="invoice-title">FEE INVOICE</div>
          <div class="school-info">Invoice No: ${escapeHtml(invoiceNo)} | Date: ${escapeHtml(today)}</div>
        </div>
        <div class="row"><span class="label">Student:</span><span class="value">${escapeHtml(selectedStudent.name)}</span></div>
        <div class="row"><span class="label">Student No:</span><span class="value">${escapeHtml(selectedStudent.student_number)}</span></div>
        <div class="row"><span class="label">Class:</span><span class="value">${escapeHtml(selectedStudent.class_name)}</span></div>
        <div class="row"><span class="label">Term:</span><span class="value">Term ${currentTerm}, ${academicYear}</span></div>
        <div class="row"><span class="label">Total Fees:</span><span class="value">${formatCurrency(selectedStudent.expected)}</span></div>
        <div class="row"><span class="label">Amount Paid:</span><span class="value">${formatCurrency(selectedStudent.paid)}</span></div>
        <div class="total"><span class="label">Balance Due:</span><span class="value">${formatCurrency(selectedStudent.balance)}</span></div>
        <div class="footer">
          <div>This invoice is generated by Omuto SMS</div>
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
            <div>Powered by Omuto SMS</div>
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
    if (!newPlan.student_id || newPlan.total_amount <= 0) {
      toast.error("Please fill all fields");
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
      await supabase.from("payment_plan_installments").insert(installmentData);
      toast.success("Payment plan created");
      setShowCreatePlan(false);
      setNewPlan({
        student_id: "",
        total_amount: 0,
        installments: 3,
        start_date: new Date().toISOString().split("T")[0],
      });
      fetchPlans();
    } catch (err: any) {
      toast.error(err.message || "Failed to create plan");
    }
  };

  const markInstallmentPaid = async (installmentId: string) => {
    try {
      await supabase
        .from("payment_plan_installments")
        .update({ paid: true, paid_date: new Date().toISOString() })
        .eq("id", installmentId);
      const updated = installments.map((i) =>
        i.id === installmentId ? { ...i, paid: true } : i,
      );
      setInstallments(updated);
      if (updated.every((i) => i.paid)) {
        await supabase
          .from("payment_plans")
          .update({ status: "completed" })
          .eq("id", selectedPlan?.id);
      }
      toast.success("Payment recorded");
    } catch {
      toast.error("Failed to record payment");
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
    <div className="content">
      <PageHeader
        title="Finance Hub"
        subtitle={`Term ${currentTerm}, ${academicYear}`}
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAutoFeeReminders}
              disabled={sendingReminders}
            >
              <MaterialIcon icon="notifications_active" />
              {sendingReminders ? "Sending..." : "Auto Fee Reminders"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdjustmentModal(true)}
            >
              <MaterialIcon icon="tune" />
              Add Adjustment
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowPaymentModal(true)}
            >
              <MaterialIcon icon="add" />
              Add Payment
            </Button>
          </div>
        }
      />

      <div className="flex gap-1 p-1 bg-[var(--surface-container-low)] rounded-xl mb-6 overflow-x-auto">
        {[
          { id: "balances" as const, label: "Balances" },
          { id: "payment-plans" as const, label: "Payment Plans" },
          { id: "invoices" as const, label: "Invoices" },
          { id: "cashbook" as const, label: "Cashbook" },
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
          <FeeStats stats={stats} paymentsCount={payments.length} />

          <div className="bg-surface-container-low rounded-xl p-6 mb-6">
            <div className="flex flex-col lg:flex-row gap-4 items-center">
              <div className="relative w-full lg:flex-1">
                <MaterialIcon
                  icon="search"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
                />
                <input
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
            activeTab={tab === "balances" ? "balances" : "payments"}
            onChange={(id) => {
              if (id === "structure") {
                setShowFeeModal(true);
              }
            }}
            className="mb-6"
          />

          {filteredBalances.length === 0 ? (
            <NoData
              title="No student balances"
              description="Add students and fee structures to see balances"
            />
          ) : (
            <FeeTable
              balances={filteredBalances}
              onViewReceipt={handleViewReceipt}
            />
          )}

          <PageSection className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-on-surface">Payments</h3>
                <p className="text-sm text-on-surface-variant">
                  Recent payment transactions
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowPaymentModal(true)}
              >
                <MaterialIcon icon="add" />
                Add Payment
              </Button>
            </div>
            <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
              {payments.length === 0 ? (
                <div className="p-12 text-center">
                  <MaterialIcon className="text-4xl text-on-surface-variant/30 mb-4">
                    payments
                  </MaterialIcon>
                  <h3 className="text-lg font-semibold text-on-surface mb-2">
                    No payments recorded
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    Record the first payment to see it here
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low text-left">
                        <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                          Date
                        </th>
                        <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                          Student
                        </th>
                        <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                          Amount
                        </th>
                        <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                          Method
                        </th>
                        <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                          Reference
                        </th>
                        <th className="px-6 py-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/5">
                      {payments.map((payment) => {
                        const student = students.find(
                          (s) => s.id === payment.student_id,
                        );
                        return (
                          <tr
                            key={payment.id}
                            className="hover:bg-surface-bright"
                          >
                            <td className="px-6 py-4 text-sm">
                              {new Date(
                                payment.payment_date,
                              ).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 font-medium">
                              {student?.first_name} {student?.last_name}
                            </td>
                            <td className="px-6 py-4 font-bold text-secondary">
                              {formatCurrency(Number(payment.amount_paid))}
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 bg-surface-container text-on-surface-variant rounded text-xs font-bold uppercase">
                                {payment.payment_method}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm font-mono text-on-surface-variant">
                              {payment.payment_reference || "-"}
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => handleDeletePayment(payment.id)}
                                className="p-2 text-error hover:bg-error-container rounded-lg"
                              >
                                <MaterialIcon
                                  icon="delete"
                                  className="text-lg"
                                />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </PageSection>

          <PageSection className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-on-surface">
                  Recent Adjustments
                </h3>
                <p className="text-sm text-on-surface-variant">
                  Non-cash items that affect balances
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAdjustmentModal(true)}
              >
                <MaterialIcon icon="add" />
                Add Adjustment
              </Button>
            </div>
            {adjustments.length === 0 ? (
              <div className="p-6 text-sm text-on-surface-variant">
                No adjustments recorded.
              </div>
            ) : (
              <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low text-left">
                        <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                          Date
                        </th>
                        <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                          Student
                        </th>
                        <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                          Type
                        </th>
                        <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                          Amount
                        </th>
                        <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                          Notes
                        </th>
                        <th className="px-6 py-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/5">
                      {adjustments.map((adjustment) => {
                        const student = students.find(
                          (s) => s.id === adjustment.student_id,
                        );
                        return (
                          <tr
                            key={adjustment.id}
                            className="hover:bg-surface-bright"
                          >
                            <td className="px-6 py-4 text-sm">
                              {new Date(
                                adjustment.created_at,
                              ).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 font-medium">
                              {student?.first_name} {student?.last_name}
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 bg-surface-container text-on-surface-variant rounded text-xs font-bold uppercase">
                                {adjustment.adjustment_type.replace("_", " ")}
                              </span>
                            </td>
                            <td
                              className={`px-6 py-4 font-bold ${adjustment.adjustment_type === "penalty" ? "text-error" : "text-primary"}`}
                            >
                              {formatCurrency(Number(adjustment.amount))}
                            </td>
                            <td className="px-6 py-4 text-sm text-on-surface-variant">
                              {adjustment.description ||
                                adjustment.notes ||
                                "-"}
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() =>
                                  handleDeleteAdjustment(adjustment.id)
                                }
                                className="p-2 text-error hover:bg-error-container rounded-lg"
                              >
                                <MaterialIcon
                                  icon="delete"
                                  className="text-lg"
                                />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </PageSection>

          <PageSection className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-on-surface">Fee Structure</h3>
                <p className="text-sm text-on-surface-variant">
                  Fee items and amounts
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowFeeModal(true)}
              >
                <MaterialIcon icon="add" />
                Add Fee
              </Button>
            </div>
            {feeStructure.length === 0 ? (
              <NoData
                title="No fee structure"
                description="Create fee items to start collecting payments"
              />
            ) : (
              <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
                <div className="overflow-x-auto table-responsive">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low text-left">
                        <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                          Fee Name
                        </th>
                        <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                          Class
                        </th>
                        <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                          Amount
                        </th>
                        <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                          Term
                        </th>
                        <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/5">
                      {feeStructure.map((fee) => (
                        <tr key={fee.id} className="hover:bg-surface-bright">
                          <td className="px-6 py-4 font-medium">{fee.name}</td>
                          <td className="px-6 py-4">
                            {fee.classes?.name || "All Classes"}
                          </td>
                          <td className="px-6 py-4 font-bold text-primary">
                            {formatCurrency(Number(fee.amount))}
                          </td>
                          <td className="px-6 py-4 text-sm text-on-surface-variant">
                            Term {fee.term}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleDeleteFee(fee.id)}
                              className="text-error hover:underline text-sm"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </PageSection>
        </>
      )}

      {tab === "payment-plans" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardBody className="text-center">
                <div className="text-2xl font-bold text-[var(--t1)]">
                  {plans.length}
                </div>
                <div className="text-sm text-[var(--t3)] mt-1">Total Plans</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className="text-2xl font-bold text-[var(--primary)]">
                  {activePlanCount}
                </div>
                <div className="text-sm text-[var(--t3)] mt-1">Active</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className="text-2xl font-bold text-[var(--green)]">
                  {completedPlanCount}
                </div>
                <div className="text-sm text-[var(--t3)] mt-1">Completed</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className="text-2xl font-bold text-[var(--amber)]">
                  {formatCurrency(totalOutstanding)}
                </div>
                <div className="text-sm text-[var(--t3)] mt-1">Outstanding</div>
              </CardBody>
            </Card>
          </div>

          <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-on-surface">Payment Plans</h3>
                <p className="text-sm text-on-surface-variant">
                  Installment plans for parents
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowCreatePlan(true)}
              >
                <MaterialIcon icon="add" />
                Create Plan
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-left">
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                      Student
                    </th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                      Class
                    </th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                      Total
                    </th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                      Installments
                    </th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                      Start Date
                    </th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                      Status
                    </th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {plans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-surface-bright">
                      <td className="px-6 py-4 font-medium">
                        {plan.students?.first_name} {plan.students?.last_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">
                        {plan.students?.classes?.name}
                      </td>
                      <td className="px-6 py-4 font-bold text-secondary">
                        {formatCurrency(Number(plan.total_amount))}
                      </td>
                      <td className="px-6 py-4 text-sm">{plan.installments}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">
                        {new Date(plan.start_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                            plan.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : plan.status === "active"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {plan.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedPlan(plan)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {plans.length === 0 && !plansLoading && (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-8 text-on-surface-variant"
                      >
                        No payment plans
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {showCreatePlan && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md">
                <h2 className="text-xl font-bold text-on-surface mb-4">
                  Create Payment Plan
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-on-surface mb-1">
                      Student
                    </label>
                    {planStudents.length === 0 ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">
                        No students available
                      </div>
                    ) : (
                      <select
                        value={newPlan.student_id}
                        onChange={(e) =>
                          setNewPlan({ ...newPlan, student_id: e.target.value })
                        }
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 text-sm"
                      >
                        <option value="">Select student...</option>
                        {planStudents.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.first_name} {s.last_name} - {s.classes?.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-on-surface mb-1">
                      Total Amount (UGX)
                    </label>
                    <input
                      type="number"
                      value={newPlan.total_amount}
                      onChange={(e) =>
                        setNewPlan({
                          ...newPlan,
                          total_amount: Number(e.target.value),
                        })
                      }
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 text-sm"
                      placeholder="Enter total amount"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-on-surface mb-1">
                      Number of Installments
                    </label>
                    <select
                      value={newPlan.installments}
                      onChange={(e) =>
                        setNewPlan({
                          ...newPlan,
                          installments: Number(e.target.value),
                        })
                      }
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 text-sm"
                    >
                      <option value={2}>2 Installments</option>
                      <option value={3}>3 Installments</option>
                      <option value={4}>4 Installments</option>
                      <option value={5}>5 Installments</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-on-surface mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={newPlan.start_date}
                      onChange={(e) =>
                        setNewPlan({ ...newPlan, start_date: e.target.value })
                      }
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 text-sm"
                    />
                  </div>
                  {newPlan.total_amount > 0 && newPlan.installments > 0 && (
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <div className="text-sm text-primary">
                        Each installment:{" "}
                        <strong>
                          {formatCurrency(
                            Math.round(
                              newPlan.total_amount / newPlan.installments,
                            ),
                          )}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowCreatePlan(false)}
                    className="flex-1 py-3 bg-surface-container font-semibold rounded-xl text-on-surface-variant"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createPlan}
                    className="flex-1 py-3 bg-primary text-white font-semibold rounded-xl"
                  >
                    Create Plan
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedPlan && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md">
                <h2 className="text-xl font-bold text-on-surface mb-2">
                  Payment Details
                </h2>
                <p className="text-sm text-on-surface-variant mb-4">
                  {selectedPlan.students?.first_name}{" "}
                  {selectedPlan.students?.last_name} -{" "}
                  {selectedPlan.students?.classes?.name}
                </p>
                <div className="space-y-3">
                  {installments.map((inst, idx) => (
                    <div
                      key={inst.id}
                      className="flex items-center justify-between p-3 border border-outline-variant/20 rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-on-surface">
                          Installment {idx + 1}
                        </div>
                        <div className="text-sm text-on-surface-variant">
                          Due: {new Date(inst.due_date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-on-surface">
                          {formatCurrency(inst.amount)}
                        </div>
                        {inst.paid ? (
                          <span className="text-sm text-green-600">Paid</span>
                        ) : (
                          <button
                            onClick={() => markInstallmentPaid(inst.id)}
                            className="text-sm bg-green-600 text-white px-3 py-1 rounded-lg"
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="w-full mt-4 py-3 bg-surface-container font-semibold rounded-xl text-on-surface-variant"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "invoices" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardBody>
                <div className="text-2xl font-bold text-[var(--t1)]">
                  {formatCurrency(invoiceStats.totalInvoiced)}
                </div>
                <div className="text-sm text-[var(--t3)] mt-1">
                  Total Invoiced
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(invoiceStats.totalCollected)}
                </div>
                <div className="text-sm text-[var(--t3)] mt-1">Collected</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(invoiceStats.totalBalance)}
                </div>
                <div className="text-sm text-[var(--t3)] mt-1">Outstanding</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-2xl font-bold text-green-600">
                  {invoiceStats.fullyPaid}
                </div>
                <div className="text-sm text-[var(--t3)] mt-1">Fully Paid</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-2xl font-bold text-yellow-600">
                  {invoiceStats.hasBalance}
                </div>
                <div className="text-sm text-[var(--t3)] mt-1">Has Balance</div>
              </CardBody>
            </Card>
          </div>

          <div className="mb-6">
            {classes.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">
                No classes available
              </div>
            ) : (
              <select
                value={invoiceClassFilter}
                onChange={(e) => setInvoiceClassFilter(e.target.value)}
                className="bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 text-sm sm:w-48"
                aria-label="Filter by class"
              >
                <option value="all">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-left">
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                      Student
                    </th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                      Class
                    </th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                      Total
                    </th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                      Paid
                    </th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                      Balance
                    </th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                      Status
                    </th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {filteredInvoices.map((invoice) => (
                    <tr
                      key={invoice.student_id}
                      className="hover:bg-surface-bright"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-on-surface">
                          {invoice.student_name}
                        </div>
                        <div className="text-xs text-on-surface-variant">
                          {invoice.student_number}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">
                        {invoice.class_name}
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {formatCurrency(invoice.total_amount)}
                      </td>
                      <td className="px-6 py-4 text-green-600">
                        {formatCurrency(invoice.amount_paid)}
                      </td>
                      <td
                        className={`px-6 py-4 font-medium ${invoice.balance > 0 ? "text-red-600" : "text-green-600"}`}
                      >
                        {formatCurrency(invoice.balance)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${invoice.balance === 0 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}
                        >
                          {invoice.balance === 0 ? "Paid" : "Pending"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => printInvoice(invoice)}
                            className="p-2 text-on-surface-variant hover:text-primary rounded-lg hover:bg-primary/10"
                            title="Print Invoice"
                          >
                            <MaterialIcon icon="print" />
                          </button>
                          {invoice.balance > 0 && (
                            <button
                              onClick={() => sendInvoiceSMS(invoice)}
                              className="p-2 text-on-surface-variant hover:text-green-600 rounded-lg hover:bg-green-100"
                              title="Send via SMS"
                            >
                              <MaterialIcon icon="sms" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "cashbook" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardBody>
                <div className="text-xl font-bold text-[var(--t1)]">
                  {formatCurrency(cashbookSummary.total)}
                </div>
                <div className="text-sm text-[var(--t3)]">Total Collected</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-xl font-bold text-[var(--green)]">
                  {formatCurrency(cashbookSummary.cash)}
                </div>
                <div className="text-sm text-[var(--t3)]">Cash</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-xl font-bold text-[var(--amber)]">
                  {formatCurrency(cashbookSummary.momo)}
                </div>
                <div className="text-sm text-[var(--t3)]">Mobile Money</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-xl font-bold text-[var(--navy)]">
                  {formatCurrency(cashbookSummary.bank)}
                </div>
                <div className="text-sm text-[var(--t3)]">Bank</div>
              </CardBody>
            </Card>
          </div>

          <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-semibold text-on-surface">Transactions</h3>
                <p className="text-sm text-on-surface-variant">
                  {cashbookSummary.count} transactions •{" "}
                  {cashbookDateFilter === "today"
                    ? "Today"
                    : cashbookDateFilter === "week"
                      ? "This Week"
                      : "This Month"}
                </p>
              </div>
              <div className="flex gap-3">
                <select
                  value={cashbookDateFilter}
                  onChange={(e) => setCashbookDateFilter(e.target.value)}
                  className="bg-surface-container-lowest border border-outline-variant rounded-xl py-2 px-4 text-sm"
                  aria-label="Date range filter"
                >
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={exportCashbookCSV}
                >
                  <MaterialIcon icon="download" />
                  Export CSV
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-left">
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                      Date
                    </th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                      Student
                    </th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-right">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">
                      Method
                    </th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                      Reference
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {filteredCashbookPayments.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState
                          icon="receipt_long"
                          title="No transactions found"
                          description="There are no payments recorded for the selected period"
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredCashbookPayments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-surface-bright">
                        <td className="px-6 py-4 text-sm text-on-surface">
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 font-medium text-on-surface">
                          {
                            (
                              payment as {
                                students?: {
                                  first_name?: string;
                                  last_name?: string;
                                };
                              }
                            ).students?.first_name
                          }{" "}
                          {
                            (
                              payment as {
                                students?: {
                                  first_name?: string;
                                  last_name?: string;
                                };
                              }
                            ).students?.last_name
                          }
                        </td>
                        <td className="px-6 py-4 text-right text-green-600 font-medium">
                          {formatCurrency(Number(payment.amount_paid))}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            {payment.payment_method === "mobile_money"
                              ? "MoMo"
                              : payment.payment_method === "cash"
                                ? "Cash"
                                : payment.payment_method === "bank"
                                  ? "Bank"
                                  : "Other"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant">
                          {payment.payment_reference || "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-sm p-6">
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
  );
}
