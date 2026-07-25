/**
 * POST /api/instructor/whiteboard/upload
 *
 * Accepts a base64 PNG data URL from WhiteboardCanvas, uploads it to Cloudinary,
 * and returns the public URL to be stored on the booking via LessonFeedbackForm.
 *
 * Auth: instructor session required.
 * The sketch is stored in the public/whiteboards folder — it is not a compliance
 * document and does not need signing. It is linked from the client-facing booking
 * detail page so students can see the diagram their instructor drew.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadToCloudinary } from '@/lib/services/cloudinary';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { dataUrl, bookingId } = body as { dataUrl?: string; bookingId?: string };

    if (!dataUrl) {
      return NextResponse.json({ error: 'dataUrl is required' }, { status: 400 });
    }

    // Validate it looks like a PNG data URI
    if (!dataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'dataUrl must be an image data URI' }, { status: 400 });
    }

    const result = await uploadToCloudinary(dataUrl, {
      folder: `public/whiteboards`,
      // Stable public ID so re-saving a sketch overwrites the previous version
      publicId: bookingId
        ? `booking-${bookingId}-sketch`
        : `instructor-${session.user.instructorId}-sketch-${Date.now()}`,
      resourceType: 'image',
      overwrite: true,
    });

    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error('Whiteboard upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
