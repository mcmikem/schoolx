"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { Tabs, TabPanel } from "@/components/ui/Tabs";

interface BudgetItem {
  id?: string;
  category: string;
  type: "income" | "expense";
  budgeted: number;
  actual: number;
}

const INCOME_CATEGORIES = [
  { key: "fees", label: "Expected Fees", auto: true },
  { key: "government_grant", label: "Government Grant" },
  { key: "donations", label: "Donations" },
  { key: "other_income", label: "Other Income" },
];

const EXPENSE_CATEGORIES = [
  { key: "salaries", label: "Salaries" },
  { key: "supplies", label: "Supplies" },
  { key: "utilities", label: "Utilities" },
  { key: "maintenance", label: "Maintenance" },
  { key: "transport", label: "Transport" },
  { key: "other_expense", label: "Other" },
];

export default function BudgetPage() {
  const { school } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studentCount, setStudentCount] = useState(0);
  const [feePerTerm, setFeePerTerm] = useState(0);
  const [budgetItems, setBudgetItems] = useState<Record<string, BudgetItem>>(
    {},
  );
  const [activeTab, setActiveTab] = useState<"planner" | "actual">("planner");

  const loadData = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      const { count } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("school_id", school.id)
        .eq("status", "active");
      setStudentCount(count || 0);

      const { data: feeData } = await supabase
        .from("fee_structure")
        .select("amount")
        .eq("school_id", school.id)
        .limit(1);
      const feeAmount = feeData?.[0]?.amount
        ? Number(feeData[0].amount)
        : 50000;
      setFeePerTerm(feeAmount);

      const { data: budgetData } = await supabase
        .from("budget_items")
        .select("*")
        .eq("school_id", school.id);

      const items: Record<string, BudgetItem> = {};
      budgetData?.forEach((b: any) => {
        items[b.category] = {
          id: b.id,
          category: b.category,
          type: b.type,
          budgeted: Number(b.budgeted),
          actual: Number(b.actual || 0),
        };
      });

      INCOME_CATEGORIES.forEach((c) => {
        if (!items[c.key]) {
          const autoBudget = c.auto ? (count || 0) * feeAmount : 0;
          items[c.key] = {
            category: c.key,
            type: "income",
            budgeted: autoBudget,
            actual: 0,
          };
        } else if (c.auto) {
          items[c.key].budgeted = (count || 0) * feeAmount;
        }
      });
      EXPENSE_CATEGORIES.forEach((c) => {
        if (!items[c.key]) {
          items[c.key] = {
            category: c.key,
            type: "expense",
            budgeted: 0,
            actual: 0,
          };
        }
      });

      setBudgetItems(items);

      const { data: expenses } = await supabase
        .from("expenses")
        .select("category, amount")
        .eq("school_id", school.id);

      expenses?.forEach((e: any) => {
        const cat = (e.category || "").toLowerCase().replace(/\s+/g, "_");
        if (items[cat]) {
          items[cat].actual += Number(e.amount);
        }
      });

      const { data: fees } = await supabase
        .from("fee_payments")
        .select("amount_paid, students!inner(school_id)")
        .eq("students.school_id", school.id);
      const totalFees =
        fees?.reduce((s: number, f: any) => s + Number(f.amount_paid), 0) || 0;
      if (items.fees) items.fees.actual = totalFees;

      setBudgetItems({ ...items });
    } catch (err) {
      console.error("Error loading budget data:", err);
    } finally {
      setLoading(false);
    }
  }, [school?.id]);

  useEffect(() => {
    if (school?.id) loadData();
  }, [school?.id, loadData]);

  const updateBudgeted = (key: string, value: number) => {
    setBudgetItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], budgeted: value },
    }));
  };

  const totalIncome = Object.values(budgetItems)
    .filter((b) => b.type === "income")
    .reduce((s, b) => s + b.budgeted, 0);
  const totalExpense = Object.values(budgetItems)
    .filter((b) => b.type === "expense")
    .reduce((s, b) => s + b.budgeted, 0);
  const surplus = totalIncome - totalExpense;

  const actualIncome = Object.values(budgetItems)
    .filter((b) => b.type === "income")
    .reduce((s, b) => s + b.actual, 0);
  const actualExpense = Object.values(budgetItems)
    .filter((b) => b.type === "expense")
    .reduce((s, b) => s + b.actual, 0);

  const saveBudget = async () => {
    if (!school?.id) return;
    setSaving(true);
    try {
      for (const item of Object.values(budgetItems)) {
        if (item.id) {
          await supabase
            .from("budget_items")
            .update({ budgeted: item.budgeted })
            .eq("id", item.id);
        } else {
          const { data } = await supabase
            .from("budget_items")
            .insert({
              school_id: school.id,
              category: item.category,
              type: item.type,
              budgeted: item.budgeted,
              actual: 0,
            })
            .select()
            .single();
          if (data) item.id = data.id;
        }
      }
      setBudgetItems({ ...budgetItems });
      toast.success("Budget saved successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to save budget");
    } finally {
      setSaving(false);
    }
  };

  const getUsageColor = (budgeted: number, actual: number) => {
    if (budgeted === 0) return "text-[var(--t3)]";
    const pct = (actual / budgeted) * 100;
    if (pct > 90) return "text-[var(--error)]";
    if (pct > 75) return "text-[var(--amber)]";
    return "text-[var(--green)]";
  };

  const getUsageBarColor = (budgeted: number, actual: number) => {
    if (budgeted === 0) return "bg-[var(--border)]";
    const pct = (actual / budgeted) * 100;
    if (pct > 90) return "bg-[var(--error)]";
    if (pct > 75) return "bg-[var(--amber)]";
    return "bg-[var(--green)]";
  };

  const tabs = [
    { id: "planner", label: "Budget Planner" },
    { id: "actual", label: "Budget vs Actual" },
  ];

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Budget & Finance"
        subtitle="Plan, track and manage school finances"
        actions={
          <>
            <Button onClick={saveBudget} loading={saving}>
              <MaterialIcon icon="save" />
              {saving ? "Saving..." : "Save Budget"}
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <MaterialIcon icon="print" />
              Print
            </Button>
          </>
        }
      />

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as "planner" | "actual")}
        className="mb-6"
      />

      <TabPanel activeTab={activeTab} tabId="planner">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="text-center">
            <CardBody>
              <div className="text-sm text-[var(--t3)]">Total Income</div>
              <div className="text-2xl font-bold text-[var(--green)]">
                UGX {totalIncome.toLocaleString()}
              </div>
            </CardBody>
          </Card>
          <Card className="text-center">
            <CardBody>
              <div className="text-sm text-[var(--t3)]">Total Expenses</div>
              <div className="text-2xl font-bold text-[var(--error)]">
                UGX {totalExpense.toLocaleString()}
              </div>
            </CardBody>
          </Card>
          <Card className="text-center">
            <CardBody>
              <div className="text-sm text-[var(--t3)]">Surplus / Deficit</div>
              <div
                className={`text-2xl font-bold ${surplus >= 0 ? "text-[var(--green)]" : "text-[var(--error)]"}`}
              >
                UGX {surplus.toLocaleString()}
              </div>
              {surplus < 0 && (
                <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-[var(--red-soft)] text-[var(--red)]">
                  DEFICIT
                </span>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Income</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                {INCOME_CATEGORIES.map((cat) => {
                  const item = budgetItems[cat.key];
                  return (
                    <div key={cat.key} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--t1)]">
                          {cat.label}
                        </div>
                        {cat.auto && (
                          <div className="text-xs text-[var(--t3)]">
                            {studentCount} students × UGX{" "}
                            {feePerTerm.toLocaleString()}
                          </div>
                        )}
                      </div>
                      <input
                        type="number"
                        value={item?.budgeted || 0}
                        onChange={(e) =>
                          updateBudgeted(cat.key, Number(e.target.value))
                        }
                        className="w-36 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] text-right focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        disabled={!!cat.auto}
                        aria-label={`Budgeted amount for ${cat.label}`}
                      />
                    </div>
                  );
                })}
                <div className="border-t border-[var(--border)] pt-3 flex items-center justify-between">
                  <span className="font-semibold text-[var(--t1)]">
                    Total Income
                  </span>
                  <span className="font-bold text-[var(--green)]">
                    UGX {totalIncome.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expenses</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                {EXPENSE_CATEGORIES.map((cat) => {
                  const item = budgetItems[cat.key];
                  return (
                    <div key={cat.key} className="flex items-center gap-3">
                      <div className="flex-1 text-sm font-medium text-[var(--t1)]">
                        {cat.label}
                      </div>
                      <input
                        type="number"
                        value={item?.budgeted || 0}
                        onChange={(e) =>
                          updateBudgeted(cat.key, Number(e.target.value))
                        }
                        className="w-36 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] text-right focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        aria-label={`Budgeted amount for ${cat.label}`}
                      />
                    </div>
                  );
                })}
                <div className="border-t border-[var(--border)] pt-3 flex items-center justify-between">
                  <span className="font-semibold text-[var(--t1)]">
                    Total Expenses
                  </span>
                  <span className="font-bold text-[var(--error)]">
                    UGX {totalExpense.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="actual">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <Card className="text-center">
            <CardBody>
              <div className="text-sm text-[var(--t3)]">Budget Income</div>
              <div className="text-xl font-bold text-[var(--t1)]">
                UGX {totalIncome.toLocaleString()}
              </div>
            </CardBody>
          </Card>
          <Card className="text-center">
            <CardBody>
              <div className="text-sm text-[var(--t3)]">Actual Income</div>
              <div className="text-xl font-bold text-[var(--green)]">
                UGX {actualIncome.toLocaleString()}
              </div>
            </CardBody>
          </Card>
          <Card className="text-center">
            <CardBody>
              <div className="text-sm text-[var(--t3)]">Budget Expenses</div>
              <div className="text-xl font-bold text-[var(--t1)]">
                UGX {totalExpense.toLocaleString()}
              </div>
            </CardBody>
          </Card>
          <Card className="text-center">
            <CardBody>
              <div className="text-sm text-[var(--t3)]">Actual Expenses</div>
              <div className="text-xl font-bold text-[var(--error)]">
                UGX {actualExpense.toLocaleString()}
              </div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Budget vs Actual by Category</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--surface-container)]">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--t2)]">
                    Category
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-[var(--t2)]">
                    Budget
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-[var(--t2)]">
                    Spent
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-[var(--t2)]">
                    Remaining
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-[var(--t2)]">
                    % Used
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].map((cat) => {
                  const item = budgetItems[cat.key];
                  if (!item) return null;
                  const remaining = item.budgeted - item.actual;
                  const pct =
                    item.budgeted > 0
                      ? Math.round((item.actual / item.budgeted) * 100)
                      : 0;
                  return (
                    <tr
                      key={cat.key}
                      className="border-b border-[var(--border)]"
                    >
                      <td className="px-4 py-3 font-medium text-[var(--t1)]">
                        {cat.label}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--t1)]">
                        UGX {item.budgeted.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--t1)]">
                        UGX {item.actual.toLocaleString()}
                      </td>
                      <td
                        className={`px-4 py-3 text-right ${remaining >= 0 ? "text-[var(--green)]" : "text-[var(--error)]"}`}
                      >
                        UGX {remaining.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-20 h-2 bg-[var(--surface-container)] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${getUsageBarColor(item.budgeted, item.actual)}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span
                            className={`text-sm font-medium ${getUsageColor(item.budgeted, item.actual)}`}
                          >
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {Object.values(budgetItems).some(
          (b) => b.budgeted > 0 && b.actual / b.budgeted > 0.9,
        ) && (
          <div className="bg-[var(--red-soft)] border border-[var(--red)]/20 rounded-xl p-4 mt-6 flex items-center gap-3">
            <MaterialIcon
              icon="warning"
              className="text-[var(--red)] text-2xl"
            />
            <div>
              <div className="font-semibold text-[var(--red)]">
                Budget Alert
              </div>
              <div className="text-sm text-[var(--red)]">
                {Object.values(budgetItems)
                  .filter((b) => b.budgeted > 0 && b.actual / b.budgeted > 0.9)
                  .map((b) => {
                    const cat = [
                      ...INCOME_CATEGORIES,
                      ...EXPENSE_CATEGORIES,
                    ].find((c) => c.key === b.category);
                    return `${cat?.label || b.category} budget ${Math.round((b.actual / b.budgeted) * 100)}% used`;
                  })
                  .join(", ")}
              </div>
            </div>
          </div>
        )}
      </TabPanel>

      {loading && (
        <Card>
          <CardBody className="text-center py-8">
            <div className="h-4 w-32 mx-auto bg-[var(--surface-container)] rounded animate-pulse" />
          </CardBody>
        </Card>
      )}
    </div>
    </PageErrorBoundary>
  );
}
