"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { getErrorMessage } from "@/lib/validation";
import { withTimeout } from "@/lib/hooks/utils";
import { createRecord, updateRecord, deleteRecord, CrudWriteError } from "@/lib/crud-service";
import { getDefaultSubjects } from "@/lib/curriculum";

interface SubjectRow {
  id: string;
  name: string;
  code: string;
  level: "primary" | "secondary" | "both";
  is_compulsory: boolean;
  created_at: string;
}

const LEVEL_OPTIONS = [
  { value: "", label: "All Levels" },
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "both", label: "Both" },
] as const;

const BLANK_FORM = {
  name: "",
  code: "",
  level: "both" as "primary" | "secondary" | "both",
  is_compulsory: false,
};

export default function SubjectsPage() {
  const { school, isDemo } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectRow | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);

  const subjectValidationError = !form.name.trim()
    ? "Add a subject name to continue."
    : !form.code.trim()
      ? "Add a subject code (e.g. ENG, MATH)."
      : !form.level
        ? "Select a level (primary, secondary, or both)."
        : "";

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SubjectRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSubjects = useCallback(async () => {
    if (!school?.id) {
      setLoading(false);
      return;
    }
    if (isDemo) {
      setSubjects([
        {
          id: "demo-1",
          name: "English",
          code: "ENG",
          level: "both",
          is_compulsory: true,
          created_at: new Date().toISOString(),
        },
        {
          id: "demo-2",
          name: "Mathematics",
          code: "MATH",
          level: "both",
          is_compulsory: true,
          created_at: new Date().toISOString(),
        },
        {
          id: "demo-3",
          name: "Science",
          code: "SCI",
          level: "primary",
          is_compulsory: true,
          created_at: new Date().toISOString(),
        },
        {
          id: "demo-4",
          name: "Social Studies",
          code: "SST",
          level: "primary",
          is_compulsory: true,
          created_at: new Date().toISOString(),
        },
        {
          id: "demo-5",
          name: "Biology",
          code: "BIO",
          level: "secondary",
          is_compulsory: false,
          created_at: new Date().toISOString(),
        },
        {
          id: "demo-6",
          name: "Physics",
          code: "PHY",
          level: "secondary",
          is_compulsory: false,
          created_at: new Date().toISOString(),
        },
        {
          id: "demo-7",
          name: "Chemistry",
          code: "CHEM",
          level: "secondary",
          is_compulsory: false,
          created_at: new Date().toISOString(),
        },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await withTimeout(
        supabase
          .from("subjects")
          .select("*")
          .eq("school_id", school.id)
          .order("name")
          .then((r) => {
            if (r.error) throw r.error;
            return r.data as SubjectRow[];
          }),
        8000,
        [] as SubjectRow[],
      );
      setSubjects(data || []);
    } catch (err) {
      toastRef.current.error(getErrorMessage(err, "Failed to load subjects"));
    } finally {
      setLoading(false);
    }
  }, [school?.id, isDemo]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const openAdd = () => {
    setEditingSubject(null);
    setForm(BLANK_FORM);
    setShowModal(true);
  };

  const openEdit = (subj: SubjectRow) => {
    setEditingSubject(subj);
    setForm({
      name: subj.name,
      code: subj.code,
      level: subj.level,
      is_compulsory: subj.is_compulsory,
    });
    setShowModal(true);
  };

  const handleSeedFromCurriculum = async () => {
    if (!school?.id) return;
    if (isDemo) {
      toast.info("Demo mode: subjects are pre-populated");
      return;
    }
    const schoolType = subjects.length > 0 && subjects.every((s) => s.level === "secondary") ? "secondary" : "primary";
    const seeds = getDefaultSubjects(schoolType).map((s) => ({
      school_id: school.id,
      name: s.name,
      code: s.code,
      level: s.level,
      is_compulsory: s.is_compulsory,
    }));
    setSaving(true);
    try {
      const { error } = await withTimeout(
        supabase
          .from("subjects")
          .insert(seeds)
          .select("*")
          .then((r) => {
            if (r.error) throw r.error;
            return r;
          }),
        15000,
        null as never,
      );
      if (error) throw error;
      await fetchSubjects();
      toast.success(`${seeds.length} subjects added from Uganda curriculum`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to seed subjects"));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school?.id) return;
    if (subjectValidationError) {
      toast.error(subjectValidationError);
      return;
    }

    setSaving(true);
    try {
      if (isDemo) {
        if (editingSubject) {
          setSubjects((prev) =>
            prev.map((s) =>
              s.id === editingSubject.id
                ? {
                    ...s,
                    name: form.name.trim(),
                    code: form.code.trim().toUpperCase(),
                    level: form.level,
                    is_compulsory: form.is_compulsory,
                  }
                : s,
            ),
          );
        } else {
          setSubjects((prev) => [
            {
              id: `demo-${Date.now()}`,
              name: form.name.trim(),
              code: form.code.trim().toUpperCase(),
              level: form.level,
              is_compulsory: form.is_compulsory,
              created_at: new Date().toISOString(),
            },
            ...prev,
          ]);
        }
        toast.success(editingSubject ? "Subject updated" : "Subject created");
        setShowModal(false);
        return;
      }

      const payload = {
        school_id: school.id,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        level: form.level,
        is_compulsory: form.is_compulsory,
      };

      if (editingSubject) {
        await updateRecord(() => supabase.from("subjects").update(payload).eq("id", editingSubject.id), {
          timeoutMs: 8000,
          timeoutMessage: "Update timed out — please try again",
        });
        toast.success("Subject updated");
      } else {
        await createRecord(() => supabase.from("subjects").insert(payload), {
          timeoutMs: 8000,
          timeoutMessage: "Insert timed out — please try again",
        });
        toast.success("Subject created");
      }
      await fetchSubjects();
      setShowModal(false);
    } catch (err) {
      if (err instanceof CrudWriteError && err.code === "23505") {
        toast.error("A subject with this name or code already exists");
        return;
      }
      toast.error(getErrorMessage(err, "Failed to save subject"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = (subj: SubjectRow) => {
    setPendingDelete(subj);
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      if (isDemo) {
        setSubjects((prev) => prev.filter((s) => s.id !== pendingDelete.id));
        toast.success("Subject deleted");
        setConfirmOpen(false);
        return;
      }
      await deleteRecord(() => supabase.from("subjects").delete().eq("id", pendingDelete.id), {
        timeoutMs: 8000,
        timeoutMessage: "Delete timed out — please try again",
      });
      setSubjects((prev) => prev.filter((s) => s.id !== pendingDelete.id));
      toast.success("Subject deleted");
      setConfirmOpen(false);
    } catch (err) {
      toast.error(
        getErrorMessage(err, "Failed to delete subject. Make sure it is not assigned to any class or teacher first."),
      );
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const filtered = subjects.filter(
    (s) =>
      (levelFilter === "" || s.level === levelFilter) &&
      (search === "" ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase())),
  );

  const compulsoryCount = filtered.filter((s) => s.is_compulsory).length;
  const primaryCount = filtered.filter((s) => s.level === "primary" || s.level === "both").length;
  const secondaryCount = filtered.filter((s) => s.level === "secondary" || s.level === "both").length;

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="Subjects"
          subtitle="Manage subjects offered at your school"
          actions={
            <div className="flex gap-2">
              <Button onClick={handleSeedFromCurriculum} disabled={saving} variant="secondary">
                <MaterialIcon icon="auto_awesome" />
                Seed from Curriculum
              </Button>
              <Button onClick={openAdd}>
                <MaterialIcon icon="add" />
                Add Subject
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Subjects", value: filtered.length, icon: "menu_book" },
            { label: "Compulsory", value: compulsoryCount, icon: "star" },
            { label: "Primary", value: primaryCount, icon: "elementary" },
            { label: "Secondary", value: secondaryCount, icon: "school" },
          ].map((s) => (
            <Card key={s.label} className="!bg-[var(--surface-container-low)]">
              <CardBody className="flex items-center gap-3">
                <MaterialIcon icon={s.icon} className="text-2xl text-[var(--primary)]" />
                <div>
                  <p className="text-xs text-[var(--on-surface-variant)]">{s.label}</p>
                  <p className="text-xl font-bold text-[var(--on-surface)]">{s.value}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MaterialIcon
              icon="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)] text-sm"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subjects…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            {LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <Card>
          <CardBody className="p-0 overflow-x-auto">
            {loading ? (
              <div className="p-4">
                <TableSkeleton rows={5} />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon="menu_book"
                title="No subjects found"
                description={
                  search || levelFilter
                    ? "No subjects match your filters"
                    : "Add your first subject or seed from the Uganda curriculum"
                }
                action={{ label: "Add Subject", onClick: openAdd }}
              />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-container-low)]">
                    <th className="text-left px-4 py-3 font-medium text-[var(--on-surface-variant)]">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--on-surface-variant)]">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--on-surface-variant)]">Level</th>
                    <th className="text-center px-4 py-3 font-medium text-[var(--on-surface-variant)]">Compulsory</th>
                    <th className="text-right px-4 py-3 font-medium text-[var(--on-surface-variant)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((subj) => (
                    <tr
                      key={subj.id}
                      className="border-b border-[var(--border)] hover:bg-[var(--surface-container-low)] transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-[var(--on-surface)]">{subj.name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--primary)]/10 text-[var(--primary)]">
                          {subj.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--on-surface-variant)] capitalize">{subj.level}</td>
                      <td className="px-4 py-3 text-center">
                        <MaterialIcon
                          icon={subj.is_compulsory ? "check_circle" : "radio_button_unchecked"}
                          className={subj.is_compulsory ? "text-green-500" : "text-[var(--on-surface-variant)]"}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEdit(subj)}
                            className="p-2 rounded-lg hover:bg-[var(--surface-container)] transition-colors text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
                            title="Edit subject"
                          >
                            <MaterialIcon icon="edit" className="text-lg" />
                          </button>
                          <button
                            onClick={() => handleDeleteConfirm(subj)}
                            className="p-2 rounded-lg hover:bg-[var(--surface-container)] transition-colors text-[var(--on-surface-variant)] hover:text-red-500"
                            title="Delete subject"
                          >
                            <MaterialIcon icon="delete" className="text-lg" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        {/* Add/Edit Modal */}
        {showModal && (
          <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
            <form onSubmit={handleSave} className="p-6 space-y-4 max-w-md mx-auto">
              <h2 className="text-lg font-semibold text-[var(--on-surface)]">
                {editingSubject ? "Edit Subject" : "Add Subject"}
              </h2>

              <div>
                <label className="block text-sm font-medium text-[var(--on-surface-variant)] mb-1">Subject Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. English, Mathematics"
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--on-surface-variant)] mb-1">Subject Code</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                  placeholder="e.g. ENG, MATH"
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--on-surface-variant)] mb-1">Level</label>
                <select
                  value={form.level}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, level: e.target.value as "primary" | "secondary" | "both" }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  <option value="both">Both Primary & Secondary</option>
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_compulsory}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_compulsory: e.target.checked }))}
                  className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span className="text-sm text-[var(--on-surface)]">Compulsory subject</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" onClick={() => setShowModal(false)} variant="secondary">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || !!subjectValidationError}>
                  {saving ? (editingSubject ? "Updating…" : "Creating…") : editingSubject ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        <ConfirmDialog
          isOpen={confirmOpen}
          title="Delete Subject?"
          message={`Are you sure you want to delete "${pendingDelete?.name}"? This action cannot be undone and may affect existing grades, timetables, and allocations.`}
          confirmLabel={deleting ? "Deleting…" : "Delete"}
          onConfirm={handleDelete}
          onClose={() => {
            setConfirmOpen(false);
            setPendingDelete(null);
          }}
          variant="danger"
        />
      </div>
    </PageErrorBoundary>
  );
}
