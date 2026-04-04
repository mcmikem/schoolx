"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { BookOpen, CheckCircle, Loader2 } from "lucide-react";

export default function SetupAdminPage() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "Super Admin",
    phone: "0700000000",
    password: "",
  });

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Create auth user - strip non-numeric chars from phone
      const cleanPhone = form.phone.replace(/[^0-9]/g, "");
      const email = `${cleanPhone}@omuto.sms`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: {
            full_name: form.name,
            phone: form.phone,
            role: "super_admin",
          },
        },
      });

      if (authError) throw authError;

      // 2. Create user profile
      const { error: userError } = await supabase.from("users").insert({
        auth_id: authData.user!.id,
        full_name: form.name,
        phone: form.phone,
        role: "super_admin",
        is_active: true,
      });

      if (userError) throw userError;

      setDone(true);
    } catch (err: any) {
      setError(err.message || "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Super Admin Created!
          </h2>
          <p className="text-gray-500 mb-6">
            Login with your phone number: <strong>{form.phone}</strong>
          </p>
          <a
            href="/login"
            className="block w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-100 rounded-xl mb-4">
            <BookOpen className="w-8 h-8 text-primary-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Create Super Admin
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Set up your admin account
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSetup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number (Login ID)
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {loading ? "Creating..." : "Create Super Admin"}
          </button>
        </form>
      </div>
    </div>
  );
}
