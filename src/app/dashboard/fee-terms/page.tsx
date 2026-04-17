"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, Badge } from "@/components/ui/index";
import { Modal } from "@/components/ui/Modal";

interface FeeTermLine {
  installment_number: number;
  due_days: number;
  amount_percentage: number;
  is_optional: boolean;
}

interface FeeTerm {
  id: string;
  name: string;
  code: string;
  description: string;
  term_type: string;
  total_amount: number;
  discount_percentage: number;
  is_active: boolean;
  academic_year: string;
  created_at: string;
  fee_term_lines?: FeeTermLine[];
}

export default function FeeTermsPage() {
  const { school } = useAuth();
  const toast = useToast();
  const [feeTerms, setFeeTerms] = useState<FeeTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showInstallments, setShowInstallments] = useState<string | null>(null);
  const [editingTerm, setEditingTerm] = useState<FeeTerm | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    term_type: "installments",
    total_amount: 0,
    discount_percentage: 0,
    is_active: true,
    academic_year: new Date().getFullYear().toString(),
  });

  const [installments, setInstallments] = useState<FeeTermLine[]>([
    {
      installment_number: 1,
      due_days: 30,
      amount_percentage: 100,
      is_optional: false,
    },
  ]);

  useEffect(() => {
    if (school?.id) fetchFeeTerms();
  }, [school?.id]);

  const fetchFeeTerms = async () => {
    if (!school?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("fee_terms")
      .select("*, fee_term_lines(*)")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load fee terms");
    } else {
      setFeeTerms(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!school?.id) return;

    // Validate installments
    const totalPct = installments.reduce(
      (sum, i) => sum + i.amount_percentage,
      0,
    );
    if (totalPct !== 100) {
      toast.error("Installments must total 100%");
      return;
    }

    const termPayload = {
      school_id: school.id,
      name: formData.name,
      code: formData.code,
      description: formData.description,
      term_type: formData.term_type,
      total_amount: formData.total_amount,
      discount_percentage: formData.discount_percentage,
      is_active: formData.is_active,
      academic_year: formData.academic_year,
    };

    let termId: string;

    if (editingTerm) {
      const { error } = await supabase
        .from("fee_terms")
        .update(termPayload)
        .eq("id", editingTerm.id);
      if (error) {
        toast.error("Failed to update fee term");
        return;
      }
      termId = editingTerm.id;
      // Delete existing lines and recreate
      await supabase
        .from("fee_term_lines")
        .delete()
        .eq("term_id", editingTerm.id);
    } else {
      const { data, error } = await supabase
        .from("fee_terms")
        .insert(termPayload)
        .select()
        .single();
      if (error) {
        toast.error("Failed to create fee term");
        return;
      }
      termId = data.id;
    }

    // Create installment lines
    const linesPayload = installments.map((line, i) => ({
      term_id: termId,
      installment_number: line.installment_number || i + 1,
      due_days: line.due_days,
      amount_percentage: line.amount_percentage,
      is_optional: line.is_optional,
    }));

    const { error: linesError } = await supabase
      .from("fee_term_lines")
      .insert(linesPayload);
    if (linesError) {
      toast.error("Failed to create installments");
    } else {
      toast.success(editingTerm ? "Fee term updated" : "Fee term created");
      setShowModal(false);
      fetchFeeTerms();
    }
  };

  const deleteTerm = async (termId: string) => {
    if (!confirm("Delete this fee term? All related data will be lost."))
      return;
    const { error } = await supabase
      .from("fee_terms")
      .delete()
      .eq("id", termId);
    if (error) {
      toast.error("Failed to delete term");
    } else {
      toast.success("Term deleted");
      fetchFeeTerms();
    }
  };

  const openModal = (term?: FeeTerm) => {
    if (term) {
      setEditingTerm(term);
      setFormData({
        name: term.name,
        code: term.code,
        description: term.description || "",
        term_type: term.term_type,
        total_amount: term.total_amount,
        discount_percentage: term.discount_percentage,
        is_active: term.is_active,
        academic_year: term.academic_year,
      });
      setInstallments(
        term.fee_term_lines?.map((l) => ({
          installment_number: l.installment_number,
          due_days: l.due_days,
          amount_percentage: l.amount_percentage,
          is_optional: l.is_optional,
        })) || [],
      );
    } else {
      setEditingTerm(null);
      setFormData({
        name: "",
        code: "",
        description: "",
        term_type: "installments",
        total_amount: 0,
        discount_percentage: 0,
        is_active: true,
        academic_year: new Date().getFullYear().toString(),
      });
      setInstallments([
        {
          installment_number: 1,
          due_days: 30,
          amount_percentage: 100,
          is_optional: false,
        },
      ]);
    }
    setShowModal(true);
  };

  const addInstallment = () => {
    const nextNum = installments.length + 1;
    const remainingPct =
      100 - installments.reduce((sum, i) => sum + i.amount_percentage, 0);
    setInstallments([
      ...installments,
      {
        installment_number: nextNum,
        due_days: nextNum * 30,
        amount_percentage: remainingPct,
        is_optional: false,
      },
    ]);
  };

  const updateInstallment = (
    index: number,
    field: keyof FeeTermLine,
    value: any,
  ) => {
    const updated = [...installments];
    updated[index] = { ...updated[index], [field]: value };
    setInstallments(updated);
  };

  const removeInstallment = (index: number) => {
    if (installments.length === 1) return;
    setInstallments(installments.filter((_, i) => i !== index));
  };

  return (
    <PageErrorBoundary>
    <>
      <PageHeader
        title="Fee Terms"
        subtitle="Define payment structures with installments"
        actions={
          <Button
            onClick={() => openModal()}
            icon={<MaterialIcon icon="add" />}
          >
            Add Fee Term
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : feeTerms.length === 0 ? (
        <div className="text-center py-12">
          <MaterialIcon
            icon="payments"
            className="text-5xl text-gray-300 mx-auto mb-4"
          />
          <h3 className="text-lg font-medium text-gray-700">
            No fee terms configured
          </h3>
          <p className="text-gray-500 mt-1">
            Create fee terms to manage payments
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {feeTerms.map((term) => (
            <div
              key={term.id}
              className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{term.name}</h3>
                  <p className="text-sm text-gray-500">
                    {term.code} • {term.academic_year}
                  </p>
                </div>
                {!term.is_active && <Badge variant="default">Inactive</Badge>}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Amount</span>
                  <span className="font-medium">
                    UGX {term.total_amount.toLocaleString()}
                  </span>
                </div>
                {term.discount_percentage > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Discount</span>
                    <span className="font-medium text-green-600">
                      {term.discount_percentage}%
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Installments</span>
                  <span className="font-medium">
                    {term.fee_term_lines?.length || 0}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() =>
                    setShowInstallments(
                      showInstallments === term.id ? null : term.id,
                    )
                  }
                  className="flex-1 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  {showInstallments === term.id ? "Hide" : "View"} Installments
                </button>
                <button
                  onClick={() => openModal(term)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <MaterialIcon icon="edit" />
                </button>
                <button
                  onClick={() => deleteTerm(term.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <MaterialIcon icon="delete" />
                </button>
              </div>

              {showInstallments === term.id && term.fee_term_lines && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Installments
                  </h4>
                  <div className="space-y-2">
                    {term.fee_term_lines.map((line, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-sm bg-gray-50 p-2 rounded"
                      >
                        <span>Installment {line.installment_number}</span>
                        <span className="font-medium">
                          {line.amount_percentage}% ({line.due_days} days)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTerm ? "Edit Fee Term" : "Add Fee Term"}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                placeholder="e.g., Term 1 Fees"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                placeholder="e.g., T1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-xl"
              rows={2}
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Amount (UGX)
              </label>
              <input
                type="number"
                value={formData.total_amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    total_amount: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount %
              </label>
              <input
                type="number"
                value={formData.discount_percentage}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    discount_percentage: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Academic Year
              </label>
              <input
                type="text"
                value={formData.academic_year}
                onChange={(e) =>
                  setFormData({ ...formData, academic_year: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Installments
              </label>
              <button
                type="button"
                onClick={addInstallment}
                className="text-sm text-blue-600 hover:underline"
              >
                + Add Installment
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {installments.map((inst, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                >
                  <span className="text-sm text-gray-500 w-24">
                    Installment {inst.installment_number}
                  </span>
                  <input
                    type="number"
                    value={inst.due_days}
                    onChange={(e) =>
                      updateInstallment(i, "due_days", parseInt(e.target.value))
                    }
                    className="w-20 px-2 py-1 border border-gray-200 rounded text-sm"
                    placeholder="Days"
                  />
                  <span className="text-sm text-gray-500">days,</span>
                  <input
                    type="number"
                    value={inst.amount_percentage}
                    onChange={(e) =>
                      updateInstallment(
                        i,
                        "amount_percentage",
                        parseFloat(e.target.value),
                      )
                    }
                    className="w-20 px-2 py-1 border border-gray-200 rounded text-sm"
                    placeholder="%"
                  />
                  <span className="text-sm text-gray-500">%</span>
                  {installments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeInstallment(i)}
                      className="text-red-500 hover:bg-red-50 p-1 rounded"
                    >
                      <MaterialIcon icon="close" className="text-lg" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="text-sm mt-1">
              Total:{" "}
              <span
                className={`font-medium ${installments.reduce((s, i) => s + i.amount_percentage, 0) === 100 ? "text-green-600" : "text-red-600"}`}
              >
                {installments.reduce((s, i) => s + i.amount_percentage, 0)}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.checked })
              }
              className="w-4 h-4"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              Active
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingTerm ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
    </PageErrorBoundary>
  );
}
