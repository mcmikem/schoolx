import { createPayPalOrder } from '@/lib/payments/paypal'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }

  console.log('Testing PayPal integration...')
  console.log('PAYPAL_MODE:', process.env.PAYPAL_MODE)
  console.log('PAYPAL_CLIENT_ID exists:', !!process.env.PAYPAL_CLIENT_ID)
  console.log('PAYPAL_CLIENT_SECRET exists:', !!process.env.PAYPAL_CLIENT_SECRET)
  
  try {
    // Test creating an order
    const order = await createPayPalOrder(
      2999, // $29.99
      'USD',
      'test-subscription-123',
      'http://localhost:3000/success',
      'http://localhost:3000/cancel'
    )
    console.log('✅ PayPal order created successfully!')
    console.log('Order ID:', order.result?.id)
    return NextResponse.json({ success: true, orderId: order.result?.id })
  } catch (error: any) {
    console.error('❌ PayPal test failed:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
