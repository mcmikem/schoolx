"use client";
import { useState, useMemo, useRef } from "react";
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
import { useFormDraft } from "@/lib/useAutoSave";
import { PAYMENT_METHODS } from "@/lib/constants";
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
import { Button } from "@/components/ui/index";
import { TableSkeleton, FullPageLoader } from "@/components/ui/Skeleton";
import { EmptyState, NoData } from "@/components/EmptyState";
import { calculateStudentFeePosition } from "@/lib/operations";

export default function FeesPage() {
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

  const [tab, setTab] = useState<"balances" | "payments" | "structure">("balances");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentBalance | null>(
    null,
  );
  const [selectedClass, setSelectedClass] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "unpaid" | "partial" | "paid" | "written_off"
  >("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);

  const feeDraft = useFormDraft("fee_add_form");
  const [newFee, setNewFee] = useState({
    name: "",
    class_id: "",
    amount: "",
    term: currentTerm || 1,
    due_date: "",
  });

  const handleNewFeeChange = (updates: Partial<typeof newFee>) => {
    setNewFee((prev) => {
      const newState = { ...prev, ...updates };
      feeDraft.updateData(newState);
      return newState;
    });
  };
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

  const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;

  const studentBalances: StudentBalance[] = useMemo(() => {
    return students.map((student) => {
      const studentClassId = student.class_id;
      const studentPayments = payments.filter(
        (p) => p.student_id === student.id,
      );

      // Filter fees by class_id (null = applies to all) or no class filter exists
      const applicableFees = feeStructure.filter(
        (f) => f.class_id === null || f.class_id === studentClassId,
      );

      const studentAdjustments = adjustments.filter(
        (a) => a.student_id === student.id,
      );
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
        class_name: student.classes?.name ? `${student.classes.name}${student.classes.stream ? ` ${student.classes.stream}` : ''}` : "",
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
    });
  }, [students, payments, feeStructure, adjustments]);

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
    if (!confirm("Are you sure you want to delete this payment?")) return;
    try {
      await deletePayment(paymentId);
      toast.success("Payment deleted");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete payment",
      );
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
    if (!confirm("Delete this fee structure?")) return;
    try {
      await deleteFeeStructure(feeId);
      toast.success("Fee deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete fee");
    }
  };

  const handleGenerateInvoice = (student: StudentBalance) => {
    setSelectedStudent(student);
    setShowInvoiceModal(true);
  };

  const handlePrintInvoice = () => {
    if (!selectedStudent) return;
    const printWindow = window.open("", "_blank");
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

    if (printWindow) {
      printWindow.document.write(`<html><head><title>Invoice</title><style>
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
      </body></html>`);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handlePrintReceipt = () => {
    if (receiptRef.current) {
      const printContent = receiptRef.current.innerHTML;
      const printWindow = window.open("", "_blank");
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

      if (printWindow) {
        printWindow.document
          .write(`<html><head><title>Fee Receipt</title><style>
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
        </body></html>`);
        printWindow.document.close();
        printWindow.print();
      }
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
    if (!confirm("Delete this fee adjustment?")) return;
    try {
      await deleteAdjustment(adjustmentId);
      toast.success("Adjustment deleted");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete adjustment",
      );
    }
  };

  return (
    <div className="content">
      <PageHeader
        title="Fee Management"
        subtitle={`${students.length} students • Term ${currentTerm}, ${academicYear}`}
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInvoiceModal(true)}
            >
              <MaterialIcon icon="receipt_long" />
              Generate Invoice
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

      <FeeStats stats={stats} paymentsCount={payments.length} />

      <div className="bg-surface-container-low rounded-xl p-6">
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
                  {c.name}{c.stream ? ` ${c.stream}` : ''}
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
        activeTab={tab}
        onChange={(id) => setTab(id as typeof tab)}
        className="mb-6"
      />

      <TabPanel activeTab={tab} tabId="balances">
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
      </TabPanel>

      <TabPanel activeTab={tab} tabId="payments">
        <div className="space-y-6">
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
                      <tr key={payment.id} className="hover:bg-surface-bright">
                        <td className="px-6 py-4 text-sm">
                          {new Date(payment.payment_date).toLocaleDateString()}
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
                            <MaterialIcon icon="delete" className="text-lg" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
              <div>
                <div className="font-semibold text-on-surface">
                  Recent Adjustments
                </div>
                <div className="text-sm text-on-surface-variant">
                  Non-cash items that affect balances and revenue projections
                </div>
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
                            {adjustment.description || adjustment.notes || "-"}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() =>
                                handleDeleteAdjustment(adjustment.id)
                              }
                              className="p-2 text-error hover:bg-error-container rounded-lg"
                            >
                              <MaterialIcon icon="delete" className="text-lg" />
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
        </div>
      </TabPanel>

      <TabPanel activeTab={tab} tabId="structure">
        <div>
          <div className="flex justify-end mb-4">
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
        </div>
      </TabPanel>

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
    </div>
  );
}
