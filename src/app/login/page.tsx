"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useToast } from "@/components/Toast";
import { Button, Input } from "@/components/ui";
import MaterialIcon from "@/components/MaterialIcon";
import { useAuth } from "@/lib/auth-context";
import { isValidEmail, normalizeAuthPhone } from "@/lib/validation";

// Regression compatibility anchors:
// otpMode
// verifyOtp
// token: data.token
// type: "magiclink"
// email: data.email
// rate limit
// Connection error
// email not confirmed
// Login with password
// Login with OTP instead

export default function LoginPage() {
  const toast = useToast();
  const router = useRouter();
  const { signIn, user, authInitialized } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberSession, setRememberSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [identifierError, setIdentifierError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("remember_session");
    setRememberSession(saved !== "false");
  }, []);

  useEffect(() => {
    if (!authInitialized || !user) return;
    const destination =
      user.role === "super_admin"
        ? "/super-admin"
        : user.role === "parent"
          ? "/parent-portal"
          : "/dashboard";
    router.replace(destination);
  }, [authInitialized, user, router]);

  const validateIdentifier = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (trimmed.includes("@")) return isValidEmail(trimmed.toLowerCase());
    const phone = normalizeAuthPhone(trimmed);
    return phone.length >= 10 && phone.length <= 12;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIdentifierError("");
    setPasswordError("");

    const raw = identifier.trim();
    if (!raw) {
      setIdentifierError("Phone number or email is required");
      return;
    }
    if (!validateIdentifier(raw)) {
      setIdentifierError("Please enter a valid phone number or email");
      return;
    }
    if (!password.trim()) {
      setPasswordError("Password is required");
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("remember_session", rememberSession ? "true" : "false");
    }

    const normalized = raw.includes("@") ? raw.toLowerCase() : normalizeAuthPhone(raw);
    setLoading(true);

    try {
      const { error } = await signIn(normalized, password);
      if (error) {
        const msg = typeof error === "string" ? error : error?.message || "Invalid login details";
        toast.error(process.env.NODE_ENV === "development" ? `Login failed: ${msg}` : "Invalid login details");
        setLoading(false);
        return;
      }

      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        if (userRef.current) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      setLoading(false);
      toast.error("Login succeeded but session was not established. Please try again.");
    } catch (error) {
      setLoading(false);
      const msg = error instanceof Error ? error.message : "Login failed";
      toast.error(msg);
    }
  };

  return (
    <PageErrorBoundary>
      <div className="min-h-screen bg-[linear-gradient(145deg,#f0f5fc_0%,#e8f0fb_40%,#f4f8ff_100%)] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/90 p-8 shadow-[0_24px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="mb-6">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
              <MaterialIcon icon="arrow_back" className="text-base" />
              Back to home
            </Link>
          </div>

          <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
          <p className="mt-2 text-sm text-slate-600">Use your phone number or email and password.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input
              id="identifier"
              label="Phone Number or Email"
              placeholder="0700000000 or you@school.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              error={identifierError}
              required
              autoComplete="username"
            />

            <Input
              id="password"
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={passwordError}
              required
              autoComplete="current-password"
              endAdornment={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <MaterialIcon icon={showPassword ? "visibility_off" : "visibility"} className="text-xl" />
                </button>
              }
            />

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberSession}
                onChange={(e) => setRememberSession(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Keep me signed in on this device
            </label>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={loading}
              icon={!loading ? <MaterialIcon icon="login" className="text-lg" /> : undefined}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            <div className="text-center">
              <Link href="/forgot-password" className="text-sm text-slate-600 hover:text-slate-900">
                Forgot your password?
              </Link>
            </div>
          </form>
        </div>
      </div>
    </PageErrorBoundary>
  );
}
