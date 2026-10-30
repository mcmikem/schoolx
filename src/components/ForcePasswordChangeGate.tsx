"use client";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

// Blocks the whole app until the signed-in user picks a new password.
// Two writers set the requirement and neither was ever read before this gate:
//   1. users.password_reset_required — super-admin "Reset user access" in the
//      schools table, and the admin reset-password API.
//   2. auth user_metadata.must_change_password — parent-portal provisioning,
//      which ships a generated password over WhatsApp.
const PASSWORD_RULES = "At least 8 characters, with one uppercase letter and one number.";
const SESSION_EXPIRED_MESSAGE =
  "Your sign-in has expired, so the new password cannot be saved. Sign in again and you will be asked to set it.";

export default function ForcePasswordChangeGate() {
  const { user, loading, authInitialized, isDemo } = useAuth();
  const [metaFlag, setMetaFlag] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionMissing, setSessionMissing] = useState(false);

  // must_change_password lives only in auth metadata, so read it from the
  // local session (no network round-trip) once the auth state settles.
  useEffect(() => {
    let cancelled = false;
    if (!authInitialized || loading || !user || isDemo || !supabase) {
      setMetaFlag(false);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        if (!data.session) {
          // The gate used to render from the cached profile even when the
          // session behind it was gone; every submit then failed with
          // "Auth session missing!". Offer sign-in instead of a dead form.
          setSessionMissing(user.password_reset_required === true);
          setMetaFlag(false);
          return;
        }
        setSessionMissing(false);
        setMetaFlag(data.session.user?.user_metadata?.must_change_password === true);
      })
      .catch(() => {
        // Keep whatever flag we already had; the DB flag still guards staff.
      });
    return () => {
      cancelled = true;
    };
  }, [authInitialized, loading, user, isDemo]);

  const active = Boolean(user && authInitialized && !loading && (user.password_reset_required === true || metaFlag));
  if (!user) return null;

  if (sessionMissing) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign in again"
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-white p-6 dark:bg-gray-950"
      >
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Sign in again</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{SESSION_EXPIRED_MESSAGE}</p>
          <button
            type="button"
            onClick={async () => {
              try {
                await supabase?.auth.signOut();
              } catch {
                // A failed sign-out must not trap the user on this screen.
              }
              window.location.href = "/login/";
            }}
            className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  if (!active) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError(PASSWORD_RULES);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    if (!supabase) {
      setError("Sign-in is unavailable. Please reload and try again.");
      return;
    }

    setBusy(true);
    try {
      // Confirm the session is still there before sending the update, so a
      // stale tab reports something actionable instead of the SDK's
      // "Auth session missing!".
      let {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        // On a slow phone the in-memory session can be gone while the
        // refresh token is still valid. Try once more before giving up.
        try {
          const refreshed = await supabase.auth.refreshSession();
          session = refreshed.data.session ?? null;
        } catch {
          session = null;
        }
      }
      if (!session) {
        setBusy(false);
        setSessionMissing(true);
        return;
      }

      // Rewrite password + clear the metadata flag in one auth update. The
      // metadata keys are re-sent explicitly so a replace-semantics GoTrue
      // build cannot drop the role/phone the degraded-login path depends on.
      const metadata: Record<string, unknown> = {
        full_name: user.full_name,
        role: user.role,
        must_change_password: false,
      };
      if (user.phone) metadata.phone = user.phone;
      const { error: authUpdateError } = await supabase.auth.updateUser({
        password,
        data: metadata,
      });
      if (authUpdateError) throw authUpdateError;

      if (user.password_reset_required) {
        // "Users update own" RLS policy allows this. A failure here is
        // non-fatal: the flag re-shows the gate once more and it clears on
        // the next identical submit.
        const { error: flagError } = await supabase
          .from("users")
          .update({ password_reset_required: false })
          .eq("id", user.id);
        if (flagError) logger.warn("[ForcePasswordChange] failed to clear password_reset_required:", flagError);
      }

      // Full reload so /api/auth/me and the session metadata re-sync on a
      // low-end device without leaving a stale flagged user object around.
      window.location.reload();
    } catch (err) {
      logger.error("[ForcePasswordChange] update failed:", err);
      const message = err instanceof Error ? err.message : String(err || "");
      if (/session|jwt|token/i.test(message)) {
        setSessionMissing(true);
      } else if (/same password|different from/i.test(message)) {
        setError("Your new password must be different from the temporary one. Choose another.");
      } else if (/weak|short|uppercase|number|lowercase/i.test(message)) {
        setError(`Password rejected: ${message}. ${PASSWORD_RULES}`);
      } else if (/network|fetch|timeout/i.test(message)) {
        setError("Network problem while saving. Check your connection and try again.");
      } else {
        setError(message || "Failed to update the password. Please try again.");
      }
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set a new password"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-white p-6 dark:bg-gray-950"
    >
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Set a new password</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {user.password_reset_required
            ? "An administrator reset your access. Choose a password only you know before continuing."
            : "Your account was created with a temporary password. Choose a password only you know before continuing."}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-blue-900"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={busy}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-blue-900"
              required
            />
          </label>

          <p className="text-xs text-gray-500 dark:text-gray-400">{PASSWORD_RULES}</p>

          {error && (
            <div role="alert" className="space-y-2">
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-700">
                {error}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                If this keeps happening, tap &quot;Sign in again&quot; below and retry. Your temporary password is still
                valid.
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await supabase?.auth.signOut();
                  } catch {
                    // ignore
                  }
                  window.location.href = "/login/";
                }}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Sign in again
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Set password & continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
