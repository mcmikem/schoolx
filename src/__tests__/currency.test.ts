import { formatCompactCurrency, formatCurrency } from "@/lib/currency";

describe("formatCurrency", () => {
  it("writes the currency code and groups the digits", () => {
    expect(formatCurrency(0)).toBe("UGX 0");
    expect(formatCurrency(1234567)).toBe("UGX 1,234,567");
    expect(formatCurrency(2_019_600_000)).toBe("UGX 2,019,600,000");
  });

  it("rounds to whole shillings", () => {
    expect(formatCurrency(1234.6)).toBe("UGX 1,235");
  });

  it("keeps the sign on a credit", () => {
    expect(formatCurrency(-5000)).toBe("UGX -5,000");
  });

  it("degrades safely on values it cannot print", () => {
    expect(formatCurrency(Number.NaN)).toBe("UGX 0");
    expect(formatCurrency(Number.POSITIVE_INFINITY)).toBe("UGX 0");
  });

  it("is locale-stable rather than browser-dependent", () => {
    // en-US would give 1,234,567; de-DE would give 1.234.567. The app pins
    // one grouping so two schools on two machines read the same number.
    expect(formatCurrency(1234567).replace(/,/g, "")).toBe("UGX 1234567");
    expect(formatCurrency(1234567)).not.toContain(".");
  });
});

describe("formatCompactCurrency", () => {
  it("uses the unit the value actually sits in", () => {
    expect(formatCompactCurrency(0)).toBe("0");
    expect(formatCompactCurrency(450)).toBe("450");
    expect(formatCompactCurrency(1000)).toBe("1K");
    expect(formatCompactCurrency(12_000)).toBe("12K");
    expect(formatCompactCurrency(1_500_000)).toBe("1.5M");
    expect(formatCompactCurrency(2_019_600_000)).toBe("2.0B");
  });

  it("crosses into the next unit instead of printing 1000K", () => {
    // The regression this file exists for: 999,999/1000 rounds to "1000".
    expect(formatCompactCurrency(999_499)).toBe("999K");
    expect(formatCompactCurrency(999_500)).toBe("1.0M");
    expect(formatCompactCurrency(999_999)).toBe("1.0M");
    expect(formatCompactCurrency(1_000_000)).toBe("1.0M");
  });

  it("crosses into billions the same way", () => {
    expect(formatCompactCurrency(999_949_999)).toBe("999.9M");
    expect(formatCompactCurrency(999_950_000)).toBe("1.0B");
  });

  it("keeps the sign on a credit instead of dropping it", () => {
    expect(formatCompactCurrency(-5000)).toBe("-5K");
    expect(formatCompactCurrency(-1_500_000)).toBe("-1.5M");
  });

  it("adds the currency code only when asked", () => {
    expect(formatCompactCurrency(1_500_000, true)).toBe("UGX 1.5M");
    expect(formatCompactCurrency(-5000, true)).toBe("UGX -5K");
    expect(formatCompactCurrency(450, true)).toBe("UGX 450");
  });

  it("degrades safely on values it cannot print", () => {
    expect(formatCompactCurrency(Number.NaN)).toBe("0");
    expect(formatCompactCurrency(Number.POSITIVE_INFINITY)).toBe("0");
    expect(formatCompactCurrency(Number.NaN, true)).toBe("UGX 0");
  });
});
