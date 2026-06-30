import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { v2 as cloudinary } from 'cloudinary'
import { validateBase64DataUrl } from '@/lib/uploads/validateUpload'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export const dynamic = 'force-dynamic'

/**
 * POST /api/instructor/whiteboard/upload
 *
 * Accepts a base64 PNG data URL from the whiteboard canvas and uploads it
 * to Cloudinary under the instructor's folder.
 *
 * Body: { dataUrl: "data:image/png;base64,..." }
 * Returns: { url: "https://res.cloudinary.com/..." }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { dataUrl } = body

    if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 })
    }

    // Validate data URL — checks format, size, and magic bytes
    const validation = validateBase64DataUrl(dataUrl)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status })
    }

    const result = await cloudinary.uploader.upload(dataUrl, {
      folder: `drivebook/instructors/${session.user.instructorId}/whiteboard`,
      resource_type: 'image',
      format: 'png',
      // Auto-quality for smaller file size while keeping readability
      quality: 'auto:good',
    })

    return NextResponse.json({ url: result.secure_url, success: true })
  } catch (error) {
    console.error('Whiteboard upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
