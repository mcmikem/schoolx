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

const STORAGE_BUCKETS = {
  'school-logos': {
    public: true,
    fileSizeLimit: 5242880,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as string[],
  },
  'school-files': {
    public: false,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
  },
} as const

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 255)
}

function sanitizePathSegment(segment: string): string {
  return sanitizeFileName(segment).replace(/^_+|_+$/g, '')
}

function sanitizeRelativePath(path: string): string {
  return path
    .split('/')
    .map((segment) => sanitizePathSegment(segment))
    .filter(Boolean)
    .join('/')
}

function getBucketName(path: string): keyof typeof STORAGE_BUCKETS {
  return path.startsWith('logos') ? 'school-logos' : 'school-files'
}

function buildScopedPath(schoolId: string, rawPath: string, fileName: string): string {
  const bucketName = getBucketName(rawPath)
  const relativePath = sanitizeRelativePath(
    rawPath.replace(/^logos\/?/, '').replace(/^files\/?/, '')
  )
  const basePath = bucketName === 'school-logos'
    ? `schools/${schoolId}/logos`
    : `schools/${schoolId}/files`

  return [basePath, relativePath, sanitizeFileName(fileName)].filter(Boolean).join('/')
}

async function ensureBucketExists(supabaseAdmin: any, bucketName: keyof typeof STORAGE_BUCKETS) {
  const bucketConfig = STORAGE_BUCKETS[bucketName]
  const { error } = await supabaseAdmin.storage.createBucket(bucketName, bucketConfig)

  if (error && !error.message.includes('already exists')) {
    throw error
  }
}

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File size exceeds maximum allowed size of ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return `File type "${file.type}" is not allowed. Allowed types: images, PDFs, documents`
  }

  // TODO: Add server-side content verification
  // In production, use the `file-type` library to verify the actual file content
  // matches the declared MIME type, preventing MIME-type spoofing attacks.
  // Example:
  //   import { fileTypeFromBuffer } from "file-type";
  //   const buffer = Buffer.from(await file.arrayBuffer());
  //   const type = await fileTypeFromBuffer(buffer);
  //   if (!type || !ALLOWED_MIME_TYPES.has(type.mime)) {
  //     return "File content does not match declared type";
  //   }

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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    if (!file) {
      await ensureBucketExists(supabaseAdmin, 'school-logos')
      await ensureBucketExists(supabaseAdmin, 'school-files')

      return NextResponse.json({
        success: true,
        exists: true,
        buckets: Object.keys(STORAGE_BUCKETS),
      })
    }

    const validationError = validateFile(file)
    if (validationError) {
      return apiError(validationError, 400)
    }

    const bucketName = getBucketName(path)
    const sanitizedPath = buildScopedPath(auth.context.schoolId || 'unknown-school', path, file.name)

    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(sanitizedPath, file, {
        upsert: false,
        contentType: file.type,
      })

    if (error) {
      if (error.message.includes('Bucket') && error.message.includes('not found')) {
        try {
          await ensureBucketExists(supabaseAdmin, bucketName)
        } catch (bucketError) {
          logger.error('Create bucket error:', bucketError)
          return apiError('Failed to create storage bucket', 500)
        }

        const retryUpload = await supabaseAdmin.storage
          .from(bucketName)
          .upload(sanitizedPath, file, {
            upsert: false,
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
    const bucketNames = new Set((buckets || []).map((bucket) => bucket.name))

    return NextResponse.json({
      success: true,
      exists: bucketNames.has('school-logos') && bucketNames.has('school-files'),
      buckets: buckets?.map(b => ({ id: b.id, name: b.name, public: b.public }))
    })
  } catch (error) {
    logger.error('Server error:', error)
    return apiError('Failed to list buckets', 500)
  }
}
