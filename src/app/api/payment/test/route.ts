import { NextResponse } from 'next/server'

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({
    status: 'ok',
    message: 'Payment webhook endpoints are accessible',
    timestamp: new Date().toISOString(),
    endpoints: {
      stripeWebhook: '/api/payment/webhook',
      paypalWebhook: '/api/payment/paypal/webhook'
    }
  })
}

export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({
    status: 'ok',
    message: 'POST request received',
    timestamp: new Date().toISOString()
  })
}
