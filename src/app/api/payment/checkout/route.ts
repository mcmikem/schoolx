import { NextRequest, NextResponse } from 'next/server'
import { createPayPalOrder } from '@/lib/payments/paypal'
import { PlanType } from '@/lib/subscription'
import { getPlanPrice, recordPayment } from '@/lib/payments/utils'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider, plan, returnUrl, cancelUrl } = body as {
      provider: 'paypal'
      plan: PlanType
      returnUrl?: string
      cancelUrl?: string
    }

    if (!provider || !plan) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, plan' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServerClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('school_id, role')
      .eq('auth_id', user.id)
      .single()

    if (!userData?.school_id) {
      return NextResponse.json(
        { error: 'School not found for user' },
        { status: 404 }
      )
    }

    const { data: school } = await supabase
      .from('schools')
      .select('*')
      .eq('id', userData.school_id)
      .single()

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 })
    }

    const amount = getPlanPrice(plan)

    if (provider === 'paypal') {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const ppReturnUrl = returnUrl || `${baseUrl}/dashboard/pricing?success=true&provider=paypal`
      const ppCancelUrl = cancelUrl || `${baseUrl}/dashboard/pricing?canceled=true&provider=paypal`

      const orderAmount = Math.round((amount / 4100) * 100) / 100

      const order = await createPayPalOrder(
        orderAmount * 100,
        'USD',
        school.id,
        ppReturnUrl,
        ppCancelUrl
      )

      const approvalUrl = order.result.links?.find(
        (link: { rel: string; href: string }) => link.rel === 'approve'
      )?.href

      await recordPayment({
        schoolId: school.id,
        plan,
        amount,
        provider: 'paypal',
        transactionId: order.result.id,
        paymentStatus: 'pending',
      })

      return NextResponse.json({
        success: true,
        url: approvalUrl,
        orderId: order.result.id,
      })
    }

    return NextResponse.json(
      { error: 'Invalid payment provider. Use PayPal.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
