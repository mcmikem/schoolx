import { NextRequest, NextResponse } from 'next/server'
import { apiSuccess, apiError, handleApiError, withSecurity } from '@/lib/api-utils'

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
  let formatted = phone.replace(/\s/g, '')
  if (formatted.startsWith('0')) {
    return '+256' + formatted.substring(1)
  } else if (!formatted.startsWith('+')) {
    return '+256' + formatted
  }
  return formatted
}

async function sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!AFRICAS_TALKING_API_KEY) {
    console.log(`[SMS Demo] To: ${to}, Message: ${message}`)
    return { success: true, messageId: 'demo-' + Date.now() }
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
        from: 'OmutoSMS',
      }),
    })

    const result = await response.json()
    const recipient = result.SMSMessageData?.Recipients?.[0]

    if (recipient?.status === 'Success') {
      return { success: true, messageId: recipient.messageId }
    }
    return { success: false, error: recipient?.status || 'Unknown error' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

async function handlePost(request: NextRequest) {
  try {
    const body: SMSRequest = await request.json()
    const { phone, message, schoolId } = body

    if (!phone || !message) {
      return apiError('Phone and message are required', 400)
    }

    if (!schoolId) {
      return apiError('School ID is required', 400)
    }

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
        demo: !AFRICAS_TALKING_API_KEY,
      })
    }

    return apiError(result.error || 'Failed to send SMS', 500)
  } catch (error) {
    return handleApiError(error)
  }
}

async function handlePut(request: NextRequest) {
  try {
    const body = await request.json()
    const { phones, message, schoolId } = body

    if (!phones || !phones.length || !message) {
      return apiError('Phone list and message are required', 400)
    }

    if (!schoolId) {
      return apiError('School ID is required', 400)
    }

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

export const POST = withSecurity(handlePost, { rateLimit: { limit: 30, windowMs: 60000 } })
export const PUT = withSecurity(handlePut, { rateLimit: { limit: 10, windowMs: 60000 } })
