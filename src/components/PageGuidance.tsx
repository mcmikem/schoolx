"use client";
import { useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";

interface HelpTip {
  icon?: string;
  text: string;
}

interface PageGuidanceProps {
  title: string;
  tips: HelpTip[];
  variant?: "default" | "warning" | "info";
  collapsed?: boolean;
  defaultOpen?: boolean;
}

export function PageGuidance({
  title,
  tips,
  variant = "default",
  collapsed = false,
  defaultOpen = true,
}: PageGuidanceProps) {
  const [isOpen, setIsOpen] = useState(!collapsed && defaultOpen);

  const variantStyles = {
    default: "bg-blue-soft text-blue",
    warning: "bg-amber-soft text-amber",
    info: "bg-green-soft text-green",
  };

  const iconMap = {
    default: "help_outline",
    warning: "warning",
    info: "check_circle",
  };

  // If collapsed, show as floating button
  if (collapsed) {
    return (
      <>
        {/* Floating button */}
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-[var(--navy)] text-white shadow-lg hover:shadow-xl transition-all hover:scale-105"
          title={title}
        >
          <MaterialIcon icon="help_outline" style={{ fontSize: 24 }} />
        </button>

        {/* Slide-out panel */}
        {isOpen && (
          <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setIsOpen(false)}>
            <div
              className="w-full max-w-md bg-[var(--surface)] h-full shadow-2xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between sticky top-0 bg-[var(--surface)]">
                <div className="text-sm font-semibold text-[var(--t1)]">{title}</div>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-[var(--bg)] rounded-lg">
                  <MaterialIcon style={{ fontSize: 20 }}>close</MaterialIcon>
                </button>
              </div>
              <div className="p-4 space-y-4">
                {tips.map((tip, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg)]">
                    {tip.icon && (
                      <MaterialIcon className="text-lg text-[var(--navy)] flex-shrink-0 mt-0.5">
                        {tip.icon}
                      </MaterialIcon>
                    )}
                    <span className="text-sm text-[var(--t2)]">{tip.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Default inline card
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mb-4 w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-container)] text-sm font-semibold text-[var(--t2)] hover:bg-[var(--surface-container-low)] transition-colors"
      >
        <MaterialIcon className="text-lg text-[var(--navy)]">{iconMap[variant]}</MaterialIcon>
        {title}
        <MaterialIcon className="ml-auto text-lg text-[var(--t4)]">expand_more</MaterialIcon>
      </button>
    );
  }

  return (
    <div className="mb-4 p-4 rounded-xl bg-[var(--surface-container)] border border-[var(--border)]">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg flex-shrink-0 ${variantStyles[variant]}`}>
          <MaterialIcon className="text-xl">{iconMap[variant]}</MaterialIcon>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-sm font-semibold text-[var(--t1)]">{title}</div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-[var(--t4)] hover:text-[var(--t2)] hover:bg-[var(--bg)]"
              aria-label={`Hide ${title}`}
            >
              <MaterialIcon style={{ fontSize: 18 }}>expand_less</MaterialIcon>
            </button>
          </div>
          <div className="text-xs text-[var(--t3)] space-y-1.5">
            {tips.map((tip, index) => (
              <p key={index} className="flex items-start gap-2">
                {tip.icon && <MaterialIcon className="text-base mt-0.5 flex-shrink-0">{tip.icon}</MaterialIcon>}
                <span>{tip.text}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
