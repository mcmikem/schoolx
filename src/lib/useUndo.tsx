"use client";
import { useState, useCallback, useRef } from "react";
import { useToast } from "@/components/Toast";

interface UndoAction {
  id: string;
  type: "delete" | "update";
  description: string;
  undo: () => Promise<void>;
  timeout: number;
}

export function useUndo() {
  const [pendingActions, setPendingActions] = useState<UndoAction[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const toast = useToast();

  const executeWithUndo = useCallback(
    async <T,>(
      action: () => Promise<T>,
      undoAction: () => Promise<void>,
      options: {
        description?: string;
        undoDelay?: number;
        successMessage?: string;
        undoMessage?: string;
      } = {},
    ) => {
      const {
        description = "Item deleted",
        undoDelay = 5000,
        successMessage = "Done! Click undo to revert.",
        undoMessage = "Action undone",
      } = options;

      try {
        // Execute the action
        const result = await action();

        // Create undo ID
        const undoId = `undo-${Date.now()}`;

        // Create pending action
        const pendingAction: UndoAction = {
          id: undoId,
          type: "delete",
          description,
          undo: async () => {
            await undoAction();
            toast.success(undoMessage);

            // Clear timeout
            const timeout = timeoutRefs.current.get(undoId);
            if (timeout) {
              clearTimeout(timeout);
              timeoutRefs.current.delete(undoId);
            }

            // Remove from pending
            setPendingActions((prev) => prev.filter((a) => a.id !== undoId));
          },
          timeout: undoDelay,
        };

        // Add to pending
        setPendingActions((prev) => [...prev, pendingAction]);

        // Set timeout to auto-execute
        const timeoutId = setTimeout(() => {
          timeoutRefs.current.delete(undoId);
          setPendingActions((prev) => prev.filter((a) => a.id !== undoId));
        }, undoDelay);

        timeoutRefs.current.set(undoId, timeoutId);

        // Show toast with undo button
        toast.success(successMessage);

        return result;
      } catch (error) {
        throw error;
      }
    },
    [toast],
  );

  const undoLastAction = useCallback(async () => {
    if (pendingActions.length === 0) return;

    const lastAction = pendingActions[pendingActions.length - 1];
    await lastAction.undo();
  }, [pendingActions]);

  const clearAllPending = useCallback(() => {
    // Clear all timeouts
    timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
    timeoutRefs.current.clear();
    setPendingActions([]);
  }, []);

  return {
    pendingActions,
    executeWithUndo,
    undoLastAction,
    clearAllPending,
    hasPending: pendingActions.length > 0,
  };
}

// Undo notification component
export function UndoNotification({
  actions,
  onUndo,
}: {
  actions: UndoAction[];
  onUndo: (id: string) => void;
}) {
  if (actions.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {actions.map((action) => (
        <div
          key={action.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            background: "var(--t1)",
            color: "var(--surface)",
            borderRadius: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            animation: "slideUp 0.3s ease-out",
            minWidth: 280,
          }}
        >
          <span style={{ fontSize: 14 }}>{action.description}</span>
          <button
            onClick={() => onUndo(action.id)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: "var(--navy)",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "underline",
            }}
          >
            Undo
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// Confirmation dialog hook
export function useConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<{
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
    onCancel: () => void;
    type: "danger" | "warning" | "info";
  } | null>(null);

  const confirm = useCallback(
    (options: {
      title?: string;
      message: string;
      confirmText?: string;
      type?: "danger" | "warning" | "info";
    }) => {
      return new Promise<boolean>((resolve) => {
        setConfig({
          title: options.title || "Confirm",
          message: options.message,
          confirmText: options.confirmText || "Confirm",
          type: options.type || "danger",
          onConfirm: () => {
            setIsOpen(false);
            resolve(true);
          },
          onCancel: () => {
            setIsOpen(false);
            resolve(false);
          },
        });
        setIsOpen(true);
      });
    },
    [],
  );

  const ConfirmDialog = useCallback(() => {
    if (!isOpen || !config) return null;

    const getColor = () => {
      switch (config.type) {
        case "danger":
          return "var(--red)";
        case "warning":
          return "var(--amber)";
        default:
          return "var(--navy)";
      }
    };

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
        onClick={config.onCancel}
      >
        <div
          style={{
            background: "var(--surface)",
            borderRadius: 16,
            padding: 24,
            maxWidth: 400,
            width: "100%",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--t1)",
              marginBottom: 8,
            }}
          >
            {config.title}
          </h3>
          <p style={{ fontSize: 14, color: "var(--t2)", marginBottom: 24 }}>
            {config.message}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button
              onClick={config.onCancel}
              style={{
                padding: "10px 20px",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 14,
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              Cancel
            </button>
            <button
              onClick={config.onConfirm}
              style={{
                padding: "10px 20px",
                background: getColor(),
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              {config.confirmText}
            </button>
          </div>
        </div>
      </div>
    );
  }, [isOpen, config]);

  return { confirm, ConfirmDialog };
}
