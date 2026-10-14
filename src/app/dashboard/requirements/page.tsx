"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useClasses } from "@/lib/hooks";
import { useStudents } from "@/lib/hooks/students";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { Button, Modal, ModalFooter } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { useRequirements, type RequirementItem, type RequirementStatus } from "@/lib/hooks/requirements";
import { formatCurrency } from "@/lib/currency";

/**
 * School requirements — the second bill.
 *
 * Published per class and per term in the end-of-term circular. Frequently
 * larger than tuition. The money items are handed over at the bursar's counter
 * at reporting; the item ones are ticked off at the reception table. All of it
 * was being tracked on paper.
 *
 * This is the page used standing up, on a phone, often on a bad connection, so:
 *   - one pupil at a time, big targets
 *   - a tap settles an item and moves straight to the next
 *   - the list is the checklist, so nothing needs to be remembered
 *
 * Nothing here blocks an exam sitting. Withholding a registered candidate's
 * paper over fees is an offence in Uganda; the lawful lever is withholding the
 * report card, which is what the cleared count informs.
 */

type Tab = "board" | "items";

export default function RequirementsPage() {
  const { school } = useAuth();
  const { currentTerm, academicYear } = useAcademic();
  const toast = useToast();
  const { classes } = useClasses(school?.id);
  const { students } = useStudents(school?.id, { limit: 1000, fields: "full" });
  const { items, loading, error, summary, itemsForClass, progressFor, statusOf, addItem, removeItem, mark, refresh } =
    useRequirements(school?.id, currentTerm, academicYear);

  const [tab, setTab] = useState<Tab>("board");
  const [classId, setClassId] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    is_mandatory: true,
    is_monetary: false,
    amount: "",
    supplied_by_school: false,
  });

  const roster = useMemo(
    () =>
      students.map((s) => ({
        id: s.id,
        name: `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || s.student_number || "Unnamed",
        className: (s.classes as { name?: string } | undefined)?.name ?? (s.class_id ? "Unassigned" : "Unassigned"),
      })),
    [students],
  );

  const inClass = useMemo(
    () => (classId ? roster.filter((s) => s.className === classes.find((c) => c.id === classId)?.name) : roster),
    [classId, roster, classes],
  );

  const progress = useMemo(() => progressFor(inClass, classId || null), [progressFor, inClass, classId]);
  const cleared = progress.filter((p) => p.isCleared).length;
  const applicable = itemsForClass(classId || null);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name the requirement");
    if (form.is_monetary && !(Number(form.amount) > 0)) return toast.error("Enter the amount");
    setSaving(true);
    try {
      await addItem({
        class_id: classId || null,
        name: form.name,
        description: form.description || undefined,
        is_mandatory: form.is_mandatory,
        is_monetary: form.is_monetary,
        amount: form.is_monetary ? Number(form.amount) : null,
        supplied_by_school: form.supplied_by_school,
      });
      toast.success("Requirement added");
      setAddOpen(false);
      setForm({
        name: "",
        description: "",
        is_mandatory: true,
        is_monetary: false,
        amount: "",
        supplied_by_school: false,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the requirement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-24">
      <PageHeader
        title="Requirements"
        subtitle={`Term ${currentTerm} · ${academicYear}`}
        actions={
          tab === "items" ? (
            <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
              <MaterialIcon className="text-base mr-1">add</MaterialIcon> Add
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] px-4 py-3 text-sm text-[var(--t2)]">
          {error}{" "}
          <button className="font-semibold underline" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}

      <div className="flex gap-2 border-b border-[var(--border)]">
        {(
          [
            ["board", "Board"],
            ["items", `Items (${applicable.length})`],
          ] as const
        ).map(([id, text]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`min-h-[44px] px-4 text-sm font-semibold border-b-2 -mb-px ${
              tab === id ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--t3)]"
            }`}
          >
            {text}
          </button>
        ))}
      </div>

      {tab === "board" && (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--t2)]">Class</span>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
            >
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--t3)]">Cleared</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-[var(--green)]">
                {cleared}
                <span className="text-sm font-medium text-[var(--t3)]"> / {progress.length}</span>
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--t3)]">Money items</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-[var(--t1)]">
                {formatCurrency(summary.monetaryTotal)}
              </p>
            </div>
          </div>

          {applicable.length === 0 ? (
            <EmptyState
              title="No requirements published"
              body="Add the items and levies this class must bring. Money items are collected at the bursar's counter; items are ticked off at the desk."
              action={
                <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
                  Add the first requirement
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {progress.map((p) => (
                <PupilCard
                  key={p.studentId}
                  studentId={p.studentId}
                  name={p.name}
                  done={p.done}
                  total={p.total}
                  isCleared={p.isCleared}
                  items={applicable}
                  statusOf={statusOf}
                  onSettle={(item, status) =>
                    mark(p.studentId, item, status).catch((err) =>
                      toast.error(err instanceof Error ? err.message : "Could not save"),
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "items" && (
        <div className="space-y-2">
          <p className="rounded-xl bg-[var(--surface-container-low)] px-4 py-3 text-xs text-[var(--t2)]">
            Only these classes can levy for buildings, uniforms, textbooks, furniture or tests under the Education
            Regulations 2008. Mark an item optional if the school has no lawful basis to charge for it.
          </p>
          {applicable.length === 0 ? (
            <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--t3)]">
              Nothing published yet.
            </p>
          ) : (
            applicable.map((item) => (
              <article
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-[var(--t1)]">{item.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--t3)]">
                    {item.is_monetary ? `UGX ${formatCurrency(item.amount ?? 0)}` : (item.unit ?? "item to bring")}
                    {item.is_mandatory ? " · required" : " · optional"}
                    {item.supplied_by_school ? " · sold here" : ""}
                    {item.class_id ? " · this class only" : " · all classes"}
                  </p>
                </div>
                <button
                  onClick={() => removeItem(item.id).catch(() => toast.error("Could not remove"))}
                  aria-label={`Remove ${item.name}`}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--t3)]"
                >
                  <MaterialIcon className="text-lg">delete</MaterialIcon>
                </button>
              </article>
            ))
          )}
        </div>
      )}

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add a requirement">
        <div className="space-y-3">
          <Field label="What is it?">
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
              placeholder="e.g. 2 exercise books per subject"
            />
          </Field>
          <label className="flex min-h-[44px] items-center gap-3 text-sm text-[var(--t2)]">
            <input
              type="checkbox"
              checked={form.is_monetary}
              onChange={(e) => setForm((f) => ({ ...f, is_monetary: e.target.checked }))}
              className="h-5 w-5"
            />
            Money — collected at the counter
          </label>
          {form.is_monetary && (
            <Field label="Amount (UGX)">
              <input
                type="number"
                inputMode="numeric"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
              />
            </Field>
          )}
          <label className="flex min-h-[44px] items-center gap-3 text-sm text-[var(--t2)]">
            <input
              type="checkbox"
              checked={form.is_mandatory}
              onChange={(e) => setForm((f) => ({ ...f, is_mandatory: e.target.checked }))}
              className="h-5 w-5"
            />
            Required for every pupil
          </label>
          <label className="flex min-h-[44px] items-center gap-3 text-sm text-[var(--t2)]">
            <input
              type="checkbox"
              checked={form.supplied_by_school}
              onChange={(e) => setForm((f) => ({ ...f, supplied_by_school: e.target.checked }))}
              className="h-5 w-5"
            />
            Sold by the school
          </label>
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setAddOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            Add
          </Button>
        </ModalFooter>
      </Modal>

      {loading && <p className="text-center text-xs text-[var(--t3)]">Loading requirements…</p>}

      <p className="text-center text-xs text-[var(--t3)]">
        <Link href="/dashboard/fees" className="underline">
          Back to fees
        </Link>
      </p>
    </div>
  );
}

function PupilCard({
  studentId,
  name,
  done,
  total,
  isCleared,
  items,
  statusOf,
  onSettle,
}: {
  studentId: string;
  name: string;
  done: number;
  total: number;
  isCleared: boolean;
  items: RequirementItem[];
  statusOf: (studentId: string, requirementId: string) => RequirementStatus;
  onSettle: (item: RequirementItem, status: RequirementStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0 truncate text-[15px] font-semibold text-[var(--t1)]">{name}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              isCleared ? "bg-[var(--green-soft)] text-[var(--green)]" : "bg-[var(--amber-soft)] text-[var(--amber)]"
            }`}
          >
            {done}/{total}
          </span>
          <MaterialIcon className="text-[var(--t3)]">{open ? "expand_less" : "expand_more"}</MaterialIcon>
        </span>
      </button>

      {open && (
        <ul className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
          {items.map((item) => {
            const status = statusOf(studentId, item.id);
            const settled = status === "paid" || status === "brought" || status === "waived";
            return (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[13px] text-[var(--t2)]">
                  {item.name}
                  <span className="block text-[11px] text-[var(--t3)]">
                    {item.is_monetary ? `UGX ${formatCurrency(item.amount ?? 0)}` : (item.unit ?? "bring")}
                    {item.is_mandatory ? "" : " · optional"}
                  </span>
                </span>
                <button
                  onClick={() => onSettle(item, settled ? "pending" : item.is_monetary ? "paid" : "brought")}
                  disabled={!item.is_mandatory && settled}
                  className={`min-h-[44px] shrink-0 rounded-xl px-4 text-[13px] font-semibold ${
                    settled
                      ? "bg-[var(--green-soft)] text-[var(--green)]"
                      : "border border-[var(--border)] text-[var(--t2)]"
                  } ${!item.is_mandatory && settled ? "opacity-60" : ""}`}
                >
                  {settled ? "Done" : item.is_monetary ? "Paid" : "Brought"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
      <p className="text-sm font-bold text-[var(--t1)]">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--t3)]">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--t2)]">{label}</span>
      {children}
    </label>
  );
}
