import { buildDashboardTrendData, buildEcosystemActivities } from '@/lib/dashboard-data'

describe('dashboard real data helpers', () => {
  it('does not fabricate trend values for real accounts with no activity', () => {
    const data = buildDashboardTrendData({
      stats: { totalStudents: 24 },
      activeStudentsCount: 24,
      payments: [],
      attendanceRate: 0,
      isDemo: false,
      currentDate: new Date('2026-04-18T00:00:00Z'),
    })

    expect(data.every((item) => item.fees === 0)).toBe(true)
    expect(data.filter((item) => item.attendance !== null).length).toBe(0)
  })

  it('aggregates actual payment data into the monthly trend', () => {
    const data = buildDashboardTrendData({
      stats: { totalStudents: 10 },
      activeStudentsCount: 10,
      payments: [
        { amount_paid: 50000, payment_date: '2026-03-10' },
        { amount_paid: 25000, payment_date: '2026-03-15' },
        { amount_paid: 10000, payment_date: '2026-04-02' },
      ],
      attendanceRate: 93,
      isDemo: false,
      currentDate: new Date('2026-04-18T00:00:00Z'),
    })

    const mar = data.find((item) => item.name === 'Mar')
    const apr = data.find((item) => item.name === 'Apr')

    expect(mar?.fees).toBe(75000)
    expect(apr?.fees).toBe(10000)
    expect(apr?.attendance).toBe(93)
  })

  it('shows no fake ecosystem events when there is no real activity', () => {
    const activities = buildEcosystemActivities({ payments: [], smsStats: undefined })
    expect(activities).toEqual([])
  })
})
