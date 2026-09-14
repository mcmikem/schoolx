import {
  getCartKey,
  formatQty,
  parseQtyInput,
  clampQty,
  calcChange,
  validateCashCheckout,
  validateWalletCheckout,
} from "@/lib/pos-utils";

describe("pos-utils", () => {
  test("getCartKey distinguishes variants", () => {
    expect(getCartKey({ id: "a" })).toBe("a::");
    expect(getCartKey({ id: "a", variant: "Large" })).toBe("a::Large");
  });

  test("formatQty trims trailing zeros", () => {
    expect(formatQty(2)).toBe("2");
    expect(formatQty(1.5)).toBe("1.5");
    expect(formatQty(1.5)).toBe("1.5");
  });

  test("parseQtyInput allows fractional quantities", () => {
    expect(parseQtyInput("1.5")).toBe(1.5);
    expect(parseQtyInput(" 2 ")).toBe(2);
    expect(parseQtyInput("0")).toBeNull();
    expect(parseQtyInput("-1")).toBeNull();
    expect(parseQtyInput("abc")).toBeNull();
    expect(parseQtyInput("")).toBeNull();
  });

  test("clampQty caps at stock", () => {
    expect(clampQty(3, 2)).toBe(2);
    expect(clampQty(1.5, 2)).toBe(1.5);
    expect(clampQty(0, 5)).toBe(0);
    expect(clampQty(1, 0)).toBe(0);
  });

  test("calcChange computes change due", () => {
    expect(calcChange(5000, 3000)).toBe(2000);
    expect(calcChange(2000, 3000)).toBe(-1000);
  });

  test("validateCashCheckout blocks underpaid cash", () => {
    expect(validateCashCheckout({ total: 3000, tendered: 2000, paymentMethod: "cash" }).ok).toBe(false);
    expect(validateCashCheckout({ total: 3000, tendered: null, paymentMethod: "cash" }).ok).toBe(false);
    expect(validateCashCheckout({ total: 3000, tendered: 3000, paymentMethod: "cash" }).ok).toBe(true);
    expect(validateCashCheckout({ total: 3000, tendered: 5000, paymentMethod: "cash" }).ok).toBe(true);
    expect(validateCashCheckout({ total: 0, tendered: 0, paymentMethod: "cash" }).ok).toBe(false);
  });

  test("validateWalletCheckout blocks insufficient balance", () => {
    expect(validateWalletCheckout({ total: 3000, balance: 2000 }).ok).toBe(false);
    expect(validateWalletCheckout({ total: 3000, balance: null }).ok).toBe(false);
    expect(validateWalletCheckout({ total: 3000, balance: 3000 }).ok).toBe(true);
  });
});
