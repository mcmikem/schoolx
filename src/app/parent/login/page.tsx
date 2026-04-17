"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import { Button, Input } from "@/components/ui";

export default function ParentLoginPage() {
  const router = useRouter();
  const toast = useToast();
  const demoModeEnabled =
    process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true" &&
    process.env.NODE_ENV === "development";
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkStudentId, setLinkStudentId] = useState("");
  const [linkedChildPhone, setLinkedChildPhone] = useState("");
  const DEMO_PASSWORD = "demo1234";
  const demoParent = { phone: "0770000001", password: DEMO_PASSWORD };

  const handleDemoLogin = () => {
    if (!demoModeEnabled) return;
    setPhone(demoParent.phone);
    setPassword(demoParent.password);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) {
      toast.error("Please enter phone and password");
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = phone.replace(/[^0-9]/g, "");

      if (
        demoModeEnabled &&
        password === DEMO_PASSWORD &&
        cleanPhone === demoParent.phone
      ) {
        router.push("/parent-portal");
        return;
      }

      if (!supabase?.auth) {
        toast.error(
          "Supabase not configured. Please check environment variables.",
        );
        setLoading(false);
        return;
      }

      const email = `${cleanPhone}@omuto.org`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const { data: parentData } = await supabase
        .from("parent_profiles")
        .select("*")
        .eq("user_id", data.user.id)
        .single();

      if (parentData) {
        router.push("/parent-portal");
      } else {
        setLinking(true);
      }
    } catch (err: unknown) {
      console.error("Login error:", err);
      toast.error("Invalid phone or password");
    } finally {
      setLoading(false);
    }
  };

  const handleLinkStudent = async () => {
    if (!linkStudentId || !linkedChildPhone) {
      toast.error("Enter student ID and parent phone");
      return;
    }
    toast.success("Student linked! Please login.");
    setLinking(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--primary)] to-[var(--primary-700)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <SkoolMateLogo size="lg" variant="white" className="justify-center" />
          <p className="text-white/80 mt-2 text-sm font-medium">Parent Portal</p>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl p-6 sm:p-8 shadow-[var(--sh2)] border border-[var(--border)]">
          {!linking ? (
            <>
              <h2 className="text-xl font-bold text-[var(--t1)] mb-6">
                Sign In
              </h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  label="Phone Number"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07X XXX XXXX"
                  autoComplete="tel"
                />
                <Input
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  endAdornment={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="rounded-lg p-1.5 text-[var(--t3)] hover:bg-[var(--surface-container)] hover:text-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      <MaterialIcon
                        icon={
                          showPassword ? "visibility_off" : "visibility"
                        }
                        className="text-xl"
                      />
                    </button>
                  }
                />
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  loading={loading}
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
              {demoModeEnabled && (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[var(--border)]" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-[var(--surface)] px-3 text-[var(--t3)]">
                        or
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    icon={<MaterialIcon icon="school" className="text-lg" />}
                    onClick={handleDemoLogin}
                  >
                    Try Demo
                  </Button>
                </>
              )}
              <p className="text-center text-sm text-[var(--t3)] mt-4">
                New parent? Contact your school to get access.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-[var(--t1)] mb-2">
                Link Your Child
              </h2>
              <p className="text-sm text-[var(--t3)] mb-6">
                Enter your child&apos;s student ID to link your account.
              </p>
              <div className="space-y-4">
                <Input
                  label="Student ID"
                  type="text"
                  value={linkStudentId}
                  onChange={(e) => setLinkStudentId(e.target.value)}
                  placeholder="e.g., STD-001"
                  autoComplete="off"
                />
                <Input
                  label="Parent Phone (on file)"
                  type="tel"
                  value={linkedChildPhone}
                  onChange={(e) => setLinkedChildPhone(e.target.value)}
                  placeholder="07X XXX XXXX"
                  autoComplete="tel"
                />
                <Button
                  type="button"
                  variant="primary"
                  className="w-full"
                  onClick={handleLinkStudent}
                >
                  Link Student
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={() => setLinking(false)}
                >
                  Back to login
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
