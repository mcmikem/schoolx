"use client";
import { useState } from "react";
import Link from "next/link";
import { FadeIn } from "./FadeIn";
import { MaterialIcon } from "./MaterialIcon";
import { ROLES } from "./landing-data";

export function RoleSwitcher() {
  const [activeRole, setActiveRole] = useState(0);
  const role = ROLES[activeRole];

  return (
    <section
      id="features"
      className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24"
    >
      <FadeIn>
        <div className="text-center mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
            Built for every person in the school
          </p>
          <h2 className="mt-3 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Pick your role. See what it does for you.
          </h2>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {ROLES.map((r, i) => (
            <button
              key={r.key}
              onClick={() => setActiveRole(i)}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 border ${
                activeRole === i
                  ? "bg-[#001F3F] text-white border-[#001F3F] shadow-md"
                  : "bg-white text-slate-600 border-slate-200 hover:border-[#001F3F]/30 hover:text-slate-900"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {r.icon}
              </span>
              {r.key}
            </button>
          ))}
        </div>

        <div
          key={role.key}
          className="grid gap-6 lg:grid-cols-[1fr_1.4fr] items-stretch animate-fade-in"
        >
          <div
            className="rounded-[32px] p-7 lg:p-9 flex flex-col justify-between"
            style={{ background: role.color }}
          >
            <div>
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl mb-6"
                style={{ background: "rgba(255,255,255,0.12)" }}
              >
                <span className="material-symbols-outlined text-[28px] text-white">
                  {role.icon}
                </span>
              </div>
              <p className="text-white/60 text-xs font-semibold uppercase tracking-[0.22em] mb-3">
                {role.key}
              </p>
              <p className="font-['Sora'] text-2xl font-semibold text-white leading-snug">
                &ldquo;{role.quote}&rdquo;
              </p>
            </div>
            <div className="mt-8 pt-6 border-t border-white/15">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors px-5 py-2.5 text-sm font-semibold text-white"
              >
                Try it free
                <span className="material-symbols-outlined text-[16px]">
                  arrow_forward
                </span>
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-1">
            {role.tasks.map((task, i) => (
              <div
                key={task.label}
                className="flex items-center gap-4 rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-2xl flex-shrink-0"
                  style={{ background: role.bg, color: role.color }}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {task.icon}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-800">
                  {task.label}
                </p>
                <span className="material-symbols-outlined text-[16px] text-slate-300 ml-auto flex-shrink-0">
                  chevron_right
                </span>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
