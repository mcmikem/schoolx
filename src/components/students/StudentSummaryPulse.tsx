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
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="card-premium p-6 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-2xl bg-[var(--navy-soft)] flex items-center justify-center mb-4">
          <MaterialIcon icon="groups" className="text-[var(--navy)] text-2xl" />
        </div>
        <div className="text-3xl font-extrabold text-[var(--t1)]">
          {totalStudents}
        </div>
        <div className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-widest mt-1">
          Total Enrollment
        </div>
      </div>

      <div className="card-premium p-6 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
          <MaterialIcon icon="male" className="text-blue-600 text-2xl" />
        </div>
        <div className="text-3xl font-extrabold text-blue-700">{boysCount}</div>
        <div className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-widest mt-1">
          Total Boys
        </div>
      </div>

      <div className="card-premium p-6 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center mb-4">
          <MaterialIcon icon="female" className="text-pink-600 text-2xl" />
        </div>
        <div className="text-3xl font-extrabold text-pink-700">
          {girlsCount}
        </div>
        <div className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-widest mt-1">
          Total Girls
        </div>
      </div>

      <div className="card-premium p-6 flex flex-col items-center justify-center text-center border-l-4 border-l-[var(--red)]">
        <div className="w-12 h-12 rounded-2xl bg-[var(--red-soft)] flex items-center justify-center mb-4">
          <MaterialIcon icon="warning" className="text-[var(--red)] text-2xl" />
        </div>
        <div className="text-3xl font-extrabold text-[var(--red)]">
          {atRiskCount}
        </div>
        <div className="text-[10px] font-bold text-[var(--red)] uppercase tracking-widest mt-1">
          At Risk / Dropout
        </div>
      </div>
    </div>
  );
}
