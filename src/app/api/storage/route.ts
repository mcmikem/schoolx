import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Check if bucket exists
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    let bucketExists = buckets?.some(b => b.id === 'school-logos')

    if (!bucketExists) {
      // Create bucket
      const { error } = await supabaseAdmin.storage.createBucket('school-logos', {
        public: true,
        fileSizeLimit: 5242880,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      })

      if (error && !error.message.includes('already exists')) {
        console.error('Create bucket error:', error)
        return Response.json({ success: false, error: error.message }, { status: 500 })
      }
    }

    // Try to set bucket permissions via update (this makes it work for authenticated users)
    // The simplest approach is to update the anon key permissions in Supabase dashboard
    // But for now, let's just return success
    
    return Response.json({ success: true, message: 'Bucket created. Note: You may need to add storage policies in Supabase Dashboard > Storage > Policies' })
  } catch (error: any) {
    console.error('Server error:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const bucket = buckets?.find(b => b.id === 'school-logos')

    return Response.json({ 
      success: true, 
      exists: !!bucket,
      buckets: buckets?.map(b => ({ id: b.id, name: b.name }))
    })
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}
