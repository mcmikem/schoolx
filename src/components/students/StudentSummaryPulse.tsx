"use client";
import React from "react";
import MaterialIcon from "@/components/MaterialIcon";

interface StudentSummaryPulseProps {
  totalStudents: number;
  boysCount: number;
  girlsCount: number;
  atRiskCount: number;
}

export default function StudentSummaryPulse({
  totalStudents,
  boysCount,
  girlsCount,
  atRiskCount,
}: StudentSummaryPulseProps) {
  const cards = [
    {
      label: "Total Enrollment",
      value: totalStudents,
      icon: "groups",
      tint: "bg-[var(--navy-soft)] text-[var(--navy)]",
      note: "Active learners",
    },
    {
      label: "Total Boys",
      value: boysCount,
      icon: "male",
      tint: "bg-blue-50 text-blue-700",
      note: `${Math.round((boysCount / Math.max(totalStudents, 1)) * 100)}% of school`,
    },
    {
      label: "Total Girls",
      value: girlsCount,
      icon: "female",
      tint: "bg-pink-50 text-pink-700",
      note: `${Math.round((girlsCount / Math.max(totalStudents, 1)) * 100)}% of school`,
    },
    {
      label: "At Risk / Dropout",
      value: atRiskCount,
      icon: "warning",
      tint: "bg-[var(--red-soft)] text-[var(--red)]",
      note: atRiskCount > 0 ? "Needs follow-up" : "Stable",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
      {cards.map((card) => (
        <div
          key={card.label}
          className="card-premium p-5 border border-[var(--border)] hover:-translate-y-0.5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--t3)]">
                {card.label}
              </div>
              <div className="text-3xl font-extrabold text-[var(--t1)] mt-2">
                {card.value}
              </div>
            </div>
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${card.tint}`}>
              <MaterialIcon icon={card.icon} className="text-[20px]" />
            </div>
          </div>
          <div className="mt-4 text-sm font-medium text-[var(--t3)]">
            {card.note}
          </div>
        </div>
      ))}
    </div>
  );
}
