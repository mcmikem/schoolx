'use client'
import MaterialIcon from '@/components/MaterialIcon'

interface FeeStatsProps {
  stats: {
    totalExpected: number
    totalPaid: number
    totalBalance: number
    fullyPaid: number
    partialPaid: number
    notPaid: number
    momoTotal: number
    cashTotal: number
    bankTotal: number
  }
  paymentsCount: number
}

const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`

export default function FeeStats({ stats, paymentsCount }: FeeStatsProps) {
  return (
    <div className="stat-grid">
      <div className="stat-card" style={{ borderTop: '4px solid var(--red)' }}>
        <div className="stat-inner">
          <div className="stat-meta">
            <div className="stat-label">Total Arrears</div>
            <div className="stat-icon-box" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
              <MaterialIcon icon="account_balance_wallet" style={{ fontSize: '17px' }} />
            </div>
          </div>
          <div className="stat-val" style={{ color: 'var(--red)' }}>{formatCurrency(stats.totalBalance)}</div>
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>
            {stats.notPaid} students unpaid
          </div>
        </div>
      </div>
      <div className="bg-surface-container-lowest p-6 rounded-xl border-t-4 border-secondary relative overflow-hidden group hover:bg-surface-bright transition-colors">
        <div className="flex justify-between items-start mb-4">
          <MaterialIcon icon="payments" className="text-secondary bg-secondary-container p-2 rounded-lg" style={{ fontVariationSettings: 'FILL 1' }} />
          <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant opacity-60">Real-time</span>
        </div>
        <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-1">Total Collected</p>
        <h3 className="font-headline font-extrabold text-2xl text-on-surface tracking-tight">{formatCurrency(stats.totalPaid)}</h3>
        <div className="mt-4 flex items-center gap-2 text-[11px] font-bold text-secondary">
          <MaterialIcon icon="check_circle" className="text-sm" />
          <span>{stats.fullyPaid} Fully Paid</span>
        </div>
      </div>
      <div className="bg-surface-container-lowest p-6 rounded-xl border-t-4 border-tertiary-fixed-dim relative overflow-hidden group hover:bg-surface-bright transition-colors">
        <div className="flex justify-between items-start mb-4">
          <MaterialIcon icon="sync" className="text-tertiary bg-tertiary-fixed p-2 rounded-lg" style={{ fontVariationSettings: 'FILL 1' }} />
          <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant opacity-60">Processing</span>
        </div>
        <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-1">Partial Payments</p>
        <h3 className="font-headline font-extrabold text-2xl text-on-surface tracking-tight">{stats.partialPaid} Students</h3>
        <div className="mt-4 flex items-center gap-2 text-[11px] font-bold text-on-tertiary-fixed-variant">
          <MaterialIcon icon="schedule" className="text-sm" />
          <span>{paymentsCount} total transactions</span>
        </div>
      </div>
    </div>
  )
}
