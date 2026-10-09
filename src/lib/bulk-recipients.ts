/**
 * Single source of truth for bulk-message audience filtering.
 *
 * The preview (MessageRecipients) and the send path (messages page) used to
 * implement this separately, which is how the outstanding-fees audience
 * silently matched the whole school: one branch was missing and nobody
 * noticed because the other copy looked right. Both call sites must use
 * these helpers so preview and send can never disagree again.
 */

export type BulkAudience = "all" | "class" | "outstanding_fees" | "custom";

export interface BulkRecipientStudent {
  id: string;
  parent_phone: string;
  class_id: string;
  classes?: { name: string };
}

interface AudienceOptions {
  classId?: string;
  selectedIds?: string[];
  /** Pupil ids with an unpaid fee balance. Null = not loaded yet. */
  debtorIds?: string[] | null;
}

export function filterBulkRecipients(
  students: BulkRecipientStudent[],
  audience: BulkAudience,
  opts: AudienceOptions = {},
): BulkRecipientStudent[] {
  let filtered = students.filter((s) => s.parent_phone);
  if (audience === "class" && opts.classId) {
    filtered = filtered.filter((s) => s.class_id === opts.classId);
  } else if (audience === "outstanding_fees") {
    // Null means "not loaded" — match NOBODY rather than falling through to
    // the whole school. The UI keeps send disabled until the list arrives.
    filtered = opts.debtorIds ? filtered.filter((s) => opts.debtorIds!.includes(s.id)) : [];
  } else if (audience === "custom") {
    filtered = filtered.filter((s) => (opts.selectedIds ?? []).includes(s.id));
  }
  return filtered;
}

export function countUniquePhones(students: BulkRecipientStudent[]): number {
  return new Set(students.filter((s) => s.parent_phone).map((s) => s.parent_phone)).size;
}
