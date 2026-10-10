"use client";
import { ReactNode, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";

/**
 * Build a real tint ramp from a brand hex color. Low shades blend toward
 * white (tinted surfaces stay light, text on them stays readable), the
 * middle holds the brand, high shades deepen toward black.
 */
export function generateMonochromePalette(base: string) {
  return {
    "--primary-50": mixToward(base, "#ffffff", 0.93),
    "--primary-100": mixToward(base, "#ffffff", 0.82),
    "--primary-200": mixToward(base, "#ffffff", 0.62),
    "--primary-300": mixToward(base, "#ffffff", 0.42),
    "--primary-400": mixToward(base, "#ffffff", 0.22),
    "--primary-500": base,
    "--primary-600": base,
    "--primary-700": mixToward(base, "#000000", 0.15),
    "--primary-800": mixToward(base, "#000000", 0.3),
    "--primary-900": mixToward(base, "#000000", 0.45),
  } as Record<string, string>;
}

/** Blend a hex color toward a target hex by `amount` (0..1). */
export function mixToward(hex: string, target: string, amount: number): string {
  const parse = (h: string): [number, number, number] => {
    const full = h.replace("#", "");
    const six =
      full.length === 3
        ? full
            .split("")
            .map((c) => c + c)
            .join("")
        : full;
    return [parseInt(six.slice(0, 2), 16), parseInt(six.slice(2, 4), 16), parseInt(six.slice(4, 6), 16)];
  };
  const [r, g, b] = parse(hex);
  const [tr, tg, tb] = parse(target);
  const mix = (c: number, t: number) => Math.round(c + (t - c) * amount);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r, tr))}${toHex(mix(g, tg))}${toHex(mix(b, tb))}`;
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
    const primary = isDark ? mixToward(base, "#ffffff", 0.55) : base;
    const accentColor = isDark ? mixToward(accent, "#ffffff", 0.45) : accent;

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
