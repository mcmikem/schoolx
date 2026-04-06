"use client";
import MaterialIcon from "@/components/MaterialIcon";

interface FeeStatsProps {
  stats: {
    totalExpected: number;
    totalPaid: number;
    totalBalance: number;
    fullyPaid: number;
    partialPaid: number;
    notPaid: number;
    momoTotal: number;
    cashTotal: number;
    bankTotal: number;
  };
  paymentsCount: number;
}

const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;

function CollectionDonut({ stats }: { stats: FeeStatsProps["stats"] }) {
  const total = stats.totalExpected || 1;
  const paidPercent = Math.round((stats.totalPaid / total) * 100);
  const partialPercent =
    stats.partialPaid > 0
      ? Math.round(
          (stats.partialPaid /
            Math.max(stats.fullyPaid + stats.partialPaid + stats.notPaid, 1)) *
            100,
        )
      : 0;
  const unpaidPercent =
    stats.notPaid > 0
      ? Math.round(
          (stats.notPaid /
            Math.max(stats.fullyPaid + stats.partialPaid + stats.notPaid, 1)) *
            100,
        )
      : 0;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const paidDash = (paidPercent / 100) * circumference;
  const partialDash = (partialPercent / 100) * circumference;
  const unpaidDash = (unpaidPercent / 100) * circumference;
  const partialOffset = -paidDash;
  const unpaidOffset = -(paidDash + partialDash);

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-32 h-32 flex-shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="var(--surface-container)"
            strokeWidth="12"
          />
          {stats.fullyPaid > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="var(--green)"
              strokeWidth="12"
              strokeDasharray={`${paidDash} ${circumference - paidDash}`}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          )}
          {stats.partialPaid > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="var(--amber)"
              strokeWidth="12"
              strokeDasharray={`${partialDash} ${circumference - partialDash}`}
              strokeDashoffset={partialOffset}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          )}
          {stats.notPaid > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="var(--red)"
              strokeWidth="12"
              strokeDasharray={`${unpaidDash} ${circumference - unpaidDash}`}
              strokeDashoffset={unpaidOffset}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-on-surface">
            {paidPercent}%
          </span>
          <span className="text-xs text-on-surface-variant">collected</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-on-surface-variant">Fully Paid</span>
          <span className="font-bold text-on-surface ml-auto">
            {stats.fullyPaid}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-on-surface-variant">Partial</span>
          <span className="font-bold text-on-surface ml-auto">
            {stats.partialPaid}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-on-surface-variant">Unpaid</span>
          <span className="font-bold text-on-surface ml-auto">
            {stats.notPaid}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function FeeStats({ stats, paymentsCount }: FeeStatsProps) {
  const totalStudents = stats.fullyPaid + stats.partialPaid + stats.notPaid;
  const collectionRate =
    totalStudents > 0 ? Math.round((stats.fullyPaid / totalStudents) * 100) : 0;

  return (
    <div className="mb-6">
      <div className="bg-surface-container-lowest rounded-xl p-6 mb-6">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-bold text-on-surface mb-1">
              Fee Collection Overview
            </h3>
            <p className="text-sm text-on-surface-variant mb-4">
              {formatCurrency(stats.totalPaid)} collected of{" "}
              {formatCurrency(stats.totalExpected)} expected
            </p>
            <CollectionDonut stats={stats} />
          </div>
          <div className="grid grid-cols-2 gap-4 w-full lg:w-auto">
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {collectionRate}%
              </div>
              <div className="text-xs text-green-700 font-medium">
                Collection Rate
              </div>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(stats.totalBalance)}
              </div>
              <div className="text-xs text-red-700 font-medium">
                Outstanding
              </div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.fullyPaid}
              </div>
              <div className="text-xs text-blue-700 font-medium">
                Fully Paid
              </div>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">
                {stats.notPaid}
              </div>
              <div className="text-xs text-amber-700 font-medium">Not Paid</div>
            </div>
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <div
          className="stat-card"
          style={{
            borderTop: "4px solid var(--red)",
            boxShadow:
              "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
          }}
        >
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Total Arrears</div>
              <div
                className="stat-icon-box"
                style={{ background: "var(--red-soft)", color: "var(--red)" }}
              >
                <MaterialIcon
                  icon="account_balance_wallet"
                  style={{ fontSize: "17px" }}
                />
              </div>
            </div>
            <div className="stat-val" style={{ color: "var(--red)" }}>
              {formatCurrency(stats.totalBalance)}
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 11,
                color: "var(--red)",
                fontWeight: 600,
              }}
            >
              {stats.notPaid} students unpaid
            </div>
          </div>
        </div>
        <div
          className="bg-surface-container-lowest p-6 rounded-xl border-t-4 border-secondary relative overflow-hidden group hover:bg-surface-bright transition-colors"
          style={{
            boxShadow:
              "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
          }}
        >
          <div className="flex justify-between items-start mb-4">
            <MaterialIcon
              icon="payments"
              className="text-secondary bg-secondary-container p-2 rounded-lg"
              style={{ fontVariationSettings: "FILL 1" }}
            />
            <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant opacity-60">
              Real-time
            </span>
          </div>
          <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-1">
            Total Collected
          </p>
          <h3 className="font-headline font-extrabold text-2xl text-on-surface tracking-tight">
            {formatCurrency(stats.totalPaid)}
          </h3>
          <div className="mt-4 flex items-center gap-2 text-[11px] font-bold text-secondary">
            <MaterialIcon icon="check_circle" className="text-sm" />
            <span>{stats.fullyPaid} Fully Paid</span>
          </div>
        </div>
        <div
          className="bg-surface-container-lowest p-6 rounded-xl border-t-4 border-tertiary-fixed-dim relative overflow-hidden group hover:bg-surface-bright transition-colors"
          style={{
            boxShadow:
              "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
          }}
        >
          <div className="flex justify-between items-start mb-4">
            <MaterialIcon
              icon="sync"
              className="text-tertiary bg-tertiary-fixed p-2 rounded-lg"
              style={{ fontVariationSettings: "FILL 1" }}
            />
            <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant opacity-60">
              Processing
            </span>
          </div>
          <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-1">
            Partial Payments
          </p>
          <h3 className="font-headline font-extrabold text-2xl text-on-surface tracking-tight">
            {stats.partialPaid} Students
          </h3>
          <div className="mt-4 flex items-center gap-2 text-[11px] font-bold text-on-tertiary-fixed-variant">
            <MaterialIcon icon="schedule" className="text-sm" />
            <span>{paymentsCount} total transactions</span>
          </div>
        </div>
      </div>
    </div>
  );
}
