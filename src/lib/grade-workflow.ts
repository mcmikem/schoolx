import type { GradeWorkflowStatus } from "@/lib/operations";

/**
 * The columns to write when a sheet lands on `nextStatus`, and — just as
 * importantly — the ones to clear when it retreats.
 *
 * Without the clearing, pulling a sheet back to "draft" left `approved_at` and
 * `published_at` populated: the status said draft while the audit trail still
 * claimed the marks had been approved and released to parents.
 */
const WORKFLOW_STAMP_COLUMNS: Record<Exclude<GradeWorkflowStatus, "draft">, string[]> = {
  submitted: ["submitted_at", "submitted_by"],
  approved: ["approved_at", "approved_by"],
  published: ["published_at", "published_by"],
};

const WORKFLOW_ORDER: GradeWorkflowStatus[] = ["draft", "submitted", "approved", "published"];

export function buildWorkflowUpdatePayload(
  nextStatus: GradeWorkflowStatus,
  userId: string,
  now: string = new Date().toISOString(),
): Record<string, unknown> {
  const payload: Record<string, unknown> = { status: nextStatus };

  const target = WORKFLOW_ORDER.indexOf(nextStatus);

  // Clear the stamps of every stage we are retreating *past* — those are the
  // claims that are no longer true. Earlier stages are deliberately left
  // alone: a sheet that was approved was still submitted, and erasing
  // `submitted_at` would throw away a real part of the audit trail.
  for (const stage of WORKFLOW_ORDER.slice(target + 1)) {
    // slice() never yields "draft" here, but the array's type still admits it.
    if (stage === "draft") continue;
    for (const column of WORKFLOW_STAMP_COLUMNS[stage]) {
      payload[column] = null;
    }
  }

  // …and set the one for the stage we are arriving at.
  if (nextStatus !== "draft") {
    const [atColumn, byColumn] = WORKFLOW_STAMP_COLUMNS[nextStatus];
    payload[atColumn] = now;
    payload[byColumn] = userId;
  }

  return payload;
}
