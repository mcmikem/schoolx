"use client";
import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  ReactNode,
} from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth-context";

interface Notification {
  id: string;
  type:
    | "info"
    | "success"
    | "warning"
    | "error"
    | "student"
    | "payment"
    | "attendance"
    | "grade";
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
  data?: Record<string, any>;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (
    notification: Omit<Notification, "id" | "read" | "created_at">,
  ) => void;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<
  NotificationsContextType | undefined
>(undefined);

export function NotificationsProvider({
  children,
  schoolId: propSchoolId,
}: {
  children: ReactNode;
  schoolId?: string;
}) {
  const { school } = useAuth();
  const schoolId = propSchoolId || school?.id;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    try {
      // Generate smart notifications based on data
      const generatedNotifications: Notification[] = [];
      const today = new Date().toISOString().split("T")[0];

      // 1. Check for absent students (consecutive absences)
      try {
        const { data: absentStudents } = await supabase
          .from("attendance")
          .select("student_id, date, students(first_name, last_name)")
          .eq("date", today)
          .eq("status", "absent")
          .limit(5);

        if (absentStudents && absentStudents.length > 0) {
          generatedNotifications.push({
            id: "absent-today",
            type: "attendance",
            title: `${absentStudents.length} students absent today`,
            message: "Click to view attendance details",
            link: "/dashboard/attendance",
            read: false,
            created_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error("Attendance check failed:", err);
      }

      // 2. Check for fee payments today
      try {
        const { data: todayPayments } = await supabase
          .from("fee_payments")
          .select("amount_paid")
          .gte("payment_date", today)
          .limit(100);

        if (todayPayments && todayPayments.length > 0) {
          const total = todayPayments.reduce(
            (sum, p) => sum + Number(p.amount_paid),
            0,
          );
          generatedNotifications.push({
            id: "payments-today",
            type: "payment",
            title: `UGX ${total.toLocaleString()} collected today`,
            message: `${todayPayments.length} payments recorded`,
            link: "/dashboard/fees",
            read: false,
            created_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error("Attendance check failed:", err);
      }

      // 3. Check for overdue fees (students with balance > 0)
      try {
        const { data: students } = await supabase
          .from("students")
          .select("id")
          .eq("school_id", schoolId)
          .eq("status", "active");

        if (students && students.length > 0) {
          const { data: feeStructure } = await supabase
            .from("fee_structure")
            .select("amount")
            .eq("school_id", schoolId);

          const { data: payments } = await supabase
            .from("fee_payments")
            .select("amount_paid");

          const totalExpected =
            (feeStructure || []).reduce(
              (sum, f) => sum + Number(f.amount || 0),
              0,
            ) * students.length;
          const totalCollected = (payments || []).reduce(
            (sum, p) => sum + Number(p.amount_paid || 0),
            0,
          );
          const balance = totalExpected - totalCollected;

          if (balance > 0) {
            generatedNotifications.push({
              id: "outstanding-fees",
              type: "warning",
              title: `UGX ${balance.toLocaleString()} outstanding fees`,
              message: "Click to view fee collection status",
              link: "/dashboard/fees",
              read: false,
              created_at: new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.error("Fee check failed:", err);
      }

      // 4. Add sample notifications if no data
      if (generatedNotifications.length === 0) {
        generatedNotifications.push({
          id: "welcome",
          type: "info",
          title: "Welcome to SkulMate OS!",
          message: "Start by adding students and taking attendance",
          link: "/dashboard/students",
          read: false,
          created_at: new Date().toISOString(),
        });
      }

      setNotifications(generatedNotifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const addNotification = (
    notification: Omit<Notification, "id" | "read" | "created_at">,
  ) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}`,
      read: false,
      created_at: new Date().toISOString(),
    };
    setNotifications((prev) => [newNotification, ...prev]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        addNotification,
        refresh: fetchNotifications,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within NotificationsProvider",
    );
  }
  return context;
}

// Toast notification for immediate feedback
interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}`;
    const duration = toast.duration || 3000;

    setToasts((prev) => [...prev, { ...toast, id }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return {
    ...context,
    success: (message: string) =>
      context.showToast({ type: "success", message }),
    error: (message: string) => context.showToast({ type: "error", message }),
    warning: (message: string) =>
      context.showToast({ type: "warning", message }),
    info: (message: string) => context.showToast({ type: "info", message }),
  };
}

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: string) => void;
}) {
  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return "check_circle";
      case "error":
        return "error";
      case "warning":
        return "warning";
      default:
        return "info";
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case "success":
        return "var(--green)";
      case "error":
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
        bottom: 16,
        right: 16,
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 400,
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            background: "var(--surface)",
            borderRadius: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            border: `1px solid ${getColor(toast.type)}`,
            animation: "slideIn 0.3s ease-out",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 20, color: getColor(toast.type) }}
          >
            {getIcon(toast.type)}
          </span>
          <span style={{ flex: 1, fontSize: 14, color: "var(--t1)" }}>
            {toast.message}
          </span>
          <button
            onClick={() => onRemove(toast.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 18, color: "var(--t4)" }}
            >
              close
            </span>
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
