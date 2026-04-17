"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import AuthShell from "@/components/auth/AuthShell";
import { Button, Input } from "@/components/ui";
import { supabase } from "@/lib/supabase";

export default function ParentLoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkStudentId, setLinkStudentId] = useState("");
  const [linkedChildPhone, setLinkedChildPhone] = useState("");
  const PARENT_DEMO_KEY = "skoolmate_parent_demo";

  const DEMO_PASSWORD = "demo1234";

  const demoParent = {
    phone: "0770000001",
    password: DEMO_PASSWORD,
    name: "Jane Parent",
  };

  const handleDemoLogin = () => {
    setPhone(demoParent.phone);
    setPassword(demoParent.password);
  };

  useEffect(() => {
    localStorage.removeItem("parent_session");
    sessionStorage.removeItem(PARENT_DEMO_KEY);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) {
      toast.error("Please enter phone and password");
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = phone.replace(/[^0-9]/g, "");

      if (password === DEMO_PASSWORD && cleanPhone === demoParent.phone) {
        const demoData = {
          parent: {
            id: "demo-parent-1",
            phone: demoParent.phone,
            name: demoParent.name,
            school_id: "00000000-0000-0000-0000-000000000001",
            children: [
              {
                id: "demo-child-1",
                name: "John Student",
                class: "P.5A",
                student_id: "demo-student-1",
              },
            ],
          },
        };
        sessionStorage.setItem(PARENT_DEMO_KEY, JSON.stringify(demoData.parent));
        router.push("/parent/dashboard");
        setLoading(false);
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
        router.push("/parent/dashboard");
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
    <AuthShell
      badge="Parent portal"
      title="Sign in as a parent"
      description="Use the phone number the school saved for you so you can check your child’s school information."
      quickFacts={[
        "Use the phone number on school records",
        "Works on mobile phones",
        "Demo available for school guidance",
      ]}
      highlights={[
        {
          icon: "family_restroom",
          title: "What parents can do",
          description:
            "Check attendance, notices, fee information, and school updates from one place.",
        },
        {
          icon: "smartphone",
          title: "Easy on phones",
          description:
            "Large buttons and clear labels make sign-in easier on shared family phones.",
        },
        {
          icon: "sms",
          title: "If your child is not linked yet",
          description:
            "Ask the school office to confirm your phone number and connect your child to your account.",
        },
        {
          icon: "school",
          title: "For school demonstrations",
          description:
            "Use the demo option below when the school is showing parents how the portal works.",
        },
      ]}
      contentTitle={linking ? "Link your child" : "Parent sign in"}
      contentDescription={
        linking
          ? "Add the student ID and the parent phone on file so the school can connect this account."
          : "Use the same phone number given to the school. If you are only learning, use the demo option below."
      }
      supportNote={
        <div className="space-y-2">
          <p className="font-semibold text-slate-800">Need school help?</p>
          <p>
            If you cannot sign in yet, contact the school office so they can
            confirm your phone number and link your child to your account.
          </p>
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500">
          <Link
            href="/login"
            className="font-semibold text-[#17325F] transition hover:text-[#2E9448]"
          >
            Staff login
          </Link>
          <span className="text-slate-300">•</span>
          <Link
            href="/"
            className="font-semibold text-[#17325F] transition hover:text-[#2E9448]"
          >
            Back to landing page
          </Link>
        </div>
      }
    >
      {!linking ? (
        <div className="space-y-5">
          <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-3">
            {[
              "Use the parent phone registered by the school",
              "Tap Try demo during school presentations",
              "Contact the office if your child is not linked yet",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <MaterialIcon
                  icon="check_circle"
                  className="mt-0.5 text-[#2E9448]"
                  size={18}
                />
                <p className="text-sm leading-6 text-slate-600">{item}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07X XXX XXXX"
              autoComplete="tel"
              inputMode="numeric"
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
                  onClick={() => setShowPassword((current) => !current)}
                  className="rounded-lg p-1.5 text-[var(--t3)] hover:bg-[var(--surface-container)] hover:text-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <MaterialIcon
                    icon={showPassword ? "visibility_off" : "visibility"}
                    size={18}
                  />
                </button>
              }
            />
            <Button
              type="submit"
              variant="primary"
              className="w-full rounded-2xl py-3 text-base"
              loading={loading}
              icon={!loading ? <MaterialIcon icon="login" size={18} /> : undefined}
            >
              {loading ? "Signing in..." : "Sign in to parent portal"}
            </Button>
          </form>

          <div className="relative pt-2">
            <div className="absolute inset-x-0 top-1/2 border-t border-slate-200" />
            <div className="relative mx-auto w-fit bg-white px-3 text-sm text-slate-500">
              or explore the demo
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            className="w-full rounded-2xl py-3 text-base"
            icon={<MaterialIcon icon="school" size={18} />}
            onClick={handleDemoLogin}
          >
            Try parent demo
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-sm font-semibold text-slate-800">
              First-time account linking
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Ask the school for the student ID and make sure the phone number
              matches the one stored in the school office records.
            </p>
          </div>

          <Input
            label="Student ID"
            type="text"
            value={linkStudentId}
            onChange={(e) => setLinkStudentId(e.target.value)}
            placeholder="e.g. STD-001"
            autoComplete="off"
          />
          <Input
            label="Parent Phone (on file)"
            type="tel"
            value={linkedChildPhone}
            onChange={(e) => setLinkedChildPhone(e.target.value)}
            placeholder="07X XXX XXXX"
            autoComplete="tel"
            inputMode="numeric"
          />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              className="flex-1 rounded-2xl py-3 text-base"
              onClick={() => setLinking(false)}
            >
              Back to login
            </Button>
            <Button
              type="button"
              variant="primary"
              className="flex-1 rounded-2xl py-3 text-base"
              icon={<MaterialIcon icon="check" size={18} />}
              onClick={handleLinkStudent}
            >
              Link student
            </Button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
