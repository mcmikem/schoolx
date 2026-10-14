"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import { useClasses, useStudents } from "@/lib/hooks";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { TableSkeleton, FullPageLoader } from "@/components/ui/Skeleton";
import { EmptyState, NoData } from "@/components/EmptyState";
import { Button } from "@/components/ui/index";
import { Input, Select } from "@/components/ui/index";
import { logger } from "@/lib/logger";

interface FeeStructureItem {
  id: string;
  name: string;
  class_id?: string;
  amount: number;
  term: number;
  academic_year: string;
  due_date?: string;
  category?: string;
  boarding_status?: "day" | "all" | "boarding";
  frequency?: "per_term" | "per_annum";
  transport_zone?: string;
  description?: string;
}

export default function FeeStructurePage() {
  const { school, user, isDemo } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState<FeeStructureItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<FeeStructureItem>({
    name: "",
    class_id: "",
    amount: "",
    term: 1,
    academic_year: new Date().getFullYear().toString(),
    due_date: "",
  });

  useEffect(() => {
    if (!school?.id) return;
    async function load() {
      try {
        const { data, error } = await withTimeout(
          supabase.from("fee_structure").select("*").eq("school_id", school.id),
          15000,
          timeoutFallback(),
        );
        if (error) throw error;
        setItems(data || []);
      } catch (err) {
        logger.warn("Failed to load fee structure:", err);
        toast.error("Could not load fee structure");
      }
    }
    load();
  }, [school?.id]);

  const handleSave = useCallback(
    async (item: FeeStructureItem) => {
      if (editingId) {
        await withTimeout(supabase.from("fee_structure").update(item).eq("id", editingId), 15000, timeoutFallback());
        setItems((prev) => prev.map((i) => (i.id === editingId ? item : i)));
        setEditingId(null);
      } else {
        await withTimeout(
          supabase.from("fee_structure").insert({ ...item, school_id: school.id }),
          15000,
          timeoutFallback(),
        );
        setItems((prev) => [...prev, { ...item, id: Date.now().toString() }]);
      }
      setNewItem({
        name: "",
        class_id: "",
        amount: "",
        term: 1,
        academic_year: new Date().getFullYear().toString(),
        due_date: "",
      });
      toast.success("Fee structure item saved");
    },
    [editingId],
  );

  const handleDelete = useCallback(async (id: string) => {
    await withTimeout(supabase.from("fee_structure").delete().eq("id", id), 15000, timeoutFallback());
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("Fee structure item deleted");
  }, []);

  return (
    <PageHeader title="Fee Structure" subtitle="Manage fee structure items by class">
      <div className="space-y-6">
        <Card>
          <CardBody className="p-6">
            <h3 className="font-semibold mb-4">Fee Structure Items</h3>
            {items.length === 0 ? (
              <NoData
                title="No fee structure items yet"
                description="Add your first fee structure item using the form below."
              />
            ) : (
              <TableSkeleton rows={5} />
            )}

            {items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50 text-left">
                      <th className="px-6 py-3 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                        Name
                      </th>
                      <th className="px-6 py-3 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                        Class
                      </th>
                      <th className="px-6 py-3 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                        Term
                      </th>
                      <th className="px-6 py-3 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                        Category
                      </th>
                      <th className="px-6 py-3 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-y divide-y-divide-surface-container">
                        <td className="px-6 py-4">{item.name}</td>
                        <td className="px-6 py-4">
                          {item.class_id
                            ? classes.find((c) => c.id === item.class_id)?.name || "Unknown"
                            : "All classes"}
                        </td>
                        <td className="px-6 py-4">UGX {item.amount.toLocaleString()}</td>
                        <td className="px-6 py-4">{item.term}</td>
                        <td className="px-6 py-4">{item.category || "-"}</td>
                        <td className="px-6 py-4">
                          <Button variant="ghost" size="sm" onClick={() => setEditingId(item.id)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDelete(item.id)}>
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4">
              <Button
                variant="primary"
                onClick={() => setEditingId(null)}
                className="w-full bg-indigo-600 text-white py-3"
              >
                {editingId ? "Update" : "Add New Item"}
              </Button>
            </div>
          </CardBody>
        </Card>

        {editingId && (
          <Card>
            <CardBody className="p-6">
              <h4 className="font-semibold mb-4">{editingId ? "Edit Fee Item" : "Add New Fee Item"}</h4>
              <Input
                placeholder="Fee name"
                value={newItem.name}
                onChange={(e) => setNewItem((prev) => ({ ...prev, name: e.target.value }))}
              />
              <Input
                type="number"
                placeholder="Amount (UGX)"
                value={newItem.amount}
                onChange={(e) => setNewItem((prev) => ({ ...prev, amount: Number(e.target.value) || 0 }))}
                inputMode="numeric"
              />
              <Select
                value={newItem.term}
                onValueChange={(val) => setNewItem((prev) => ({ ...prev, term: Number(val) }))}
                placeholder="Term"
              >
                {[1, 2, 3].map((t) => (
                  <option key={t} value={t}>
                    Term {t}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="Academic year"
                value={newItem.academic_year}
                onChange={(e) => setNewItem((prev) => ({ ...prev, academic_year: e.target.value }))}
              />
              <Input
                placeholder="Due date (YYYY-MM-DD)"
                value={newItem.due_date}
                onChange={(e) => setNewItem((prev) => ({ ...prev, due_date: e.target.value }))}
              />
              <Select
                placeholder="Category"
                value={newItem.category}
                onValueChange={(val) => setNewItem((prev) => ({ ...prev, category: val }))}
              >
                <option value="tuition">Tuition</option>
                <option value="boarding">Boarding</option>
                <option value="transport">Transport</option>
                <option value="other">Other</option>
              </Select>
              <Button onClick={() => handleSave(newItem)} className="w-full mt-3 bg-indigo-600 text-white py-3">
                {editingId ? "Update" : "Save"}
              </Button>
              <Button variant="ghost" onClick={() => setEditingId(null)} className="w-full mt-2 text-gray-600 py-3">
                Cancel
              </Button>
            </CardBody>
          </Card>
        )}
      </div>
    </PageHeader>
  );
}
