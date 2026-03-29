import { NextRequest, NextResponse } from 'next/server'
import { getSchoolPaymentHistory } from '@/lib/payments/utils'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '10')

    const supabase = createSupabaseServerClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('school_id')
      .eq('auth_id', user.id)
      .single()

    if (!userData?.school_id) {
      return NextResponse.json(
        { error: 'School not found for user' },
        { status: 404 }
      )
    }

    const payments = await getSchoolPaymentHistory(userData.school_id, limit)

    return NextResponse.json({
      success: true,
      invoices: payments.map((payment) => ({
        id: payment.id,
        plan: payment.plan,
        amount: payment.amount,
        currency: payment.currency,
        provider: payment.provider,
        status: payment.payment_status,
        transactionId: payment.transaction_id,
        invoiceUrl: payment.invoice_url,
        receiptUrl: payment.receipt_url,
        paidAt: payment.paid_at,
        createdAt: payment.created_at,
      })),
    })
  } catch (error) {
    console.error('Get invoices error:', error)
    return NextResponse.json(
      { error: 'Failed to get invoices' },
      { status: 500 }
    )
  }
}
