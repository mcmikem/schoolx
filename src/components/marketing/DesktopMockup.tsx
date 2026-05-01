"use client";
import { useState, useEffect } from "react";
import { useCounter } from "@/hooks/useCounter";
import { MaterialIcon } from "./MaterialIcon";
import { tabContent } from "./landing-data";

export function DesktopMockup() {
  const [activeTab, setActiveTab] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const content = tabContent[activeTab];
  const feeCounter = useCounter(18.4, 2500, 1);
  const staffCounter = useCounter(43, 1800);
  const lowAttCounter = useCounter(3, 1200);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setActiveTab(index);
    }
  };

  return (
    <div
      className={`mockup-shell mockup-desktop relative rounded-[32px] border border-slate-200 bg-white p-3 shadow-[0_40px_90px_rgba(15,23,42,0.14)] transition-all duration-700 min-h-[480px] ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
    >
      <div className="rounded-[28px] border border-slate-200 bg-[#f8fbff] overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-500">
            omuto.org/dashboard
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-[#0e2345] p-5 text-white lg:border-b-0 lg:border-r">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/12 text-white">
                <MaterialIcon icon="school" className="text-[20px]" />
              </div>
              <div>
                <p className="text-sm font-semibold">SkoolMate OS</p>
                <p className="text-xs text-white/65">Head teacher workspace</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {[
                "Dashboard",
                "Students",
                "Attendance",
                "Exams",
                "Finance",
                "Messages",
              ].map((item, index) => (
                <button
                  key={item}
                  onClick={() => setActiveTab(index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  tabIndex={0}
                  aria-pressed={index === activeTab}
                  className={`w-full text-left rounded-2xl px-3 py-2.5 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50 ${
                    index === activeTab
                      ? "bg-white text-[#0e2345] shadow-sm"
                      : "bg-white/5 text-white/80 hover:bg-white/10"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </aside>

          <div className="space-y-4 p-4 sm:p-5">
            <div className="grid gap-3 md:grid-cols-3">
              {content.stats.map(([label, value, note], i) => {
                const counter =
                  i === 0 ? feeCounter : i === 1 ? staffCounter : lowAttCounter;
                return (
                  <div
                    key={label}
                    ref={counter.ref}
                    className="story-card rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:shadow-md transition-shadow cursor-default"
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                      {label}
                    </p>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                      {i === 0 && activeTab === 0
                        ? `UGX ${counter.display}M`
                        : value}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{note}</p>
                  </div>
                );
              })}
            </div>

            {content.bars && (
              <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {activeTab === 2
                        ? "Attendance by class"
                        : activeTab === 3
                          ? "Candidate and class performance"
                          : "Performance overview"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Term II academic snapshot
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  {content.bars.map((bar, i) => (
                    <div key={bar.name}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">
                          {bar.name}
                        </span>
                        <span className="text-slate-500">{bar.value}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full ${bar.color} transition-all duration-1000 ease-out`}
                          style={{
                            width: mounted ? `${bar.value}%` : "0%",
                            transitionDelay: `${i * 200 + 300}ms`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {content.students && (
              <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <p className="text-sm font-semibold text-slate-900 mb-4">
                  Recent students
                </p>
                <div className="space-y-3">
                  {content.students.map((s) => (
                    <div
                      key={s.name}
                      className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {s.name}
                        </p>
                        <p className="text-xs text-slate-500">{s.class}</p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${s.balance === "UGX 0" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                      >
                        {s.balance}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {content.actions && (
              <div className="rounded-[28px] bg-[#eef5ff] p-5 ring-1 ring-[#d7e4fb]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Quick actions
                    </p>
                    <p className="text-xs text-slate-500">Common tasks</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {content.actions.map((item, i) => (
                    <div
                      key={item.title}
                      className={`story-card flex items-start gap-3 rounded-[22px] bg-white p-3.5 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer ${
                        mounted
                          ? "opacity-100 translate-x-0"
                          : "opacity-0 translate-x-4"
                      }`}
                      style={{ transitionDelay: `${i * 100 + 300}ms` }}
                    >
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#17325F]/8 text-[#17325F] flex-shrink-0">
                        <MaterialIcon
                          icon={item.icon}
                          className="text-[20px]"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {item.note}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
