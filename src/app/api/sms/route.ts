import { NextRequest, NextResponse } from 'next/server'
import {
  apiSuccess,
  apiError,
  handleApiError,
  withSecurity,
  requireUserWithSchool,
  assertSchoolScopeOrDeny,
} from '@/lib/api-utils'

const AFRICAS_TALKING_API_KEY = process.env.AFRICAS_TALKING_API_KEY || ''
const AFRICAS_TALKING_USERNAME = process.env.AFRICAS_TALKING_USERNAME || 'sandbox'

interface SMSRequest {
  phone: string
  message: string
  schoolId: string
  studentId?: string
  type: 'individual' | 'class' | 'all'
}

function formatUgandaPhone(phone: string): string {
  // Remove all non-digit characters
  let formatted = phone.replace(/\D/g, '')
  
  // Validate it's a reasonable Uganda number
  // Must be 9 digits (without country code) or 12 digits (with +256)
  if (formatted.startsWith('256')) {
    // Already has country code
    if (formatted.length !== 12) {
      throw new Error('Invalid phone number: must be 12 digits with country code')
    }
    return '+' + formatted
  } else if (formatted.startsWith('0')) {
    // Leading zero - convert to country code
    formatted = formatted.substring(1)
    if (formatted.length !== 9) {
      throw new Error('Invalid phone number: must be 9 digits after leading zero')
    }
    return '+256' + formatted
  } else if (formatted.length === 9) {
    // Direct 9 digit number
    return '+256' + formatted
  } else {
    throw new Error('Invalid phone number format')
  }
}

async function sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string; statusCode?: number; error?: string }> {
  if (!AFRICAS_TALKING_API_KEY) {
    // Demo mode - log instead of sending
    console.log(`[SMS Demo] To: ${to}, Message: ${message}`)
    return { success: true, messageId: 'demo-' + Date.now(), statusCode: 101 }
  }

  try {
    const response = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        apiKey: AFRICAS_TALKING_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        username: AFRICAS_TALKING_USERNAME,
        to,
        message,
        from: 'SKOOLMATE', // Registered sender ID
      }),
    })

    const result = await response.json()
    
    // Africa's Talking returns SMSMessageData with Recipients array
    const recipient = result.SMSMessageData?.Recipients?.[0]
    
    if (recipient) {
      // Status codes: 101 = Sent, 102 = Queued, others = failed
      const success = recipient.statusCode === 101 || recipient.statusCode === 102
      return { 
        success, 
        messageId: recipient.messageId,
        statusCode: recipient.statusCode,
        error: success ? undefined : recipient.status
      }
    }
    
    return { success: false, error: result.SMSMessageData?.Message || 'Unknown error' }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Network error'
    return { success: false, error: errorMessage }
  }
}

async function handlePost(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request)
    if (!auth.ok) return auth.response

    const body: SMSRequest = await request.json()
    const { phone, message, schoolId } = body

    if (!phone || !message) {
      return apiError('Phone and message are required', 400)
    }

    const scope = assertSchoolScopeOrDeny({
      userSchoolId: auth.context.schoolId,
      requestedSchoolId: schoolId,
    })
    if (!scope.ok) return scope.response

    if (typeof phone !== 'string' || phone.length < 10 || phone.length > 15) {
      return apiError('Invalid phone number format', 400)
    }

    if (typeof message !== 'string' || message.length === 0 || message.length > 1000) {
      return apiError('Message must be between 1 and 1000 characters', 400)
    }

    const formattedPhone = formatUgandaPhone(phone)
    const result = await sendSMS(formattedPhone, message)

    if (result.success) {
      return apiSuccess({
        status: 'sent',
        messageId: result.messageId,
        statusCode: result.statusCode,
        demo: !AFRICAS_TALKING_API_KEY,
      })
    }

    return apiError('Failed to send SMS. Please verify the phone number and try again.', 500)
  } catch (error) {
    return handleApiError(error)
  }
}

async function handlePut(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { phones, message, schoolId } = body

    if (!phones || !phones.length || !message) {
      return apiError('Phone list and message are required', 400)
    }

    const scope = assertSchoolScopeOrDeny({
      userSchoolId: auth.context.schoolId,
      requestedSchoolId: schoolId,
    })
    if (!scope.ok) return scope.response

    if (!Array.isArray(phones) || phones.length > 100) {
      return apiError('Phone list must be an array with maximum 100 recipients', 400)
    }

    if (typeof message !== 'string' || message.length === 0 || message.length > 1000) {
      return apiError('Message must be between 1 and 1000 characters', 400)
    }

    const validPhones = phones.filter((p): p is string => 
      typeof p === 'string' && p.length >= 10 && p.length <= 15
    )

    if (validPhones.length === 0) {
      return apiError('No valid phone numbers provided', 400)
    }

    const formattedPhones = validPhones.map(formatUgandaPhone)
    const results = []

    for (const phone of formattedPhones) {
      const result = await sendSMS(phone, message)
      results.push({ phone, ...result })
    }

    const successCount = results.filter((r) => r.success).length

    return apiSuccess({
      totalSent: successCount,
      totalFailed: results.length - successCount,
      results,
      demo: !AFRICAS_TALKING_API_KEY,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// Africa's Talking delivery report callback
export async function PATCH(request: NextRequest) {
  try {
    // Require a shared secret for delivery callbacks to prevent spoofing.
    const expected = process.env.AFRICAS_TALKING_DELIVERY_SECRET
    if (expected) {
      const provided = request.headers.get('x-delivery-secret')
      if (provided !== expected) {
        return apiError('Unauthorized', 401)
      }
    }

    // This endpoint receives delivery reports from Africa's Talking
    const body = await request.json()
    const { id, status, phoneNumber, failureReason } = body

    // Log delivery status
    console.log(`[SMS Delivery] ID: ${id}, Status: ${status}, Phone: ${phoneNumber}`)

    // In production, update the message record in database
    // await supabase.from('messages').update({ status, delivery_status: status }).eq('message_id', id)

    return apiSuccess({ received: true })
  } catch (error) {
    return handleApiError(error)
  }
}

export const POST = withSecurity(handlePost, { rateLimit: { limit: 30, windowMs: 60000 } })
export const PUT = withSecurity(handlePut, { rateLimit: { limit: 10, windowMs: 60000 } })
// PATCH is exported above as the delivery report handler
