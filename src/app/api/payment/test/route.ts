import { NextResponse } from 'next/server'

export async function GET(request: Request) {
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

export async function POST(request: Request) {
  // Simple test to verify POST works
  return NextResponse.json({
    status: 'ok',
    message: 'POST request received',
    timestamp: new Date().toISOString()
  })
}