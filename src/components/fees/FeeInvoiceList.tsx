"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { Card, CardBody } from "@/components/ui/Card";

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
  return (
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
            <div className="text-sm text-[var(--t3)] mt-1">
              Outstanding
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-2xl font-bold text-green-600">
              {invoiceStats.fullyPaid}
            </div>
            <div className="text-sm text-[var(--t3)] mt-1">
              Fully Paid
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-2xl font-bold text-yellow-600">
              {invoiceStats.hasBalance}
            </div>
            <div className="text-sm text-[var(--t3)] mt-1">
              Has Balance
            </div>
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
  );
}
