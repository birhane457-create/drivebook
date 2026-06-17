import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow staff/instructors/admin to upload server-hosted files.
    // (Client uploads should use signed Cloudinary/S3 flows.)
    if (!['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN', 'STAFF'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    // TypeScript workaround: formData is Web API FormData with get() method
    const file = (formData as any).get('file') as File | null
    const type = (formData as any).get('type') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Basic size/type hardening
    const MAX_BYTES = 5 * 1024 * 1024 // 5MB
    if ((file as any).size && (file as any).size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 413 })
    }

    const contentType = (file as any).type as string | undefined
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    if (contentType && !allowedTypes.has(contentType)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Generate safe unique filename (do not trust original name)
    const timestamp = Date.now()
    const ext =
      contentType === 'image/jpeg' ? 'jpg' :
      contentType === 'image/png' ? 'png' :
      contentType === 'image/webp' ? 'webp' :
      contentType === 'application/pdf' ? 'pdf' :
      'bin'

    const safeType = (type ?? 'file').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'file'
    const nonce = crypto.randomBytes(8).toString('hex')
    const filename = `${safeType}-${timestamp}-${nonce}.${ext}`
    const filepath = join(uploadsDir, filename)

    // Write file
    await writeFile(filepath, buffer)

    // Return public URL
    const url = `/uploads/${filename}`

    return NextResponse.json({ url, success: true })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
