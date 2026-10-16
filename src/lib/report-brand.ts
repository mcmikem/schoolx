/**
 * Brand colour handling for printed reports.
 *
 * `schools.primary_color` is typed by whoever administers the school, and it
 * ends up inside a `style="..."` attribute on every printed page. So it is
 * never interpolated raw: anything that is not a plain hex colour is rejected
 * and the default is used instead.
 *
 * On top of validation, a brand colour is chosen for a screen, not for paper.
 * A pale yellow or mint that reads fine behind dark text is invisible as a
 * rule or a watermark on white, and would make the report look broken. So the
 * colour is darkened until it is legible, and only then used.
 */

const DEFAULT_BRAND = "#1e3a5f";

/** Accepts #rgb / #rrggbb (and the same without #). Nothing else. */
export function normalizeHexColor(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed);
  if (!match) return null;
  const hex = match[1];
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  return `#${full.toLowerCase()}`;
}

function toRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export interface BrandPalette {
  /** Dark enough to read as a rule, border or watermark on white. */
  ink: string;
  /** Very light tint of the same hue, for fills behind the brand ink. */
  wash: string;
  /** Whether the school's own colour survived the contrast floor. */
  isBrand: boolean;
}

/**
 * Turn a school's colour into something printable.
 *
 * If the colour is unusable (not a hex) or too light to read on paper, the
 * default navy is used and `isBrand` is false, so callers can still tell the
 * difference rather than silently printing something unexpected.
 */
export function brandPalette(value: string | null | undefined): BrandPalette {
  const hex = normalizeHexColor(value);
  if (!hex) return { ink: DEFAULT_BRAND, wash: "#eef3fa", isBrand: false };

  // Walk the colour towards black until it clears the 3:1 that a thin rule or
  // a large watermark needs against white paper.
  let [r, g, b] = toRgb(hex);
  for (let i = 0; i < 24 && luminance(toHex([r, g, b])) > 0.19; i++) {
    r *= 0.9;
    g *= 0.9;
    b *= 0.9;
  }
  const ink = toHex([r, g, b]);
  const [wr, wg, wb] = toRgb(hex);
  return {
    ink,
    wash: toHex([wr + (255 - wr) * 0.86, wg + (255 - wg) * 0.86, wb + (255 - wb) * 0.86]),
    isBrand: ink !== hex,
  };
}