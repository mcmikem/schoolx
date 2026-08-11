"use client";
import { useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { useToast } from "@/components/Toast";
import { isSupabaseConfigured } from "@/lib/supabase";
import { ConfirmDialog } from "./_atoms";
import { adminAction, ALL_ROLES } from "./_shared";
import type { UserRow } from "./_shared";

export function UserActions({
  user: u,
  onUpdated,
  onDeleted,
}: {
  user: UserRow;
  onUpdated: (patch: Partial<UserRow> & { id: string }) => void;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState<{
    open: boolean;
    type: "deactivate" | "delete" | null;
  }>({ open: false, type: null });

  const requireLiveSupabase = () => {
    if (isSupabaseConfigured) return true;
    toast.error("Connect Supabase to update users.");
    return false;
  };

  const doUpdate = async (fields: Record<string, unknown>, msg: string) => {
    if (!requireLiveSupabase()) return;
    setBusy(true);
    try {
      await adminAction("update_user", { id: u.id, fields });
      onUpdated({ id: u.id, ...fields } as Partial<UserRow> & { id: string });
      toast.success(msg);
    } catch (e: any) {
      toast.error(e?.message || "Operation failed");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!requireLiveSupabase()) return;
    setBusy(true);
    try {
      await adminAction("delete_user", { id: u.id });
      onDeleted(u.id);
      toast.success(`${u.full_name} deleted permanently`);
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    } finally {
      setBusy(false);
      setConfirm({ open: false, type: null });
    }
  };

  const doResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!requireLiveSupabase()) return;
    setBusy(true);
    try {
      await adminAction("reset_user_password", {
        id: u.id,
        new_password: newPassword,
      });
      toast.success(`Password reset for ${u.full_name}`);
      setShowResetPwd(false);
      setNewPassword("");
    } catch (e: any) {
      toast.error(e?.message || "Password reset failed");
    } finally {
      setBusy(false);
    }
  };

  if (u.role === "super_admin") {
    return <span className="text-[10px] text-[var(--t4)] italic">Protected</span>;
  }

  return (
    <>
      <ConfirmDialog
        open={confirm.open}
        title={confirm.type === "delete" ? `Delete ${u.full_name}?` : `Deactivate ${u.full_name}?`}
        body={
          confirm.type === "delete"
            ? "This permanently deletes the user and their login. Cannot be undone."
            : "This user will lose the ability to sign in. You can reactivate them later."
        }
        confirmLabel={confirm.type === "delete" ? "Delete Permanently" : "Deactivate"}
        danger
        loading={busy}
        onConfirm={() => {
          if (confirm.type === "delete") doDelete();
          else doUpdate({ is_active: false }, `${u.full_name} deactivated`);
          setConfirm({ open: false, type: null });
        }}
        onCancel={() => setConfirm({ open: false, type: null })}
      />

      {/* Password Reset Modal */}
      {showResetPwd && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowResetPwd(false)} />
          <div className="relative bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--border)] w-full max-w-xs max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto p-6">
            <h3 className="font-['Sora'] text-[14px] font-bold text-[var(--t1)] mb-1">Reset Password</h3>
            <p className="text-[12px] text-[var(--t3)] mb-4">{u.full_name}</p>
            <form onSubmit={doResetPassword} className="space-y-3">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 chars)"
                minLength={8}
                required
                className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--primary)]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetPwd(false)}
                  className="flex-1 py-2 rounded-xl border border-[var(--border)] text-[12px] font-semibold text-[var(--t2)] hover:bg-[var(--bg)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 py-2 rounded-xl bg-[var(--primary)] text-white text-[12px] font-semibold disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Set Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 justify-center flex-wrap">
        {u.is_active ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirm({ open: true, type: "deactivate" })}
            className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[#fef3c7] text-[#b45309] hover:opacity-80 disabled:opacity-40"
          >
            Deactivate
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => doUpdate({ is_active: true }, `${u.full_name} reactivated`)}
            className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[#ccfbf1] text-[#0d9488] hover:opacity-80 disabled:opacity-40"
          >
            Reactivate
          </button>
        )}
        <div className="relative">
          <button
            type="button"
            disabled={busy}
            title="Change role"
            onClick={() => setShowRoleMenu((v) => !v)}
            className="p-1 rounded-lg text-[var(--t3)] hover:bg-[var(--bg)] transition-colors disabled:opacity-40"
          >
            <MaterialIcon icon="manage_accounts" style={{ fontSize: 14 }} />
          </button>
          {showRoleMenu && (
            <div className="absolute right-0 top-7 z-30 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl min-w-[160px] py-1">
              <div className="px-3 py-1.5 text-[10px] font-bold text-[var(--t3)] uppercase tracking-wide border-b border-[var(--border)]">
                Change Role
              </div>
              {ALL_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setShowRoleMenu(false);
                    doUpdate({ role: r }, `Role changed to ${r.replace(/_/g, " ")}`);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] font-semibold hover:bg-[var(--bg)] ${u.role === r ? "text-[var(--primary)]" : "text-[var(--t1)]"}`}
                >
                  {r.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          disabled={busy}
          title="Reset password"
          onClick={() => setShowResetPwd(true)}
          className="p-1 rounded-lg text-[var(--t3)] hover:bg-[var(--bg)] transition-colors disabled:opacity-40"
        >
          <MaterialIcon icon="key" style={{ fontSize: 14 }} />
        </button>
        <button
          type="button"
          disabled={busy}
          title="Delete user"
          onClick={() => setConfirm({ open: true, type: "delete" })}
          className="p-1 rounded-lg text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
        >
          <MaterialIcon icon="delete" style={{ fontSize: 14 }} />
        </button>
      </div>
    </>
  );
}
