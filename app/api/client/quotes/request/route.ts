import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createJobRequest } from '@/lib/services/booking-service'
import { bookingRateLimit, checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  providerId: z.string(),
  serviceId: z.string(),
  requestDescription: z.string().min(10, 'Please provide more details about your request'),
  preferredDate: z.string().datetime().optional(),
  siteAddress: z.string().optional(),
  siteLatitude: z.number().optional(),
  siteLongitude: z.number().optional(),
  notes: z.string().optional(),
})

/**
 * POST /api/client/quotes/request
 * 
 * Customer creates a job request (quote-based booking flow).
 * Creates a Booking with status REQUEST_PENDING and links it to the provider.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // PH4-CLT-04: Rate limit quote requests per authenticated client
    const rateLimitId = getRateLimitIdentifier(session.user.id, req.headers.get('x-forwarded-for'), 'quote-request')
    const rateResult = await checkRateLimitStrict(bookingRateLimit, rateLimitId)
    if (!rateResult.success) {
      return NextResponse.json({ error: rateResult.error }, { status: 429 })
    }

    const body = await req.json()
    const data = requestSchema.parse(body)

    // Create job request
    const booking = await createJobRequest(
      {
        customerId: session!.user!.id,
        providerId: data.providerId,
        serviceId: data.serviceId,
        requestDescription: data.requestDescription,
        preferredDate: data.preferredDate ? new Date(data.preferredDate).toISOString() : undefined,
        siteAddress: data.siteAddress,
        siteAddressLat: data.siteLatitude,
        siteAddressLng: data.siteLongitude,
        notes: data.notes,
      },
      session!.user!.id,
      'CLIENT',
    )

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        status: booking.status,
        requestedAt: booking.requestedAt,
        serviceId: booking.serviceId,
        requestDescription: booking.requestDescription,
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('[POST /api/client/quotes/request] Error:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json({
        error: 'Validation error',
        details: error.errors,
      }, { status: 400 })
    }

    return NextResponse.json({
      error: error.message || 'Failed to create job request',
    }, { status: 500 })
  }
}
