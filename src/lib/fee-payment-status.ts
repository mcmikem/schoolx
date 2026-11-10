export type LocalSyncStatus = "pending" | "synced";
export const FEE_PAYMENT_SYNCED_EVENT = "skoolmate:fee-payment-synced";

export interface FeePaymentSyncState {
  offline_sync_status?: LocalSyncStatus;
}

/** An offline queue entry is a recorded intent, not confirmed money received. */
export function isConfirmedFeePayment(payment: FeePaymentSyncState): boolean {
  return payment.offline_sync_status !== "pending";
}

export function confirmedFeePayments<T>(payments: T[]): T[] {
  return payments.filter((payment) => isConfirmedFeePayment(payment as FeePaymentSyncState));
}
