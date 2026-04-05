import { NextRequest, NextResponse } from 'next/server'
import { sendFeeOverdueReminders, sendAbsenteeAlert } from '@/lib/sms-automation'

// This endpoint is called by Vercel Cron or any scheduler
// Configure in vercel.json:
// "crons": [{ "path": "/api/cron/sms-reminders", "schedule": "0 8 * * 1-5" }]

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results: Record<string, any> = {}

    // Run fee overdue reminders
    const feeResult = await sendFeeOverdueReminders({ isDemo: false })
    results.fee_overdue = feeResult

    // Run absentee alerts
    const absentResult = await sendAbsenteeAlert({ isDemo: false })
    results.absentee_alert = absentResult

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
