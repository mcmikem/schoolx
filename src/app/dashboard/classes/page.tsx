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
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { getErrorMessage } from "@/lib/validation";
import { withTimeout } from "@/lib/hooks/utils";

interface ClassRow {
  id: string;
  name: string;
  level: string;
  stream: string | null;
  max_students: number;
  academic_year: string;
  class_teacher_id: string | null;
  teacher?: { full_name: string } | null;
  student_count?: number;
}

const CURRENT_YEAR = new Date().getFullYear().toString();

const BLANK_FORM = {
  name: "",
  level: "",
  stream: "",
  max_students: "60",
  academic_year: CURRENT_YEAR,
  class_teacher_id: "",
};

export default function ClassesPage() {
  const { school, isDemo } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState(CURRENT_YEAR);

  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRow | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ClassRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchClasses = useCallback(async () => {
    if (!school?.id) { setLoading(false); return; }
    if (isDemo) {
      setClasses([
        { id: "demo-1", name: "P.1A", level: "P.1", stream: "A", max_students: 60, academic_year: CURRENT_YEAR, class_teacher_id: null, student_count: 42 },
        { id: "demo-2", name: "P.2B", level: "P.2", stream: "B", max_students: 55, academic_year: CURRENT_YEAR, class_teacher_id: null, student_count: 38 },
        { id: "demo-3", name: "S.1 Science", level: "S.1", stream: "Science", max_students: 50, academic_year: CURRENT_YEAR, class_teacher_id: null, student_count: 45 },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await withTimeout(
        supabase
          .from("classes")
          .select("*, teacher:class_teacher_id(full_name)")
          .eq("school_id", school.id)
          .order("name")
          .then((r) => { if (r.error) throw r.error; return r.data; }),
        8000,
        [] as ClassRow[]
      );

      // Get student counts per class
      const classIds = (data || []).map((c: ClassRow) => c.id);
      let countMap: Record<string, number> = {};
      if (classIds.length > 0) {
        const students = await withTimeout(
          supabase.from("students").select("class_id").in("class_id", classIds).eq("status", "active")
            .then((r) => r.data || []),
          5000,
          [] as { class_id: string }[]
        );
        (students || []).forEach((s: { class_id: string }) => {
          countMap[s.class_id] = (countMap[s.class_id] || 0) + 1;
        });
      }

      setClasses((data || []).map((c: ClassRow) => ({ ...c, student_count: countMap[c.id] || 0 })));
    } catch (err) {
      toastRef.current.error(getErrorMessage(err, "Failed to load classes"));
    } finally {
      setLoading(false);
    }
  }, [school?.id, isDemo]);

  const fetchTeachers = useCallback(async () => {
    if (!school?.id || isDemo) return;
    const data = await withTimeout(
      supabase.from("users").select("id, full_name").eq("school_id", school.id)
        .in("role", ["teacher", "dos", "headmaster"]).eq("is_active", true).order("full_name")
        .then((r) => r.data || []),
      5000,
      [] as { id: string; full_name: string }[]
    );
    setTeachers(data);
  }, [school?.id, isDemo]);

  useEffect(() => { fetchClasses(); fetchTeachers(); }, [fetchClasses, fetchTeachers]);

  const openAdd = () => {
    setEditingClass(null);
    setForm(BLANK_FORM);
    setShowModal(true);
  };

  const openEdit = (cls: ClassRow) => {
    setEditingClass(cls);
    setForm({
      name: cls.name,
      level: cls.level,
      stream: cls.stream || "",
      max_students: String(cls.max_students),
      academic_year: cls.academic_year,
      class_teacher_id: cls.class_teacher_id || "",
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school?.id) return;
    if (!form.name.trim()) { toast.error("Class name is required"); return; }
    if (!form.level.trim()) { toast.error("Level is required (e.g. P.5, S.2)"); return; }
    const maxStudents = parseInt(form.max_students);
    if (!Number.isFinite(maxStudents) || maxStudents < 1 || maxStudents > 500) {
      toast.error("Max students must be between 1 and 500"); return;
    }

    setSaving(true);
    try {
      if (isDemo) {
        if (editingClass) {
          setClasses(prev => prev.map(c => c.id === editingClass.id
            ? { ...c, name: form.name.trim(), level: form.level.trim(), stream: form.stream.trim() || null, max_students: maxStudents, academic_year: form.academic_year }
            : c));
        } else {
          setClasses(prev => [{ id: `demo-${Date.now()}`, name: form.name.trim(), level: form.level.trim(), stream: form.stream.trim() || null, max_students: maxStudents, academic_year: form.academic_year, class_teacher_id: null, student_count: 0 }, ...prev]);
        }
        toast.success(editingClass ? "Class updated" : "Class created");
        setShowModal(false);
        return;
      }

      const payload = {
        school_id: school.id,
        name: form.name.trim(),
        level: form.level.trim(),
        stream: form.stream.trim() || null,
        max_students: maxStudents,
        academic_year: form.academic_year,
        class_teacher_id: form.class_teacher_id || null,
      };

      if (editingClass) {
        const updateError = await withTimeout(
          supabase.from("classes").update(payload).eq("id", editingClass.id).then((r) => r.error),
          8000,
          new Error("Update timed out — please try again")
        );
        if (updateError) throw updateError;
        toast.success("Class updated");
      } else {
        const insertError = await withTimeout(
          supabase.from("classes").insert(payload).then((r) => r.error),
          8000,
          new Error("Insert timed out — please try again")
        );
        if (insertError) {
          if ((insertError as any).code === "23505") throw new Error("A class with this name already exists for this year");
          throw insertError;
        }
        toast.success("Class created");
      }
      await fetchClasses();
      setShowModal(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save class"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = (cls: ClassRow) => {
    setPendingDelete(cls);
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      if (isDemo) {
        setClasses(prev => prev.filter(c => c.id !== pendingDelete.id));
        toast.success("Class deleted");
        setConfirmOpen(false);
        return;
      }
      const deleteError = await withTimeout(
        supabase.from("classes").delete().eq("id", pendingDelete.id).then((r) => r.error),
        8000,
        new Error("Delete timed out — please try again")
      );
      if (deleteError) throw deleteError;
      setClasses(prev => prev.filter(c => c.id !== pendingDelete.id));
      toast.success("Class deleted");
      setConfirmOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete class. Make sure no students are enrolled first."));
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const years = Array.from(new Set(classes.map(c => c.academic_year))).sort().reverse();
  if (!years.includes(CURRENT_YEAR)) years.unshift(CURRENT_YEAR);

  const filtered = classes.filter(c =>
    c.academic_year === yearFilter &&
    (search === "" || c.name.toLowerCase().includes(search.toLowerCase()) || c.level.toLowerCase().includes(search.toLowerCase()))
  );

  const totalStudents = filtered.reduce((sum, c) => sum + (c.student_count || 0), 0);
  const fullClasses = filtered.filter(c => (c.student_count || 0) >= c.max_students).length;

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="Classes"
          subtitle="Manage class groups, streams and class teachers"
          actions={
            <Button onClick={openAdd}>
              <MaterialIcon icon="add" />
              Add Class
            </Button>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Classes", value: filtered.length, icon: "class" },
            { label: "Total Students", value: totalStudents, icon: "group" },
            { label: "Full Classes", value: fullClasses, icon: "warning", warn: fullClasses > 0 },
            { label: "Academic Year", value: yearFilter, icon: "calendar_today" },
          ].map(s => (
            <Card key={s.label} className="!bg-[var(--surface-container-low)]">
              <CardBody className="flex items-center gap-3">
                <MaterialIcon icon={s.icon} className={`text-2xl ${s.warn ? "text-amber-500" : "text-[var(--primary)]"}`} />
                <div>
                  <p className="text-xs text-[var(--on-surface-variant)]">{s.label}</p>
                  <p className={`text-xl font-bold ${s.warn ? "text-amber-600" : "text-[var(--on-surface)]"}`}>{s.value}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MaterialIcon icon="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)] text-sm" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search classes…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <select
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Classes Table */}
        <Card>
          <CardBody className="p-0 overflow-x-auto">
            {loading ? (
              <div className="p-4"><TableSkeleton rows={5} /></div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon="class"
                title="No classes found"
                description={search ? "No classes match your search" : "Create your first class to get started"}
                action={{ label: "Add Class", onClick: openAdd }}
              />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left">
                    {["Class Name", "Level", "Stream", "Class Teacher", "Students", "Capacity", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filtered.map(cls => {
                    const pct = cls.max_students > 0 ? Math.round(((cls.student_count || 0) / cls.max_students) * 100) : 0;
                    const isFull = pct >= 100;
                    return (
                      <tr key={cls.id} className="hover:bg-[var(--surface-container-low)] transition-colors">
                        <td className="px-4 py-3 font-semibold text-[var(--on-surface)]">{cls.name}</td>
                        <td className="px-4 py-3 text-[var(--on-surface-variant)]">{cls.level}</td>
                        <td className="px-4 py-3 text-[var(--on-surface-variant)]">{cls.stream || "—"}</td>
                        <td className="px-4 py-3 text-[var(--on-surface-variant)]">
                          {(cls.teacher as { full_name: string } | null)?.full_name || <span className="italic text-[var(--outline)]">Unassigned</span>}
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--on-surface)]">{cls.student_count ?? 0}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-[var(--surface-container-highest)] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${isFull ? "bg-red-500" : pct > 80 ? "bg-amber-400" : "bg-[var(--primary)]"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${isFull ? "text-red-600" : "text-[var(--on-surface-variant)]"}`}>{cls.student_count}/{cls.max_students}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => openEdit(cls)} className="p-1.5 rounded-lg hover:bg-[var(--surface-container)] transition-colors text-[var(--on-surface-variant)] hover:text-[var(--primary)]" title="Edit class">
                              <MaterialIcon icon="edit" style={{ fontSize: 16 }} />
                            </button>
                            <button onClick={() => handleDeleteConfirm(cls)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-[var(--on-surface-variant)] hover:text-red-600" title="Delete class">
                              <MaterialIcon icon="delete" style={{ fontSize: 16 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        {/* Add / Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
            <div className="bg-[var(--surface)] rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--on-surface)]">{editingClass ? "Edit Class" : "Add Class"}</h2>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-[var(--surface-container)] transition-colors">
                  <MaterialIcon icon="close" className="text-[var(--on-surface-variant)]" />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wide mb-1.5">Class Name *</label>
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. P.5A, S.2 Science"
                      maxLength={50}
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wide mb-1.5">Level *</label>
                    <input
                      value={form.level}
                      onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                      placeholder="e.g. P.5, S.2"
                      maxLength={20}
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wide mb-1.5">Stream</label>
                    <input
                      value={form.stream}
                      onChange={e => setForm(f => ({ ...f, stream: e.target.value }))}
                      placeholder="e.g. A, Science, Arts"
                      maxLength={30}
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wide mb-1.5">Max Students</label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={form.max_students}
                      onChange={e => setForm(f => ({ ...f, max_students: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wide mb-1.5">Academic Year</label>
                    <input
                      value={form.academic_year}
                      onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))}
                      placeholder={CURRENT_YEAR}
                      maxLength={9}
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                  {teachers.length > 0 && (
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wide mb-1.5">Class Teacher</label>
                      <select
                        value={form.class_teacher_id}
                        onChange={e => setForm(f => ({ ...f, class_teacher_id: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      >
                        <option value="">— Unassigned —</option>
                        {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving ? "Saving…" : editingClass ? "Save Changes" : "Create Class"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmDialog
          isOpen={confirmOpen}
          title="Delete Class"
          message={pendingDelete ? `Delete "${pendingDelete.name}"? This cannot be undone. Make sure no students are enrolled in this class first.` : ""}
          confirmLabel={deleting ? "Deleting…" : "Delete"}
          onConfirm={() => { handleDelete(); }}
          onClose={() => { setConfirmOpen(false); setPendingDelete(null); }}
        />
      </div>
    </PageErrorBoundary>
  );
}
