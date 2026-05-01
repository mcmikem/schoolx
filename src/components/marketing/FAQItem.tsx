"use client";
import { useState } from "react";

export function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white hover:shadow-sm transition-shadow">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#17325F]/30"
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-slate-900 pr-4">{q}</span>
        <span
          className={`material-symbols-outlined text-[#17325F] transition-transform duration-300 flex-shrink-0 ${open ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? "max-h-48 pb-5" : "max-h-0"}`}
      >
        <p className="px-6 text-sm leading-6 text-slate-600">{a}</p>
      </div>
    </div>
  );
}
