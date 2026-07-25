/**
 * POST /api/upload
 *
 * General-purpose upload endpoint for public assets:
 * profile photos, car photos, brand logos.
 *
 * These go to the drivebook/public/ folder in Cloudinary
 * and return a permanent public URL (appropriate for avatars + logos).
 *
 * Previously this wrote to public/uploads/ on the local filesystem,
 * which is read-only on Vercel and does not persist across deployments.
 *
 * Compliance documents (licence, insurance, etc.) use a separate route:
 * POST /api/instructor/documents — those go to drivebook/private/
 * and are served via signed URLs only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { uploadToCloudinary } from '@/lib/services/cloudinary'

export const dynamic = 'force-dynamic'

// Map the `type` param to the correct Cloudinary subfolder and resource type
const TYPE_MAP: Record<string, { folder: string; resourceType: 'image' | 'raw' | 'auto' }> = {
  'profile':       { folder: 'public/avatars',   resourceType: 'image' },
  'car':           { folder: 'public/avatars',   resourceType: 'image' },
  'profile-photo': { folder: 'public/avatars',   resourceType: 'image' },
  'car-photo':     { folder: 'public/avatars',   resourceType: 'image' },
  'brand-logo':    { folder: 'public/logos',     resourceType: 'image' },
  'marketing':     { folder: 'public/marketing', resourceType: 'image' },
}

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN', 'STAFF'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const type = (formData.get('type') as string | null) ?? 'profile'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Size check
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 })
    }

    // MIME type check
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, WebP or GIF images are accepted' }, { status: 400 })
    }

    // Resolve folder from type
    const mapping = TYPE_MAP[type] ?? TYPE_MAP['profile']

    // Convert to buffer then base64 data URI for Cloudinary
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const dataUri = `data:${file.type};base64,${base64}`

    const result = await uploadToCloudinary(dataUri, {
      folder: mapping.folder,
      resourceType: mapping.resourceType,
      overwrite: false, // never silently overwrite — new uploads get new public IDs
    })

    return NextResponse.json({ url: result.url, publicId: result.publicId, success: true })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
