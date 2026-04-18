"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, Badge } from "@/components/ui/index";
import { Modal } from "@/components/ui/Modal";
import { getErrorMessage } from "@/lib/validation";

interface AcademicTerm {
  id: string;
  name: string;
  code: string;
  start_date: string;
  end_date: string;
  term_number: number;
  academic_year: string;
  is_active: boolean;
  is_current: boolean;
}

export default function AcademicTermsPage() {
  const { school, user } = useAuth();
  const toast = useToast();
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState<AcademicTerm | null>(null);
  const canManageTerms = user?.role === "headmaster";

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    start_date: "",
    end_date: "",
    term_number: 1,
    academic_year: new Date().getFullYear().toString(),
    is_active: true,
  });

  const fetchTerms = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("academic_terms")
      .select("*")
      .eq("school_id", school.id)
      .order("academic_year", { ascending: false })
      .order("term_number");

    if (error) {
      toast.error("Failed to load terms");
    } else {
      setTerms(data || []);
    }
    setLoading(false);
  }, [school?.id, toast]);

  useEffect(() => {
    if (school?.id) fetchTerms();
  }, [school?.id, fetchTerms]);

  const handleSubmit = async () => {
    if (!school?.id || !canManageTerms) return;
    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error("Term name and code are required");
      return;
    }
    if (!formData.start_date || !formData.end_date) {
      toast.error("Start and end dates are required");
      return;
    }
    if (formData.end_date < formData.start_date) {
      toast.error("End date cannot be earlier than the start date");
      return;
    }

    const payload = {
      school_id: school.id,
      ...formData,
      name: formData.name.trim(),
      code: formData.code.trim(),
      term_number: parseInt(formData.term_number.toString()),
    };

    if (editingTerm) {
      const { error } = await supabase
        .from("academic_terms")
        .update(payload)
        .eq("id", editingTerm.id);

      if (error) {
        toast.error(getErrorMessage(error, "Failed to update term"));
      } else {
        toast.success("Term updated");
        setShowModal(false);
        fetchTerms();
      }
    } else {
      const { error } = await supabase.from("academic_terms").insert(payload);

      if (error) {
        toast.error(getErrorMessage(error, "Failed to create term"));
      } else {
        toast.success("Term created");
        setShowModal(false);
        fetchTerms();
      }
    }
  };

  const setCurrentTerm = async (termId: string) => {
    if (!canManageTerms) return;
    const { error } = await supabase.rpc("set_current_term", {
      p_term_id: termId,
    });
    if (error) {
      toast.error(getErrorMessage(error, "Failed to set current term"));
    } else {
      toast.success("Current term updated");
      fetchTerms();
    }
  };

  const deleteTerm = async (termId: string) => {
    if (!canManageTerms) return;
    if (!confirm("Delete this term?")) return;
    const { error } = await supabase
      .from("academic_terms")
      .delete()
      .eq("id", termId);
    if (error) {
      toast.error(getErrorMessage(error, "Failed to delete term"));
    } else {
      toast.success("Term deleted");
      fetchTerms();
    }
  };

  const openModal = (term?: AcademicTerm) => {
    if (term) {
      setEditingTerm(term);
      setFormData({
        name: term.name,
        code: term.code,
        start_date: term.start_date,
        end_date: term.end_date,
        term_number: term.term_number,
        academic_year: term.academic_year,
        is_active: term.is_active,
      });
    } else {
      setEditingTerm(null);
      setFormData({
        name: "",
        code: "",
        start_date: "",
        end_date: "",
        term_number: 1,
        academic_year: new Date().getFullYear().toString(),
        is_active: true,
      });
    }
    setShowModal(true);
  };

  const groupedTerms = terms.reduce(
    (acc, term) => {
      if (!acc[term.academic_year]) acc[term.academic_year] = [];
      acc[term.academic_year].push(term);
      return acc;
    },
    {} as Record<string, AcademicTerm[]>,
  );

  return (
    <PageErrorBoundary>
    <>
      <PageHeader
        title="Academic Terms"
        subtitle="Manage school terms and semesters"
        actions={
          canManageTerms ? (
            <Button
              onClick={() => openModal()}
              icon={<MaterialIcon icon="add" />}
            >
              Add Term
            </Button>
          ) : undefined
        }
      />

      {!canManageTerms && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Uganda term dates are preloaded. Only the headteacher can tweak the school calendar from this page.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : terms.length === 0 ? (
        <div className="text-center py-12">
          <MaterialIcon
            icon="calendar_today"
            className="text-5xl text-gray-300 mx-auto mb-4"
          />
          <h3 className="text-lg font-medium text-gray-700">
            No terms configured
          </h3>
          <p className="text-gray-500 mt-1">
            Add your first academic term to get started
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTerms).map(([year, yearTerms]) => (
            <div
              key={year}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
            >
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">
                  Academic Year {year}
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {yearTerms.map((term) => (
                  <div
                    key={term.id}
                    className="p-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${
                          term.is_current
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        T{term.term_number}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {term.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(term.start_date).toLocaleDateString()} -{" "}
                          {new Date(term.end_date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {term.is_current && (
                        <Badge variant="success">Current</Badge>
                      )}
                      {!term.is_active && (
                        <Badge variant="default">Inactive</Badge>
                      )}
                      <button
                        onClick={() =>
                          !term.is_current && setCurrentTerm(term.id)
                        }
                        className={`p-2 rounded-lg ${term.is_current || !canManageTerms ? "text-gray-300 cursor-not-allowed" : "text-blue-600 hover:bg-blue-50"}`}
                        disabled={term.is_current || !canManageTerms}
                        title="Set as current term"
                      >
                        <MaterialIcon icon="star" />
                      </button>
                      <button
                        onClick={() => openModal(term)}
                        className={`p-2 rounded-lg ${canManageTerms ? "text-gray-600 hover:bg-gray-100" : "text-gray-300 cursor-not-allowed"}`}
                        disabled={!canManageTerms}
                      >
                        <MaterialIcon icon="edit" />
                      </button>
                      <button
                        onClick={() => deleteTerm(term.id)}
                        className={`p-2 rounded-lg ${canManageTerms ? "text-red-600 hover:bg-red-50" : "text-gray-300 cursor-not-allowed"}`}
                        disabled={!canManageTerms}
                      >
                        <MaterialIcon icon="delete" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTerm ? "Edit Term" : "Add Term"}
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
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="e.g., Term 1"
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
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="e.g., T1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) =>
                  setFormData({ ...formData, end_date: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Term Number
              </label>
              <select
                value={formData.term_number}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    term_number: parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    Term {n}
                  </option>
                ))}
              </select>
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
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="2024"
              />
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
              className="w-4 h-4 text-blue-600 rounded"
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
