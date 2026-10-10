import { generateMonochromePalette, mixToward } from "@/components/BrandProvider";

const luminance = (hex: string): number => {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe("generateMonochromePalette", () => {
  // Kikunyu's navy: the old generator assigned it to EVERY shade, so
  // tinted surfaces (Today pill, today cell) rendered navy-on-navy and the
  // text vanished. Navy base must still yield a light 50 and a darker 900.
  const navy = "#17325f";

  it("builds a real ramp instead of stamping the base on every shade", () => {
    const palette = generateMonochromePalette(navy);
    const values = Object.values(palette);
    expect(new Set(values).size).toBeGreaterThan(1);
    expect(palette["--primary-500"]).toBe(navy);
    expect(palette["--primary-600"]).toBe(navy);
  });

  it("keeps low shades light enough for brand-colored text", () => {
    const palette = generateMonochromePalette(navy);
    expect(luminance(palette["--primary-50"])).toBeGreaterThan(0.7);
    expect(luminance(palette["--primary-100"])).toBeGreaterThan(0.5);
  });

  it("deepens high shades instead of repeating the base", () => {
    const palette = generateMonochromePalette(navy);
    expect(luminance(palette["--primary-900"])).toBeLessThan(luminance(navy));
    expect(luminance(palette["--primary-700"])).toBeLessThanOrEqual(luminance(navy));
  });

  it("emits valid six-digit hex for every shade", () => {
    for (const value of Object.values(generateMonochromePalette("#005ce6"))) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("mixToward", () => {
  it("blends toward white and black at the extremes", () => {
    expect(mixToward("#17325f", "#ffffff", 1)).toBe("#ffffff");
    expect(mixToward("#17325f", "#000000", 1)).toBe("#000000");
    expect(mixToward("#17325f", "#ffffff", 0)).toBe("#17325f");
  });

  it("handles three-digit hex input", () => {
    expect(mixToward("#fff", "#000000", 1)).toBe("#000000");
  });
});
