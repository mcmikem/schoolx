"use client";

/** Shared POS helpers — pure functions kept here so they are unit-testable. */

export function getCartKey(item: { id: string; variant?: string | null }): string {
  return `${item.id}::${item.variant ?? ""}`;
}

export function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) return "0";
  const rounded = Math.round(qty * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded.toFixed(2)).replace(/0+$/, "").replace(/\.$/, "");
}

export function parseQtyInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

export function clampQty(qty: number, stock: number): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const rounded = Math.round(qty * 100) / 100;
  const cap = Math.max(0, Number(stock || 0));
  return Math.min(rounded, cap);
}

export function calcChange(tendered: number, total: number): number {
  return Math.round((tendered - total) * 100) / 100;
}

export function validateCashCheckout(args: {
  total: number;
  tendered: number | null;
  paymentMethod: "wallet" | "cash";
}): { ok: boolean; error?: string } {
  const { total, tendered, paymentMethod } = args;
  if (total <= 0) return { ok: false, error: "Cart is empty" };
  if (paymentMethod !== "cash") return { ok: true };
  if (tendered === null || !Number.isFinite(tendered)) {
    return { ok: false, error: "Enter cash received" };
  }
  if (tendered < total) {
    const short = Math.round((total - tendered) * 100) / 100;
    return {
      ok: false,
      error: `Insufficient cash: need UGX ${short.toLocaleString()} more`,
    };
  }
  return { ok: true };
}

export function validateWalletCheckout(args: { total: number; balance: number | null }): {
  ok: boolean;
  error?: string;
} {
  const { total, balance } = args;
  if (total <= 0) return { ok: false, error: "Cart is empty" };
  if (balance === null || !Number.isFinite(balance)) {
    return { ok: false, error: "Student wallet balance unknown" };
  }
  if (balance < total) {
    const short = Math.round((total - balance) * 100) / 100;
    return {
      ok: false,
      error: `Insufficient wallet balance: need UGX ${short.toLocaleString()} more`,
    };
  }
  return { ok: true };
}
