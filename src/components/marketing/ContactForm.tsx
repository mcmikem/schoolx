"use client";

import { MaterialIcon } from "@/components/marketing/MaterialIcon";
import { useState } from "react";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = {
      type: "contact",
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      school: (form.elements.namedItem("school") as HTMLInputElement)?.value || "",
      phone: (form.elements.namedItem("phone") as HTMLInputElement)?.value || "",
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value,
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
        <h3 className="mt-3 text-lg font-semibold text-slate-900">Message sent!</h3>
        <p className="mt-2 text-sm text-slate-600">Thank you for reaching out. We&apos;ll respond within 24 hours.</p>
        <button onClick={() => setStatus("idle")} className="mt-4 text-sm text-[var(--primary)] hover:underline">
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div
        aria-hidden="true"
        className="absolute opacity-0 pointer-events-none"
        style={{ height: 0, overflow: "hidden" }}
      >
        <input name="_website" tabIndex={-1} autoComplete="off" />
      </div>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
          Your name
        </label>
        <input id="name" name="name" type="text" required className="input" placeholder="e.g. Sarah Nakamya" />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
          Email address
        </label>
        <input id="email" name="email" type="email" required className="input" placeholder="you@school.ac.ug" />
      </div>
      <div>
        <label htmlFor="school" className="block text-sm font-medium text-slate-700 mb-1.5">
          School name
        </label>
        <input id="school" name="school" type="text" className="input" placeholder="e.g. Kampala High School" />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">
          Phone number
        </label>
        <input id="phone" name="phone" type="tel" inputMode="tel" className="input" placeholder="e.g. 0750 000 000" />
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1.5">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={4}
          className="input resize-y min-h-[100px]"
          placeholder="Tell us how we can help..."
        />
      </div>

      {status === "error" && <div className="rounded-[16px] bg-[#fac5c5] p-4 text-sm text-[#b91c1c]">{errorMsg}</div>}

      <button
        type="submit"
        disabled={status === "loading"}
        className="btn btn-primary w-full justify-center py-4 text-base disabled:opacity-50"
      >
        {status === "loading" ? "Sending..." : "Send message"}
      </button>
    </form>
  );
}
