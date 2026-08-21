"use client";
import { ReactNode, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";

/**
 * Helper to generate a simple monochrome palette from a base hex color.
 * It returns an object mapping Tailwind shade keys to the same base color.
 * More sophisticated shade generation could be added later (e.g., using HSL).
 */
function generateMonochromePalette(base: string) {
  const shades: Record<string, string> = {};
  const suffixes = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"];
  for (const s of suffixes) {
    // For now, assign the base color to every shade.
    // This ensures Tailwind variables resolve to a consistent brand color.
    // Future improvement: generate light/dark variations via HSL manipulation.
    shades[`--primary-${s}`] = base;
  }
  return shades;
}

/** Blend a hex color toward white by `amount` (0..1). Used to make brand
    colors readable against dark surfaces without changing the light look. */
function lighten(hex: string, amount: number): string {
  const full = hex.replace("#", "");
  const h =
    full.length === 3
      ? full
          .split("")
          .map((c) => c + c)
          .join("")
      : full;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

export default function BrandProvider({ children }: { children: ReactNode }) {
  const { school } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === "dark";
    const base = school?.primary_color || "#005ce6";
    const accent = school?.accent_color || "#f97316";
    // In dark mode the brand color is lightened so solid fills and text stay
    // readable against dark surfaces (the inline var otherwise pins the light
    // value and the stylesheet token can never apply).
    const primary = isDark ? lighten(base, 0.55) : base;
    const accentColor = isDark ? lighten(accent, 0.45) : accent;

    root.style.setProperty("--primary", primary);
    root.style.setProperty("--accent", accentColor);
    root.style.setProperty("--on-primary", isDark ? "#0b1420" : "#ffffff");
    root.style.setProperty("--on-secondary", isDark ? "#031712" : "#ffffff");

    const palette = generateMonochromePalette(primary);
    for (const [varName, value] of Object.entries(palette)) {
      root.style.setProperty(varName, value);
    }

    const accentPalette = generateMonochromePalette(accentColor);
    for (const [varName, value] of Object.entries(accentPalette)) {
      root.style.setProperty(varName.replace("--primary", "--accent"), value);
    }

    root.style.setProperty("--primary-soft", `${primary}1A`);
    root.style.setProperty("--primary-dim", `${primary}66`);
    root.style.setProperty("--primary-glass", `${primary}33`);
    root.style.setProperty("--accent-soft", `${accentColor}1A`);
    root.style.setProperty("--accent-dim", `${accentColor}66`);
    root.style.setProperty("--accent-glass", `${accentColor}33`);
  }, [school?.primary_color, school?.accent_color, theme]);

  return <>{children}</>;
}
