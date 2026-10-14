"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import { useStudents } from "@/lib/hooks";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { TableSkeleton, FullPageLoader } from "@/components/ui/Skeleton";
import { EmptyState, NoData } from "@/components/EmptyState";
import { Button } from "@/components/ui/index";
import { Input, Select } from "@/components/ui/index";
import { logger } from "@/lib/logger";

interface PaymentRecord {
  id: string;
  student_id: string;
  amount_paid: number;
  amount_total: number;
  payment_date: string;
  term: number;
  academic_year: string;
  status: "pending" | "partial" | "paid";
  student_name?: string;
  student_number?: string;
  class_name?: string;
}

export default function FeeLedgerPage() {
  const { school, user, isDemo } = useAuth();
  const toast = useToast();

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  [selectedClass, setSelectedClass] = useState("");

  useEffect(() => {
    if (!school?.id) return;
    async function load() {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from("fee_payments")
            .select(
              `
            *,
            students!inner(id, first_name, last_name, student_number),
            classes!inner(name)
          `,
            )
            .eq("school_id", school.id)
            .order("payment_date", { ascending: false }),
          15000,
          timeoutFallback(),
        );
        if (error) throw error;
        let results = (data || []) as PaymentRecord[];
        results = results.map((p) => ({
          ...p,
          student_name: p.students?.first_name + " " + p.students?.last_name,
          student_number: p.students?.student_number,
          class_name: p.classes?.name,
        }));
        setPayments(results);
      } catch (err) {
        logger.warn("Failed to load fee payments:", err);
        toast.error("Could not load payment ledger");
      }
    }
    load();
  }, [school?.id]);

  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      (p.student_name && p.student_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.class_name && p.class_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  return (
    <PageHeader title="Payment Ledger" subtitle="Chronological payment record with search and filter">
      <div className="space-y-6">
        <Card>
          <CardBody className="p-6">
            <div className="mb-4">
              <Input
                placeholder="Search by student name or class..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-outline-variant px-4 py-3 text-sm"
              />
              {selectedClass && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedClass("")}
                  className="ml-2 text-sm text-gray-500"
                >
                  Clear class filter
                </Button>
              )}
            </div>

            {filteredPayments.length === 0 ? (
              <NoData
                title="No payments found"
                description={
                  searchQuery
                    ? `No payments match "${searchQuery}". Try a different search.`
                    : "Add payment records or adjust your search criteria."
                }
              />
            ) : (
              <TableSkeleton rows={5} />
            )}

            {filteredPayments.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50 text-left">
                      <th className="px-6 py-3 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                        Date
                      </th>
                      <th className="px-6 py-3 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                        Student
                      </th>
                      <th className="px-6 py-3 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                        Class
                      </th>
                      <th className="px-6 py-3 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                        Amount Paid
                      </th>
                      <th className="px-6 py-3 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                        Total
                      </th>
                      <th className="px-6 py-3 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                        Status
                      </th>
                      <th className="px-6 py-3 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((p) => (
                      <tr key={p.id} className="border-y divide-y-divide-surface-container">
                        <td className="px-6 py-4">{new Date(p.payment_date).toLocaleDateString("en-GB")}</td>
                        <td className="px-6 py-4">{p.student_name || "Unknown"}</td>
                        <td className="px-6 py-4">{p.class_name || "-"}</td>
                        <td className="px-6 py-4">UGX {p.amount_paid.toLocaleString()}</td>
                        <td className="px-6 py-4">UGX {p.amount_total.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-0.5 rounded-xs text-xs font-medium ${
                              p.status === "paid"
                                ? "bg-green-100 text-green-800"
                                : p.status === "partial"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-800"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Button variant="ghost" size="sm" onClick={() => {}} className="text-sm">
                            Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {payments.length === 0 && (
              <Button
                onClick={() => toast.info("No payment records to display")}
                className="w-full mt-4 bg-surface-container text-sm text-gray-400 py-3"
              >
                No payment records
              </Button>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6">
            <h4 className="font-semibold mb-4">Payment Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="font-medium">Total Payments</p>
                <p className="mt-1">{payments.length}</p>
              </div>
              <div>
                <p className="font-medium">Total Amount</p>
                <p className="mt-1">
                  UGX{" "}
                  {payments
                    .filter((p) => p.status === "paid")
                    .reduce((sum, p) => sum + p.amount_paid, 0)
                    .toLocaleString()}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </PageHeader>
  );
}
