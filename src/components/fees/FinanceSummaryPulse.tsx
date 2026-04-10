"use client";
import React from "react";
import MaterialIcon from "@/components/MaterialIcon";

interface FinanceSummaryPulseProps {
  totalExpected: number;
  totalPaid: number;
  totalBalance: number;
  realizationRate: number;
  formatValue: (val: number) => string;
}

export default function FinanceSummaryPulse({
  totalExpected,
  totalPaid,
  totalBalance,
  realizationRate,
  formatValue,
}: FinanceSummaryPulseProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="card-premium p-6 border-l-4 border-l-[var(--navy)]">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--navy-soft)] flex items-center justify-center">
            <MaterialIcon icon="account_balance_wallet" className="text-[var(--navy)] text-lg" />
          </div>
          <span className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-widest">Expected</span>
        </div>
        <div className="text-2xl font-extrabold text-[var(--t1)]">
          {formatValue(totalExpected)}
        </div>
      </div>

      <div className="card-premium p-6 border-l-4 border-l-[var(--green)]">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--green-soft)] flex items-center justify-center">
            <MaterialIcon icon="payments" className="text-[var(--green)] text-lg" />
          </div>
          <span className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-widest">Collected</span>
        </div>
        <div className="text-2xl font-extrabold text-[var(--green)]">
          {formatValue(totalPaid)}
        </div>
      </div>

      <div className="card-premium p-6 border-l-4 border-l-[var(--amber)]">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--amber-soft)] flex items-center justify-center">
            <MaterialIcon icon="pending_actions" className="text-[var(--amber)] text-lg" />
          </div>
          <span className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-widest">Outstanding</span>
        </div>
        <div className="text-2xl font-extrabold text-[var(--amber)]">
          {formatValue(totalBalance)}
        </div>
      </div>

      <div className="card-premium p-6 border-l-4 border-l-[var(--navy)] bg-[var(--navy-mid)] text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <MaterialIcon icon="trending_up" className="text-white text-lg" />
          </div>
          <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Realization</span>
        </div>
        <div className="text-2xl font-extrabold">
          {realizationRate}%
        </div>
        <div className="w-full bg-white/20 h-1.5 rounded-full mt-3 overflow-hidden">
          <div 
            className="bg-white h-full transition-all duration-1000" 
            style={{ width: `${realizationRate}%` }} 
          />
        </div>
      </div>
    </div>
  );
}
