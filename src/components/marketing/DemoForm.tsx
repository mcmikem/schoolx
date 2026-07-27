"use client";

import { MaterialIcon } from "@/components/marketing/MaterialIcon";
import { useState } from "react";

export function DemoForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = {
      type: "demo",
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      phone: (form.elements.namedItem("phone") as HTMLInputElement)?.value || "",
      school: (form.elements.namedItem("school") as HTMLInputElement)?.value || "",
      student_count: (form.elements.namedItem("students") as HTMLSelectElement)?.value || "",
      message: `Demo request: ${(form.elements.namedItem("name") as HTMLInputElement).value} from ${(form.elements.namedItem("school") as HTMLInputElement)?.value || "unknown school"}`,
    };

    try {
      const res = await fetch("/api/contact/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }

      setStatus("success");
      form.reset();
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="rounded-[24px] bg-[#eaf4ed] p-6 text-center">
        <MaterialIcon icon="check_circle" className="text-[#2E9448] text-4xl mx-auto" />
        <h3 className="mt-3 text-lg font-semibold text-slate-900">Demo requested!</h3>
        <p className="mt-2 text-sm text-slate-600">We&apos;ll reach out shortly to schedule your demo.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div
        aria-hidden="true"
        className="absolute opacity-0 pointer-events-none"
        style={{ height: 0, overflow: "hidden" }}
      >
        <input name="_website" tabIndex={-1} autoComplete="off" />
      </div>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
          Your name
        </label>
        <input id="name" name="name" type="text" required className="input" placeholder="e.g. Sarah Nakamya" />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
          Email address
        </label>
        <input id="email" name="email" type="email" required className="input" placeholder="you@school.ac.ug" />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
          Phone number
        </label>
        <input id="phone" name="phone" type="tel" inputMode="tel" className="input" placeholder="e.g. 0750 000 000" />
      </div>
      <div>
        <label htmlFor="school" className="block text-sm font-medium text-slate-700 mb-1">
          School name
        </label>
        <input id="school" name="school" type="text" className="input" placeholder="e.g. Kampala High School" />
      </div>
      <div>
        <label htmlFor="students" className="block text-sm font-medium text-slate-700 mb-1">
          Number of students
        </label>
        <select id="students" name="students" className="input">
          <option value="">Select range</option>
          <option value="1-100">1 &ndash; 100</option>
          <option value="101-300">101 &ndash; 300</option>
          <option value="301-500">301 &ndash; 500</option>
          <option value="501-1000">501 &ndash; 1,000</option>
          <option value="1000+">1,000+</option>
        </select>
      </div>

      {status === "error" && <div className="rounded-[16px] bg-[#fac5c5] p-4 text-sm text-[#b91c1c]">{errorMsg}</div>}

      <button
        type="submit"
        disabled={status === "loading"}
        className="btn btn-primary w-full justify-center py-4 text-base disabled:opacity-50"
      >
        {status === "loading" ? "Sending..." : "Book a demo"}
      </button>
      <p className="text-xs text-slate-400 text-center">Free &middot; No obligation &middot; 30 minutes</p>
    </form>
  );
}
