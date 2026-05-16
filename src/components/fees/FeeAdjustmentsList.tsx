"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { Button } from "@/components/ui/index";
import { PageSection } from "@/components/ui/PageHeader";

interface AdjustmentData {
  id: string;
  student_id: string;
  amount: number | string;
  adjustment_type: string;
  description?: string;
  notes?: string;
  created_at: string;
}

interface StudentData {
  id: string;
  first_name: string;
  last_name: string;
}

interface FeeAdjustmentsListProps {
  adjustments: AdjustmentData[];
  students: StudentData[];
  formatCurrency: (amount: number) => string;
  onDeleteAdjustment: (id: string) => void;
  onAddAdjustment: () => void;
}

export default function FeeAdjustmentsList({
  adjustments,
  students,
  formatCurrency,
  onDeleteAdjustment,
  onAddAdjustment,
}: FeeAdjustmentsListProps) {
  return (
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
          onClick={onAddAdjustment}
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
                            onDeleteAdjustment(adjustment.id)
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
  );
}
