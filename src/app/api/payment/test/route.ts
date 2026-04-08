import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // #region agent log
  fetch('http://127.0.0.1:7705/ingest/3abb6116-9e7c-43c2-8376-b2438c7d299e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9e14f3'},body:JSON.stringify({sessionId:'9e14f3',runId:'pre-fix',hypothesisId:'H4',location:'src/app/api/payment/test/route.ts:GET',message:'payment test GET called',data:{nodeEnv:process.env.NODE_ENV},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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

export async function POST(request: Request) {
  // #region agent log
  fetch('http://127.0.0.1:7705/ingest/3abb6116-9e7c-43c2-8376-b2438c7d299e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9e14f3'},body:JSON.stringify({sessionId:'9e14f3',runId:'pre-fix',hypothesisId:'H4',location:'src/app/api/payment/test/route.ts:POST',message:'payment test POST called',data:{nodeEnv:process.env.NODE_ENV},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }
  // Simple test to verify POST works
  return NextResponse.json({
    status: 'ok',
    message: 'POST request received',
    timestamp: new Date().toISOString()
  })
}