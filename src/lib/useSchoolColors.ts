"use client";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export function useSchoolColors() {
  const { school } = useAuth();

  useEffect(() => {
    const root = document.documentElement;
    const primary = school?.primary_color || "#005ce6";
    const accent = school?.accent_color || "#f97316";

    root.style.setProperty("--primary", primary);
    root.style.setProperty("--accent", accent);

    return () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--accent");
    };
  }, [school?.primary_color, school?.accent_color]);
}
