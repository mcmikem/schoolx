"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { DataTable, StatStrip, type DataColumn } from "@/components/ui/index";

interface InvoiceData {
  student_id: string;
  student_name: string;
  student_number: string;
  class_name: string;
  class_id: string;
  fee_items: Array<{ name: string; amount: number }>;
  total_amount: number;
  amount_paid: number;
  balance: number;
}

interface ClassData {
  id: string;
  name: string;
}

interface FeeInvoiceListProps {
  invoiceStats: {
    totalInvoiced: number;
    totalCollected: number;
    totalBalance: number;
    fullyPaid: number;
    hasBalance: number;
  };
  formatCurrency: (amount: number) => string;
  classes: ClassData[];
  invoiceClassFilter: string;
  setInvoiceClassFilter: (filter: string) => void;
  filteredInvoices: InvoiceData[];
  printInvoice: (invoice: InvoiceData) => void;
  sendInvoiceSMS: (invoice: InvoiceData) => void;
}

export default function FeeInvoiceList({
  invoiceStats,
  formatCurrency,
  classes,
  invoiceClassFilter,
  setInvoiceClassFilter,
  filteredInvoices,
  printInvoice,
  sendInvoiceSMS,
}: FeeInvoiceListProps) {
  const columns: DataColumn<InvoiceData>[] = [
    {
      key: "student",
      header: "Student",
      sortValue: (invoice) => invoice.student_name,
      render: (invoice) => (
        <div>
          <div className="font-medium text-[var(--t1)]">{invoice.student_name}</div>
          <div className="text-xs text-[var(--t3)]">{invoice.student_number}</div>
        </div>
      ),
    },
    {
      key: "class",
      header: "Class",
      sortValue: (invoice) => invoice.class_name,
      render: (invoice) => <span className="text-sm text-[var(--t3)]">{invoice.class_name}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortValue: (invoice) => invoice.total_amount,
      render: (invoice) => <span className="font-medium">{formatCurrency(invoice.total_amount)}</span>,
    },
    {
      key: "paid",
      header: "Paid",
      align: "right",
      sortValue: (invoice) => invoice.amount_paid,
      render: (invoice) => <span className="text-[var(--green)]">{formatCurrency(invoice.amount_paid)}</span>,
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      sortValue: (invoice) => invoice.balance,
      render: (invoice) => (
        <span className={`font-medium ${invoice.balance > 0 ? "text-[var(--error)]" : "text-[var(--green)]"}`}>
          {formatCurrency(invoice.balance)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (invoice) => (invoice.balance === 0 ? 0 : 1),
      render: (invoice) => (
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            invoice.balance === 0
              ? "bg-[var(--green-soft)] text-[var(--green)]"
              : "bg-[var(--amber-soft)] text-[var(--amber)]"
          }`}
        >
          {invoice.balance === 0 ? "Paid" : "Unpaid"}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      hideOnMobile: true,
      render: (invoice) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => printInvoice(invoice)}
            className="rounded-lg p-2 text-[var(--t3)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]"
            title="Print invoice"
            aria-label={`Print invoice for ${invoice.student_name}`}
          >
            <MaterialIcon icon="print" />
          </button>
          {invoice.balance > 0 && (
            <button
              onClick={() => sendInvoiceSMS(invoice)}
              className="rounded-lg p-2 text-[var(--t3)] hover:bg-[var(--green-soft)] hover:text-[var(--green)]"
              title="Send via SMS"
              aria-label={`Send invoice to ${invoice.student_name}'s parent`}
            >
              <MaterialIcon icon="sms" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <StatStrip
        columns={5}
        className="mb-6"
        items={[
          { label: "Total Invoiced", value: formatCurrency(invoiceStats.totalInvoiced) },
          { label: "Collected", value: formatCurrency(invoiceStats.totalCollected), tone: "positive" },
          { label: "Outstanding", value: formatCurrency(invoiceStats.totalBalance), tone: "negative" },
          { label: "Fully Paid", value: invoiceStats.fullyPaid, tone: "positive" },
          { label: "Has Balance", value: invoiceStats.hasBalance, tone: "warning" },
        ]}
      />

      <div className="mb-4">
        {classes.length === 0 ? (
          <div className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] px-3 py-2 text-sm text-[var(--t1)]">
            No classes available
          </div>
        ) : (
          <select
            value={invoiceClassFilter}
            onChange={(e) => setInvoiceClassFilter(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm sm:w-48"
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

      <DataTable
        columns={columns}
        rows={filteredInvoices}
        getRowId={(invoice) => invoice.student_id}
        caption="Fee invoices"
        initialSort={{ key: "student", dir: "asc" }}
        empty={
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-12 text-center">
            <MaterialIcon className="mb-3 text-4xl text-[var(--t3)]/40">receipt_long</MaterialIcon>
            <p className="font-semibold text-[var(--t1)]">No invoices</p>
            <p className="mt-1 text-sm text-[var(--t3)]">
              {invoiceClassFilter === "all"
                ? "Invoices appear once students and fees exist."
                : "No invoices for the selected class."}
            </p>
          </div>
        }
        footer={
          <span className="text-[var(--t3)]">
            {filteredInvoices.length} invoice{filteredInvoices.length === 1 ? "" : "s"} ·{" "}
            {formatCurrency(filteredInvoices.reduce((sum, invoice) => sum + invoice.balance, 0))} outstanding
          </span>
        }
        renderMobileCard={(invoice) => (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{invoice.student_name}</p>
                <p className="text-xs text-[var(--t3)]">
                  {invoice.student_number} · {invoice.class_name}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  invoice.balance === 0
                    ? "bg-[var(--green-soft)] text-[var(--green)]"
                    : "bg-[var(--amber-soft)] text-[var(--amber)]"
                }`}
              >
                {invoice.balance === 0 ? "Paid" : "Unpaid"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--t3)]">
                Paid {formatCurrency(invoice.amount_paid)} of {formatCurrency(invoice.total_amount)}
              </span>
              <span className={`font-bold ${invoice.balance > 0 ? "text-[var(--error)]" : "text-[var(--green)]"}`}>
                {formatCurrency(invoice.balance)}
              </span>
            </div>
            <div className="flex gap-3 pt-1 text-xs font-semibold">
              <button onClick={() => printInvoice(invoice)} className="text-[var(--primary)]">
                Print
              </button>
              {invoice.balance > 0 && (
                <button onClick={() => sendInvoiceSMS(invoice)} className="text-[var(--green)]">
                  Send SMS
                </button>
              )}
            </div>
          </div>
        )}
      />
    </>
  );
}
