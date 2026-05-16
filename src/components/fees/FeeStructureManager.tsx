"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { Button } from "@/components/ui/index";
import { PageSection } from "@/components/ui/PageHeader";
import { NoData } from "@/components/EmptyState";

interface FeeStructureData {
  id: string;
  name: string;
  class_id?: string | null;
  classes?: { name: string } | null;
  amount: number | string;
  term: number;
}

interface FeeStructureManagerProps {
  feeStructure: FeeStructureData[];
  paginatedFeeStructure: FeeStructureData[];
  formatCurrency: (amount: number) => string;
  onDeleteFee: (id: string) => void;
  onAddFee: () => void;
  feePage: number;
  feeTotalPages: number;
  setFeePage: (page: number | ((prev: number) => number)) => void;
}

export default function FeeStructureManager({
  feeStructure,
  paginatedFeeStructure,
  formatCurrency,
  onDeleteFee,
  onAddFee,
  feePage,
  feeTotalPages,
  setFeePage,
}: FeeStructureManagerProps) {
  return (
    <PageSection className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-on-surface">
            Fee Structure
          </h3>
          <p className="text-sm text-on-surface-variant">
            Fee items and amounts
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={onAddFee}
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
                {paginatedFeeStructure.map((fee) => (
                  <tr key={fee.id} className="hover:bg-surface-bright">
                    <td className="px-6 py-4 font-medium">
                      {fee.name}
                    </td>
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
                        onClick={() => onDeleteFee(fee.id)}
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
          <div className="flex items-center justify-between px-6 py-3 border-t border-outline-variant/10">
            <span className="text-sm text-on-surface-variant">
              Page {feePage} of {feeTotalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFeePage((p: number) => Math.max(1, p - 1))}
                disabled={feePage === 1}
              >
                <MaterialIcon icon="chevron_left" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setFeePage((p: number) => Math.min(feeTotalPages, p + 1))
                }
                disabled={feePage >= feeTotalPages}
              >
                <MaterialIcon icon="chevron_right" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageSection>
  );
}
