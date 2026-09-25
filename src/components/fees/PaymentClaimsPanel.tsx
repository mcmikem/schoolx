import MaterialIcon from "@/components/MaterialIcon";
import { Button } from "@/components/ui";

type PaymentClaim = {
  id: string;
  amount: number;
  claimed_method: string;
  reference: string | null;
  note: string | null;
  status: string;
  created_at: string;
  student_id: string;
  students?: { first_name?: string; last_name?: string; class?: { name?: string } | null } | null;
};

const METHOD_LABEL: Record<string, string> = {
  mobile_money: "Mobile Money",
  cash: "Cash",
  bank: "Bank transfer",
  in_kind: "In kind",
};

export default function PaymentClaimsPanel({
  claims,
  loading,
  onReview,
  busyId,
}: {
  claims: PaymentClaim[];
  loading: boolean;
  onReview: (claimId: string, decision: "approve" | "reject") => void;
  busyId: string | null;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-[var(--surface-container-low)] animate-pulse" />
        ))}
      </div>
    );
  }

  if (claims.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
        <MaterialIcon icon="task_alt" className="text-5xl text-[var(--green)]" />
        <p className="font-bold text-[var(--t1)]">No payments waiting</p>
        <p className="text-sm text-[var(--t3)] max-w-[320px]">
          When a parent says they have paid, their claim appears here for you to confirm.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--primary-50)] p-3 text-sm text-[var(--t2)] flex items-start gap-2">
        <MaterialIcon icon="info" className="text-[var(--primary)] shrink-0" />
        <span>
          Confirm only after the money has actually reached the school. Approving records the payment on the
          student&apos;s account immediately.
        </span>
      </div>

      {claims.map((claim) => {
        const name = claim.students
          ? `${claim.students.first_name ?? ""} ${claim.students.last_name ?? ""}`.trim()
          : "Student";
        const busy = busyId === claim.id;
        return (
          <div key={claim.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-[var(--t1)] truncate">{name}</p>
                <p className="text-xs text-[var(--t3)]">
                  {claim.students?.class?.name || "Unassigned"} · {new Date(claim.created_at).toLocaleDateString()}
                </p>
              </div>
              <p className="text-lg font-black text-[var(--primary)] shrink-0">
                UGX {Number(claim.amount).toLocaleString()}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 rounded-full bg-[var(--surface-container)] text-[var(--t2)] font-semibold">
                {METHOD_LABEL[claim.claimed_method] ?? claim.claimed_method}
              </span>
              {claim.reference ? (
                <span className="px-2 py-1 rounded-full bg-[var(--surface-container)] font-mono text-[var(--t2)]">
                  Ref: {claim.reference}
                </span>
              ) : null}
            </div>

            {claim.note ? <p className="text-sm text-[var(--t2)] italic">“{claim.note}”</p> : null}

            <div className="flex gap-2 pt-1">
              <Button
                onClick={() => onReview(claim.id, "approve")}
                loading={busy}
                className="flex-1"
                aria-label={`Confirm payment of UGX ${Number(claim.amount).toLocaleString()} for ${name}`}
              >
                <MaterialIcon icon="check" /> Confirm received
              </Button>
              <Button
                variant="ghost"
                onClick={() => onReview(claim.id, "reject")}
                disabled={busy}
                aria-label={`Reject payment claim for ${name}`}
              >
                Reject
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
