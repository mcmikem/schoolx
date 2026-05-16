"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { Button } from "@/components/ui/index";
import { PageSection } from "@/components/ui/PageHeader";

interface PaymentData {
  id: string;
  student_id: string;
  amount_paid: number | string;
  payment_method: string;
  payment_reference?: string;
  payment_date: string;
}

interface StudentData {
  id: string;
  first_name: string;
  last_name: string;
}

interface FeePaymentHistoryProps {
  payments: PaymentData[];
  students: StudentData[];
  formatCurrency: (amount: number) => string;
  onDeletePayment: (id: string) => void;
  onRecordPayment: () => void;
}

export default function FeePaymentHistory({
  payments,
  students,
  formatCurrency,
  onDeletePayment,
  onRecordPayment,
}: FeePaymentHistoryProps) {
  return (
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
          onClick={onRecordPayment}
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
                          onClick={() =>
                            onDeletePayment(payment.id)
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
        )}
      </div>
    </PageSection>
  );
}
