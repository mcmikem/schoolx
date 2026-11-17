"use client";
import { useEffect, useState } from "react";
import { isWebPushSupported } from "@/lib/web-push-client";
import { useAuth } from "@/lib/auth-context";

export function PushOptInPrompt() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user?.id || !isWebPushSupported()) return;
    if (Notification.permission !== "default") return;
    setShow(true);
  }, [user?.id]);

  if (!show) return null;

  const handleEnable = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const { subscribeWebPush } = await import("@/lib/web-push-client");
        await subscribeWebPush(user!.id);
      }
    } catch {
      // ignore
    }
    setShow(false);
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 shadow-lg max-w-sm">
      <p className="text-sm font-medium mb-2">Enable push notifications?</p>
      <p className="text-xs text-[var(--t3)] mb-3">Get alerts for parent messages and updates.</p>
      <div className="flex gap-2">
        <button onClick={handleEnable} className="text-xs px-3 py-1.5 rounded bg-[var(--primary)] text-white">
          Enable
        </button>
        <button onClick={() => setShow(false)} className="text-xs px-3 py-1.5 rounded border border-[var(--border)]">
          Not now
        </button>
      </div>
    </div>
  );
}
