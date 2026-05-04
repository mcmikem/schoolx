import { NextRequest, NextResponse } from 'next/server'
import { sendFeeOverdueReminders, sendAbsenteeAlert } from '@/lib/sms-automation'
import { requireCronSecretOrDeny, createServiceRoleClientOrThrow } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  const cron = requireCronSecretOrDeny(request)
  if (!cron.ok) return cron.response

  try {
    const supabase = createServiceRoleClientOrThrow()
    const { data: schools } = await supabase
      .from('schools')
      .select('id, name')
      .eq('is_active', true)

    if (!schools || schools.length === 0) {
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        results: { message: 'No active schools found' },
      })
    }

    const results: Record<string, any> = {}

    for (const school of schools) {
      try {
        const feeResult = await sendFeeOverdueReminders({ schoolId: school.id, isDemo: false })
        const absentResult = await sendAbsenteeAlert({ schoolId: school.id, isDemo: false })
        results[school.id] = {
          schoolName: school.name,
          fee_overdue: feeResult,
          absentee_alert: absentResult,
        }
      } catch (schoolError) {
        results[school.id] = {
          schoolName: school.name,
          error: schoolError instanceof Error ? schoolError.message : 'Unknown error',
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      schoolsProcessed: schools.length,
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
