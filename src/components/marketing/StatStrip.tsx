"use client";
import { useCounter } from "@/hooks/useCounter";
import { MaterialIcon } from "./MaterialIcon";

export function StatStrip() {
  const studentsC = useCounter(500, 1800);
  const hoursC = useCounter(5, 1400);
  const deliveryC = useCounter(97, 2000);
  const minutesC = useCounter(2, 1200);

  const stats = [
    {
      ref: studentsC.ref,
      icon: "group",
      value: studentsC.display,
      suffix: "+",
      label: "Students managed daily per school",
      color: "#10b981",
    },
    {
      ref: hoursC.ref,
      icon: "timer",
      value: hoursC.display,
      suffix: " hrs",
      label: "Admin time saved every week",
      color: "#f59e0b",
    },
    {
      ref: deliveryC.ref,
      icon: "sms",
      value: deliveryC.display,
      suffix: "%",
      label: "Parent SMS delivery rate",
      color: "#38bdf8",
    },
    {
      ref: minutesC.ref,
      icon: "rocket_launch",
      value: minutesC.display,
      suffix: " min",
      label: "Setup to first class recorded",
      color: "#a78bfa",
    },
  ];

  return (
    <section className="bg-[#001F3F]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 gap-y-10 gap-x-6 lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              ref={s.ref}
              className="flex flex-col items-center text-center"
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl mb-4"
                style={{ background: `${s.color}22`, color: s.color }}
              >
                <span className="material-symbols-outlined text-[24px]">
                  {s.icon}
                </span>
              </div>
              <p className="font-['Sora'] text-4xl font-bold text-white tracking-tight">
                {s.value}
                {s.suffix}
              </p>
              <p className="mt-2 text-sm text-white/60">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
