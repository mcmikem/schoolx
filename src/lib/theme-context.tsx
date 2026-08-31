"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "skoolmate-theme";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

// Mirrors the inline bootstrap script in src/app/layout.tsx so the initial
// React state matches what was painted before hydration (no flicker).
function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const fromWindow = (window as unknown as { __skoolmateTheme?: Theme }).__skoolmateTheme;
  if (fromWindow === "dark" || fromWindow === "light") return fromWindow;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // ignore storage access failures (private mode, blocked storage)
  }
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // Gate the value until after mount so the server-rendered (light) markup
  // hydrates without a mismatch; the real theme takes over on first paint.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const applyTheme = (t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
    // Sync PWA theme-color meta for mobile browser chrome
    try {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", t === "dark" ? "#0f1419" : "#001F3F");
    } catch {}
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore storage write failures
    }
    if (typeof document !== "undefined") {
      applyTheme(t);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const value: ThemeContextType = mounted
    ? { theme, toggleTheme, setTheme }
    : { theme: "light", toggleTheme: () => {}, setTheme: () => {} };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
