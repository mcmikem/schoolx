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
  const cards = [
    {
      label: "Expected",
      value: formatValue(totalExpected),
      icon: "account_balance_wallet",
      tint: "bg-[var(--navy-soft)] text-[var(--navy)]",
    },
    {
      label: "Collected",
      value: formatValue(totalPaid),
      icon: "payments",
      tint: "bg-[var(--green-soft)] text-[var(--green)]",
    },
    {
      label: "Outstanding",
      value: formatValue(totalBalance),
      icon: "pending_actions",
      tint: "bg-[var(--amber-soft)] text-[var(--amber)]",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
      {cards.map((card) => (
        <div key={card.label} className="card-premium p-5 border border-[var(--border)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-black text-[var(--t3)] uppercase tracking-[0.24em]">
                {card.label}
              </div>
              <div className="text-2xl font-extrabold text-[var(--t1)] mt-2">
                {card.value}
              </div>
            </div>
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${card.tint}`}>
              <MaterialIcon icon={card.icon} className="text-[20px]" />
            </div>
          </div>
        </div>
      ))}

      <div className="card-premium p-5 border border-[var(--navy)] bg-[linear-gradient(135deg,var(--navy)_0%,var(--navy-mid)_100%)] text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-black text-white/75 uppercase tracking-[0.24em]">
              Realization
            </div>
            <div className="text-2xl font-extrabold mt-2">{realizationRate}%</div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
            <MaterialIcon icon="trending_up" className="text-white text-[20px]" />
          </div>
        </div>
        <div className="w-full bg-white/15 h-2 rounded-full mt-4 overflow-hidden">
          <div
            className="bg-white h-full transition-all duration-1000"
            style={{ width: `${realizationRate}%` }}
          />
        </div>
      </div>
    </div>
  );
}
