"use client";
import { useState } from "react";
import { FadeIn } from "./FadeIn";
import { DAY_STEPS } from "./landing-data";
import { APP_NAME } from "@/lib/app-name";

export function DayTimeline() {
  const [activeStep, setActiveStep] = useState(0);
  const step = DAY_STEPS[activeStep];

  return (
    <section id="how-it-works" className="bg-white py-18 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">A real school day</p>
            <h2 className="mt-3 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
              See how {APP_NAME} runs through your day
            </h2>
          </div>

          <div className="relative flex items-start gap-0 mb-10 overflow-x-auto pb-2">
            <div className="absolute top-5 left-5 right-5 h-0.5 bg-slate-200 hidden sm:block" />
            <div className="flex gap-3 sm:gap-0 sm:flex-1 sm:justify-between w-full min-w-max sm:min-w-0">
              {DAY_STEPS.map((s, i) => (
                <button
                  key={s.time}
                  onClick={() => setActiveStep(i)}
                  className="relative flex flex-col items-center gap-2 sm:flex-1 px-2"
                >
                  <div
                    className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                      activeStep === i
                        ? "border-transparent text-white shadow-lg scale-110"
                        : activeStep > i
                          ? "border-transparent text-white"
                          : "border-slate-200 bg-white text-slate-400"
                    }`}
                    style={activeStep >= i ? { background: s.color } : {}}
                  >
                    <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                  </div>
                  <span
                    className={`text-xs font-semibold whitespace-nowrap ${activeStep === i ? "text-slate-900" : "text-slate-400"}`}
                  >
                    {s.time}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div key={activeStep} className="grid gap-6 lg:grid-cols-[1fr_1fr] animate-fade-in">
            <div className="rounded-[32px] p-7 lg:p-9" style={{ background: step.color }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                  <span className="material-symbols-outlined text-[22px] text-white">{step.icon}</span>
                </div>
                <div>
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-[0.2em]">{step.time}</p>
                  <p className="text-white font-semibold text-base">{step.title}</p>
                </div>
              </div>
              <p className="text-white/85 text-base leading-7">{step.what}</p>
            </div>

            <div className="flex flex-col gap-5">
              <div className="rounded-[28px] border border-slate-200 bg-[#f8fbff] p-6 flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[20px] text-[var(--t1)]">check_circle</span>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Result</p>
                </div>
                <p className="text-slate-800 text-base leading-7 font-medium">{step.result}</p>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setActiveStep((p) => Math.max(0, p - 1))}
                  disabled={activeStep === 0}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  Previous
                </button>
                <div className="flex gap-1.5">
                  {DAY_STEPS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveStep(i)}
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: activeStep === i ? 24 : 8,
                        background: activeStep === i ? step.color : "#cbd5e1",
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setActiveStep((p) => Math.min(DAY_STEPS.length - 1, p + 1))}
                  disabled={activeStep === DAY_STEPS.length - 1}
                  className="flex items-center gap-2 rounded-full bg-[var(--navy)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
