"use client";
import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { askOwly } from "@/lib/owly-bus";
import { DEFAULT_WHATSAPP_ENV, generateSupportWhatsAppLink } from "@/lib/support-contact";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  showToast: (
    message: string,
    type?: ToastType,
    duration?: number,
    action?: { label: string; onClick: () => void },
  ) => void;
  success: (message: string, action?: { label: string; onClick: () => void }) => void;
  error: (message: string, action?: { label: string; onClick: () => void }) => void;
  warning: (message: string, action?: { label: string; onClick: () => void }) => void;
  info: (message: string, action?: { label: string; onClick: () => void }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = "info",
      duration: number = 4000,
      action?: { label: string; onClick: () => void },
    ) => {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      const toast: Toast = { id, type, message, duration, action };

      setToasts((prev) => [...prev.slice(-2), toast]);

      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [removeToast],
  );

  const success = useCallback(
    (message: string, action?: { label: string; onClick: () => void }) => showToast(message, "success", 4000, action),
    [showToast],
  );
  const error = useCallback(
    (message: string, action?: { label: string; onClick: () => void }) => showToast(message, "error", 6000, action),
    [showToast],
  );
  const warning = useCallback(
    (message: string, action?: { label: string; onClick: () => void }) => showToast(message, "warning", 5000, action),
    [showToast],
  );
  const info = useCallback(
    (message: string, action?: { label: string; onClick: () => void }) => showToast(message, "info", 4000, action),
    [showToast],
  );

  const contextValue = useMemo(
    () => ({ showToast, success, error, warning, info }),
    [showToast, success, error, warning, info],
  );

  const icons = {
    success: "check_circle",
    error: "cancel",
    warning: "warning",
    info: "info",
  } as const;

  const colors = {
    success:
      "bg-[var(--surface-container-high,#ffffff)] border-l-4 border-l-[var(--green,#22c55e)] border-[var(--border)] text-[var(--t1)]",
    error:
      "bg-[var(--surface-container-high,#ffffff)] border-l-4 border-l-[var(--red,#ef4444)] border-[var(--border)] text-[var(--t1)]",
    warning:
      "bg-[var(--surface-container-high,#ffffff)] border-l-4 border-l-[var(--amber,#f59e0b)] border-[var(--border)] text-[var(--t1)]",
    info: "bg-[var(--surface-container-high,#ffffff)] border-l-4 border-l-[var(--primary,#005ce6)] border-[var(--border)] text-[var(--t1)]",
  };

  const iconColors = {
    success: "text-[var(--green,#22c55e)]",
    error: "text-[var(--red,#ef4444)]",
    warning: "text-[var(--amber,#f59e0b)]",
    info: "text-[var(--primary,#005ce6)]",
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      <div
        className="fixed bottom-[var(--mobile-nav-clearance)] left-1/2 z-[var(--z-toast)] pointer-events-none flex -translate-x-1/2 flex-col gap-2 px-4 sm:bottom-4 sm:left-auto sm:right-4 sm:translate-x-0 sm:px-0 max-w-[min(96vw,420px)] w-full"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const iconName = icons[toast.type];
          return (
            <div
              key={toast.id}
              className={`
                ${colors[toast.type]}
                border rounded-2xl p-4 shadow-[var(--sh2)]
                pointer-events-auto
                flex items-start gap-3
                animate-slide-up backdrop-blur-sm
              `}
            >
              <MaterialIcon icon={iconName} className={`mt-0.5 flex-shrink-0 ${iconColors[toast.type]}`} size={20} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{toast.message}</p>
                {(toast.action || toast.type === "error") && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {toast.action && (
                      <button
                        type="button"
                        onClick={() => {
                          toast.action?.onClick();
                          removeToast(toast.id);
                        }}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[var(--primary)] text-white hover:opacity-90 shrink-0"
                      >
                        {toast.action.label}
                      </button>
                    )}
                    {toast.type === "error" && (
                      <button
                        type="button"
                        onClick={() => {
                          // Owly explains the cause and the next step; if the
                          // assistant is not mounted (public pages), fall back
                          // to a human instead of a dead button.
                          if (!askOwly({ kind: "error", message: toast.message })) {
                            window.open(
                              generateSupportWhatsAppLink({ phone: DEFAULT_WHATSAPP_ENV }),
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }
                          removeToast(toast.id);
                        }}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg border border-[var(--border)] text-[var(--primary)] hover:bg-[var(--surface-container)] shrink-0"
                      >
                        Ask Owly
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 p-1 tap-44 hover:bg-[var(--surface-container)] rounded-lg transition-colors text-[var(--t4)] hover:text-[var(--t2)]"
                aria-label="Dismiss notification"
              >
                <MaterialIcon icon="close" size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
