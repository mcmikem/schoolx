"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NoData } from "@/components/EmptyState";
import FeeFormModal, { type FeeFormData } from "@/components/fees/FeeFormModal";
import { useToast } from "@/components/Toast";
import { Card, CardBody } from "@/components/ui/Card";
import { Button, Input, Select } from "@/components/ui/index";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useAcademic } from "@/lib/academic-context";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/currency";
import { useClasses, useFeeStructure } from "@/lib/hooks";
import type { FeeStructure } from "@/types";

export default function FeeStructurePage() {
  const { school } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const toast = useToast();
  const { classes, loading: classesLoading } = useClasses(school?.id);
  const { feeStructure, loading, error, createFeeStructure, updateFeeStructure, deleteFeeStructure, refetch } =
    useFeeStructure(school?.id);
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const emptyForm: FeeFormData = {
    name: "",
    class_id: "",
    amount: "",
    term: currentTerm || 1,
    due_date: "",
    category: "tuition",
    boarding_status: "both",
    frequency: "per_term",
    transport_zone: "",
  };
  const [form, setForm] = useState<FeeFormData>(emptyForm);
  const visibleFees = feeStructure.filter(
    (fee) =>
      (!classId || !fee.class_id || fee.class_id === classId) &&
      fee.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const openForm = (fee?: FeeStructure) => {
    setEditingId(fee?.id || null);
    setForm(
      fee
        ? {
            name: fee.name,
            class_id: fee.class_id || "",
            amount: String(fee.amount),
            term: fee.term || currentTerm || 1,
            due_date: fee.due_date || "",
            category: (fee.category || "tuition") as FeeFormData["category"],
            boarding_status: fee.boarding_status || "both",
            frequency: fee.frequency || "per_term",
            transport_zone: fee.transport_zone || "",
          }
        : emptyForm,
    );
    setModalOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const existing = feeStructure.find((fee) => fee.id === editingId);
      const payload = {
        ...form,
        amount: Number(form.amount),
        term: form.frequency === "per_term" ? Number(form.term) : null,
        class_id: form.class_id || undefined,
        academic_year: existing?.academic_year || academicYear,
      };
      if (editingId) await updateFeeStructure(editingId, payload);
      else await createFeeStructure(payload);
      toast.success(editingId ? "Fee updated" : "Fee created");
      setModalOpen(false);
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Could not save fee");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteId || saving) return;
    setSaving(true);
    try {
      await deleteFeeStructure(deleteId);
      setDeleteId(null);
      toast.success("Fee deleted");
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Could not delete fee");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 min-w-0 p-4 sm:p-6 pb-24 sm:pb-6">
      <PageHeader
        title="Fee Structure"
        subtitle="Set charges by class, student type and billing frequency."
        actions={<Button onClick={() => openForm()}>Add Fee</Button>}
      />
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/dashboard/fees/" className="text-primary underline underline-offset-4">
          Collect fees
        </Link>
        <Link href="/dashboard/fee-ledger/" className="text-primary underline underline-offset-4">
          Payment ledger
        </Link>
      </div>
      <Card>
        <CardBody className="space-y-5 p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Search fees"
              placeholder="Tuition, boarding, transport…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select
              label="Class"
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              options={[
                { value: "", label: "All classes" },
                ...classes.map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
          </div>
          {error ? (
            <div role="alert" className="rounded-xl bg-[var(--error-container)] p-4">
              <p>{error}</p>
              <Button variant="ghost" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : loading ? (
            <TableSkeleton rows={5} />
          ) : visibleFees.length === 0 ? (
            <NoData
              title={search || classId ? "No matching fees" : "No fees set yet"}
              description={
                search || classId
                  ? "Change your search or class filter."
                  : "Add the charges students should pay before collecting fees."
              }
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--t3)]">{visibleFees.length} fee items</p>
              {visibleFees.map((fee) => (
                <div
                  key={fee.id}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <h2 className="font-semibold break-words">{fee.name}</h2>
                    <p className="mt-1 text-sm text-[var(--t3)]">
                      {classes.find((item) => item.id === fee.class_id)?.name || "All classes"} ·{" "}
                      {fee.boarding_status || "Day & boarding"}
                    </p>
                    <p className="mt-1 text-sm text-[var(--t3)]">
                      {fee.term ? `Term ${fee.term}` : fee.frequency === "per_year" ? "Annual" : "One-off"} ·{" "}
                      {fee.academic_year}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-auto font-bold text-primary sm:mr-3">{formatCurrency(Number(fee.amount))}</span>
                    <Button variant="ghost" onClick={() => openForm(fee)} aria-label={`Edit ${fee.name}`}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => setDeleteId(fee.id)} aria-label={`Delete ${fee.name}`}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
      <FeeFormModal
        isOpen={modalOpen}
        onClose={() => {
          if (!saving) setModalOpen(false);
        }}
        classes={classes}
        classesLoading={classesLoading}
        newFee={form}
        onFeeChange={(updates) => setForm((previous) => ({ ...previous, ...updates }))}
        onSubmit={save}
        saving={saving}
        isEditing={Boolean(editingId)}
      />
      <ConfirmDialog
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={remove}
        title="Delete fee?"
        message="This removes the fee from active charges. Existing payment records are kept."
        confirmLabel="Delete Fee"
        variant="danger"
        loading={saving}
      />
    </div>
  );
}
