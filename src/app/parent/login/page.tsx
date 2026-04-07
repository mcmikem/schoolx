"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import SkoolMateLogo from "@/components/SkoolMateLogo";

interface ParentUser {
  id: string;
  phone: string;
  name: string;
  children: { id: string; name: string; class: string; student_id: string }[];
  school_id: string;
}

interface DashboardData {
  student: { name: string; class: string; student_id: string; photo?: string };
  school: { name: string; logo?: string };
  stats: {
    attendance: { present: number; total: number; percentage: number };
    balance: number;
    next_term: string;
  };
  recent_grades: {
    subject: string;
    score: number;
    grade: string;
    term: string;
  }[];
}

export default function ParentLoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkStudentId, setLinkStudentId] = useState("");
  const [linkedChildPhone, setLinkedChildPhone] = useState("");

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) {
      toast.error("Please enter phone and password");
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = phone.replace(/[^0-9]/g, "");

      // DEMO LOGIN
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
        localStorage.setItem(
          "omuto_parent_demo",
          JSON.stringify(demoData.parent),
        );
        router.push("/parent/dashboard");
        setLoading(false);
        return;
      }

      const email = `parent_${cleanPhone}@skoolmate.os`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Get parent profile
      const { data: parentData } = await supabase
        .from("parent_profiles")
        .select("*")
        .eq("user_id", data.user.id)
        .single();

      if (parentData) {
        localStorage.setItem(
          "parent_session",
          JSON.stringify({
            user: data.user,
            parent: parentData,
          }),
        );
        router.push("/parent/dashboard");
      } else {
        // New parent - need to link to student
        setLinking(true);
      }
    } catch (err: any) {
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
    <div className="min-h-screen bg-gradient-to-br from-[#001F3F] to-[#0a2d5a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <SkoolMateLogo size="lg" variant="white" className="justify-center" />
          <p className="text-white/70 mt-2">Parent Portal</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-2xl">
          {!linking ? (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Sign In</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07X XXX XXXX"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/20 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-[#001F3F] text-white font-semibold rounded-xl hover:bg-[#001a35] transition-colors disabled:opacity-50"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-3 text-gray-500">or</span>
                </div>
              </div>
              <button
                onClick={handleDemoLogin}
                className="w-full py-3 px-4 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
              >
                <MaterialIcon icon="school" className="inline mr-2" />
                Try Demo
              </button>
              <p className="text-center text-sm text-gray-500 mt-4">
                New parent? Contact your school to get access.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Link Your Child
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Enter your child's student ID to link your account.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Student ID
                  </label>
                  <input
                    type="text"
                    value={linkStudentId}
                    onChange={(e) => setLinkStudentId(e.target.value)}
                    placeholder="e.g., STD-001"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Parent Phone (on file)
                  </label>
                  <input
                    type="tel"
                    value={linkedChildPhone}
                    onChange={(e) => setLinkedChildPhone(e.target.value)}
                    placeholder="07X XXX XXXX"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/20 outline-none"
                  />
                </div>
                <button
                  onClick={handleLinkStudent}
                  className="w-full py-3 px-4 bg-[#001F3F] text-white font-semibold rounded-xl hover:bg-[#001a35] transition-colors"
                >
                  Link Student
                </button>
                <button
                  onClick={() => setLinking(false)}
                  className="w-full py-2 text-gray-500 text-sm"
                >
                  Back to login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
