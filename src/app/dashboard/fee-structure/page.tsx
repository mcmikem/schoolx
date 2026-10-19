"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NoData } from "@/components/EmptyState";
import FeeFormModal, { type FeeFormData } from "@/components/fees/FeeFormModal";
import { useToast } from "@/components/Toast";
import { Card, CardBody } from "@/components/ui/Card";
import { Button, DataTable, Input, Select, StatStrip, type DataColumn } from "@/components/ui/index";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAcademic } from "@/lib/academic-context";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/currency";
import { filterFeeStructure } from "@/lib/fee-structure";
import { useClasses, useFeeStructure } from "@/lib/hooks";
import { useListState } from "@/lib/hooks/useListState";
import type { FeeStructure } from "@/types";

function termLabel(fee: FeeStructure): string {
  if (fee.term) return `Term ${fee.term}`;
  return fee.frequency === "per_year" ? "Annual" : "One-off";
}

export default function FeeStructurePage() {
  const { school } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const toast = useToast();
  const { classes, loading: classesLoading } = useClasses(school?.id);
  const { feeStructure, loading, error, createFeeStructure, updateFeeStructure, deleteFeeStructure, refetch } =
    useFeeStructure(school?.id);
  const list = useListState({ defaultSort: { key: "name", dir: "asc" } });
  const classId = list.filters.class ?? "";
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

  const classNames = new Map(classes.map((item) => [item.id, item.name]));
  const feeClassName = (fee: FeeStructure) =>
    fee.class_id ? classNames.get(fee.class_id) || "Unknown class" : "All classes";

  const visibleFees = filterFeeStructure(feeStructure, { q: list.q, classId });

  const coveredClasses = new Set(visibleFees.map((fee) => fee.class_id).filter(Boolean)).size;
  const listedTotal = visibleFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);

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

  const columns: DataColumn<FeeStructure>[] = [
    {
      key: "name",
      header: "Fee",
      sortValue: (fee) => fee.name,
      render: (fee) => <span className="font-medium">{fee.name}</span>,
    },
    {
      key: "class",
      header: "Class",
      sortValue: feeClassName,
      render: feeClassName,
    },
    {
      key: "term",
      header: "Term",
      sortValue: (fee) => termLabel(fee),
      render: (fee) => (
        <span className="text-[var(--t2)]">
          {termLabel(fee)} · {fee.academic_year}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortValue: (fee) => Number(fee.amount),
      render: (fee) => <span className="font-bold text-[var(--primary)]">{formatCurrency(Number(fee.amount))}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      hideOnMobile: true,
      render: (fee) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" onClick={() => openForm(fee)} aria-label={`Edit ${fee.name}`}>
            Edit
          </Button>
          <Button variant="ghost" onClick={() => setDeleteId(fee.id)} aria-label={`Delete ${fee.name}`}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

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

      <StatStrip
        columns={3}
        items={[
          { label: "Fee items", value: visibleFees.length },
          { label: "Classes covered", value: coveredClasses, hint: "Whole-school fees excluded" },
          { label: "Listed total", value: formatCurrency(listedTotal), hint: "Sum of shown charges" },
        ]}
      />

      <Card>
        <CardBody className="space-y-5 p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Search fees"
              placeholder="Tuition, boarding, transport…"
              value={list.q}
              onChange={(event) => list.setQ(event.target.value)}
            />
            <Select
              label="Class"
              value={classId}
              onChange={(event) => list.setFilter("class", event.target.value)}
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
          ) : (
            <DataTable
              columns={columns}
              rows={visibleFees}
              getRowId={(fee) => fee.id}
              loading={loading}
              initialSort={{ key: "name", dir: "asc" }}
              caption="Fee structure"
              empty={
                <NoData
                  title={list.q || classId ? "No matching fees" : "No fees set yet"}
                  description={
                    list.q || classId
                      ? "Change your search or class filter."
                      : "Add the charges students should pay before collecting fees."
                  }
                />
              }
              footer={
                <span className="text-[var(--t3)]">
                  {visibleFees.length} fee{visibleFees.length === 1 ? "" : "s"} shown
                </span>
              }
              renderMobileCard={(fee) => (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-semibold break-words">{fee.name}</p>
                    <span className="shrink-0 font-bold text-[var(--primary)]">
                      {formatCurrency(Number(fee.amount))}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--t3)]">
                    {feeClassName(fee)} · {fee.boarding_status || "Day & boarding"}
                  </p>
                  <p className="text-xs text-[var(--t3)]">
                    {termLabel(fee)} · {fee.academic_year}
                  </p>
                  <div className="flex gap-1 pt-1">
                    <Button variant="ghost" onClick={() => openForm(fee)}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => setDeleteId(fee.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            />
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
