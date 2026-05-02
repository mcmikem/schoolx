import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiError, requireUserWithSchool } from '@/lib/api-utils'
import { logger } from "@/lib/logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10)

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 255)
}

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File size exceeds maximum allowed size of ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return `File type "${file.type}" is not allowed. Allowed types: images, PDFs, documents`
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request)
    if (!auth.ok) return auth.response

    if (!supabaseServiceKey) {
      return apiError('Server configuration error', 500)
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const path = (formData.get('path') as string) || ''

    if (!file) {
      return apiError('No file provided', 400)
    }

    const validationError = validateFile(file)
    if (validationError) {
      return apiError(validationError, 400)
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const bucketName = path.startsWith('logos') ? 'school-logos' : 'school-files'
    const sanitizedPath = path ? `${sanitizeFileName(path)}/${sanitizeFileName(file.name)}` : sanitizeFileName(file.name)

    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(sanitizedPath, file, {
        upsert: true,
        contentType: file.type,
      })

    if (error) {
      if (error.message.includes('Bucket') && error.message.includes('not found')) {
        const { error: bucketError } = await supabaseAdmin.storage.createBucket(bucketName, {
          public: bucketName === 'school-logos',
          fileSizeLimit: bucketName === 'school-logos' ? 5242880 : MAX_FILE_SIZE,
          allowedMimeTypes: bucketName === 'school-logos'
            ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
            : Array.from(ALLOWED_MIME_TYPES),
        })

        if (bucketError && !bucketError.message.includes('already exists')) {
          logger.error('Create bucket error:', bucketError)
          return apiError('Failed to create storage bucket', 500)
        }

        const retryUpload = await supabaseAdmin.storage
          .from(bucketName)
          .upload(sanitizedPath, file, {
            upsert: true,
            contentType: file.type,
          })

        if (retryUpload.error) {
          logger.error('Retry upload error:', retryUpload.error)
          return apiError('Failed to upload file', 500)
        }

        const { data: urlData } = supabaseAdmin.storage
          .from(bucketName)
          .getPublicUrl(retryUpload.data.path)

        return NextResponse.json({
          success: true,
          path: retryUpload.data.path,
          url: urlData.publicUrl,
        })
      }

      logger.error('Upload error:', error)
      return apiError('Failed to upload file', 500)
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(data.path)

    return NextResponse.json({
      success: true,
      path: data.path,
      url: urlData.publicUrl,
    })
  } catch (error) {
    logger.error('Server error:', error)
    return apiError('Failed to upload file', 500)
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request)
    if (!auth.ok) return auth.response

    if (!supabaseServiceKey) {
      return apiError('Server configuration error', 500)
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: buckets } = await supabaseAdmin.storage.listBuckets()

    return NextResponse.json({
      success: true,
      buckets: buckets?.map(b => ({ id: b.id, name: b.name, public: b.public }))
    })
  } catch (error) {
    logger.error('Server error:', error)
    return apiError('Failed to list buckets', 500)
  }
}
