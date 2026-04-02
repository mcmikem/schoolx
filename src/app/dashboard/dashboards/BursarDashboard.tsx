'use client'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useFeePayments, useFeeStructure } from '@/lib/hooks'
import MaterialIcon from '@/components/MaterialIcon'

export default function BursarDashboard() {
  const { school, user } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const { students } = useStudents(school?.id)
  const { payments } = useFeePayments(school?.id)
  const { feeStructure } = useFeeStructure(school?.id)

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`
    return `${amount}`
  }

  const currentDate = new Date()
  const greeting = currentDate.getHours() < 12 ? 'Good Morning' : currentDate.getHours() < 17 ? 'Good Afternoon' : 'Good Evening'

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const totalFeesExpected = students.reduce((total, student) => {
    const classFees = feeStructure.filter(f => !f.class_id || f.class_id === student.class_id)
    const studentExpected = classFees.reduce((sum, f) => sum + Number(f.amount || 0), 0)
    return total + studentExpected
  }, 0)

  const totalFeesCollected = payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
  const totalArrears = Math.max(0, totalFeesExpected - totalFeesCollected)
  const collectionRate = totalFeesExpected > 0 ? Math.round((totalFeesCollected / totalFeesExpected) * 100) : 0

  const todayStr = new Date().toISOString().split('T')[0]
  const todayPayments = payments.filter((p: any) => p.payment_date === todayStr)
  const todayCollected = todayPayments.reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0)

  return (
    <div className="content" style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      {/* PAGE HEADER */}
      <div style={{ 
        background: 'var(--surface)', 
        padding: '20px 24px', 
        borderBottom: '1px solid var(--border)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        gap: '16px',
        marginBottom: '20px',
        borderRadius: 'var(--r)',
        boxShadow: 'var(--shadow-sm)',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--navy)', lineHeight: 1.2 }}>
            {greeting}, {user?.full_name?.split(' ')[0]}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--t3)', marginTop: '4px', fontWeight: 500 }}>
            {school?.name} • {formatDate(currentDate)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button style={{             display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', 
             padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border)', 
             background: 'var(--surface)', fontSize: '13px', fontWeight: 600, color: 'var(--t1)', 
             cursor: 'pointer', boxShadow: 'var(--shadow-sm)'
          }}>
            <MaterialIcon icon="download" style={{ fontSize: 16, color: 'var(--t2)' }} />
            Export
          </button>
          <button style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', 
            padding: '10px 16px', borderRadius: 10, border: 'none', 
            background: 'var(--green)', fontSize: '13px', fontWeight: 600, color: 'white', 
            cursor: 'pointer', boxShadow: 'var(--shadow)'
          }}>
            <MaterialIcon icon="add_card" style={{ fontSize: 16 }} />
            Record Payment
          </button>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: 'var(--white)', padding: '16px', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--green-soft)', color: 'var(--green)' }}>
              <MaterialIcon icon="account_balance" style={{ fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 500 }}>Total Collected</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)' }}>UGX {formatCurrency(totalFeesCollected)}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>{collectionRate}% of expected</div>
            </div>
          </div>
        </div>
        <div style={{ background: 'var(--white)', padding: '16px', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--red-soft)', color: 'var(--red)' }}>
              <MaterialIcon icon="warning" style={{ fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 500 }}>Total Arrears</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--red)' }}>UGX {formatCurrency(totalArrears)}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>{students.length} students</div>
            </div>
          </div>
        </div>
        <div style={{ background: 'var(--white)', padding: '16px', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy-soft)', color: 'var(--navy)' }}>
              <MaterialIcon icon="calculate" style={{ fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 500 }}>Expected Total</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)' }}>UGX {formatCurrency(totalFeesExpected)}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>For {students.length} students</div>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '12px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>Finance Actions</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <Link href="/dashboard/fees" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textDecoration: 'none', background: 'var(--white)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--green-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcon icon="add_card" style={{ fontSize: 20, color: 'var(--green)' }} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>Record Payment</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>Add new payment</div>
            </div>
          </Link>
          <Link href="/dashboard/fees" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textDecoration: 'none', background: 'var(--white)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--navy-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcon icon="receipt_long" style={{ fontSize: 20, color: 'var(--navy)' }} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>Fee Structure</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>Manage fees</div>
            </div>
          </Link>
          <Link href="/dashboard/invoicing" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textDecoration: 'none', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--navy-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcon icon="description" style={{ fontSize: 20, color: 'var(--navy)' }} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>Invoicing</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>Generate invoices</div>
            </div>
          </Link>
          <Link href="/dashboard/cashbook" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textDecoration: 'none', background: 'var(--white)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--amber-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcon icon="book" style={{ fontSize: 20, color: 'var(--amber)' }} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>Cashbook</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>View transactions</div>
            </div>
          </Link>
        </div>
      </div>

      {/* COLLECTION PROGRESS */}
      <div style={{ background: 'var(--white)', padding: '20px', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>Collection Progress - Term {currentTerm}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>Fee collection overview</div>
          </div>
          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: 'var(--green-soft)', color: 'var(--green)' }}>{collectionRate}%</span>
        </div>
        <div style={{ height: 10, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(collectionRate, 100)}%`, height: '100%', background: 'var(--green)', borderRadius: 99, transition: 'width 0.3s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', fontSize: 12, color: 'var(--t3)' }}>
          <span>{formatCurrency(totalFeesCollected)} collected</span>
          <span>{formatCurrency(totalFeesExpected)} expected</span>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 1024px) {
          .content > div:nth-child(4) > div:last-child {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          .content {
            padding: 70px 12px 20px !important;
          }
          .content > div:first-child {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 16px !important;
          }
          .content > div:first-child > div:last-child {
            justify-content: flex-start !important;
            margin-top: 12px;
          }
          .content > div:nth-child(2) {
            grid-template-columns: 1fr !important;
          }
          .content > div:nth-child(3) > div:last-child {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
        }
        @media (max-width: 480px) {
          .content > div:nth-child(3) > div:last-child {
            grid-template-columns: 1fr !important;
          }
        }

        /* Mobile Bottom Nav */
        .mobile-bottom-nav {
          display: none;
        }
        @media (max-width: 768px) {
          .mobile-bottom-nav {
            display: flex !important;
          }
          .content {
            padding-bottom: 80px !important;
          }
        }
      `}</style>

      {/* Mobile Bottom Nav */}
      <div className="mobile-bottom-nav" style={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        background: 'var(--white)', 
        borderTop: '1px solid var(--border)', 
        padding: '10px 8px 24px',
        display: 'flex',
        justifyContent: 'space-around',
        zIndex: 100,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.08)'
      }}>
        <Link href="/dashboard" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
          <MaterialIcon icon="home" style={{ fontSize: 22, color: 'var(--navy)' }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--navy)' }}>Home</span>
        </Link>
        <Link href="/dashboard/fees" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
          <MaterialIcon icon="payments" style={{ fontSize: 22, color: 'var(--t3)' }} />
          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--t3)' }}>Finance</span>
        </Link>
        <Link href="/dashboard/invoicing" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
          <MaterialIcon icon="description" style={{ fontSize: 22, color: 'var(--t3)' }} />
          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--t3)' }}>Invoicing</span>
        </Link>
        <Link href="/dashboard/settings" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
          <MaterialIcon icon="settings" style={{ fontSize: 22, color: 'var(--t3)' }} />
          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--t3)' }}>Settings</span>
        </Link>
      </div>
    </div>
  )
}