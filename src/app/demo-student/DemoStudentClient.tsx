"use client";

import { useEffect, useState } from "react";
import { saveDemoStorage } from "@/lib/auth-demo";

const DEMO_SCHOOL = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "St. Mary's Primary School (Demo)",
  school_code: "DEMO001",
  district: "Kampala",
  school_type: "primary",
  ownership: "private",
  primary_color: "#17325F",
  subscription_plan: "growth",
  subscription_status: "active",
  feature_stage: "full",
};

const DEMO_USER = { role: "student", name: "John Kato", school_id: "demo-school" };

/**
 * One-click student demo for a freshly opened tab.
 *
 * The demo session lives in sessionStorage, which a new tab does not inherit
 * from the tab that signed in. This route seeds it and then does a full page
 * load of the portal, so links opened in a new tab still land signed in.
 *
 * Dev-only: the server page 404s unless NODE_ENV=development and
 * NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES=true.
 */
export default function DemoStudentClient() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    saveDemoStorage(DEMO_USER, DEMO_SCHOOL);
    setReady(true);
    window.location.replace("/student-portal/");
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Opening student demo</h1>
        <p className="mt-2 text-sm text-slate-600">Setting up a demo session and redirecting you now.</p>
        {ready && (
          <a className="mt-4 inline-block text-sm font-medium text-blue-700 underline" href="/student-portal/">
            Continue to the student portal
          </a>
        )}
      </div>
    </main>
  );
}
