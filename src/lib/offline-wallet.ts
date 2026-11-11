type OfflineStudentRow = Record<string, unknown> & {
  id?: unknown;
  school_id?: unknown;
};

type OfflineWalletRow = Record<string, unknown> & {
  id?: unknown;
  school_id?: unknown;
  student_id?: unknown;
  balance?: unknown;
};

interface QueuedOfflineRecord {
  table?: string;
  synced?: boolean;
  status?: string;
  data?: Record<string, unknown>;
}

export interface CachedPOSStudent {
  id: string;
  first_name: string;
  last_name: string;
  student_number: string;
  balance: number;
  walletAvailable: boolean;
  photo_url?: string;
}

/** Resolve a canteen lookup only from records for this school that were saved on this device. */
export function findCachedPOSStudent(
  students: OfflineStudentRow[],
  wallets: OfflineWalletRow[],
  schoolId: string,
  identifier: string,
): CachedPOSStudent | null {
  const query = identifier.trim();
  if (!query) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);
  const student = students.find(
    (row) =>
      row.school_id === schoolId &&
      (isUuid ? row.id === query : String(row.student_number ?? "").toLowerCase() === query.toLowerCase()),
  );
  if (!student || typeof student.id !== "string") return null;

  const wallet = wallets.find((row) => row.school_id === schoolId && row.student_id === student.id);
  const balance = Number(wallet?.balance ?? 0);
  return {
    id: student.id,
    first_name: String(student.first_name ?? ""),
    last_name: String(student.last_name ?? ""),
    student_number: String(student.student_number ?? ""),
    balance: Number.isFinite(balance) ? Math.max(0, balance) : 0,
    walletAvailable: Boolean(wallet),
    ...(typeof student.photo_url === "string" ? { photo_url: student.photo_url } : {}),
  };
}

/** Reapply unsynced wallet purchases after a server refresh so fresh pulls do not erase local pending debits. */
export function reconcileCachedWalletRows<T extends OfflineWalletRow>(wallets: T[], queue: QueuedOfflineRecord[]): T[] {
  const deductions = new Map<string, number>();
  for (const item of queue) {
    if (item.table !== "canteen_sales" || item.synced || item.status === "synced") continue;
    const pending = item.data?.pending_wallet_deduction as { student_id?: unknown; amount?: unknown } | undefined;
    if (typeof pending?.student_id !== "string") continue;
    const amount = Number(pending.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    deductions.set(pending.student_id, (deductions.get(pending.student_id) ?? 0) + amount);
  }

  return wallets.map((wallet) => {
    const deduction = typeof wallet.student_id === "string" ? deductions.get(wallet.student_id) : undefined;
    if (deduction === undefined) return wallet;
    const balance = Number(wallet.balance ?? 0);
    return { ...wallet, balance: Math.max(0, (Number.isFinite(balance) ? balance : 0) - deduction) };
  });
}
