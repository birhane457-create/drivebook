/**
 * Voice Service: Create Booking — DEPRECATED
 *
 * This endpoint has been deprecated because it creates bookings in
 * status: 'CONFIRMED' with isPaid: false, bypassing the payment state machine.
 *
 * All new voice bookings must use POST /api/public/bookings/bulk via the
 * drivebook-hybrid service. That route:
 *   - Creates PENDING_PAYMENT (not CONFIRMED)
 *   - Generates a paymentToken + checkoutUrl
 *   - Sends the payment link via SMS immediately
 *   - Transitions to CONFIRMED only after Stripe webhook confirms payment
 *
 * The drivebook-hybrid OpenAPI and AI_PROMPT_TEMPLATE already route all
 * voice traffic to /api/public/bookings/bulk — this endpoint is unreachable
 * from the current voice service configuration.
 *
 * Returning 410 GONE to make the deprecation explicit and catchable in logs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withVoiceServiceAuth } from '@/lib/middleware/voiceServiceAuth';

export const dynamic = 'force-dynamic';

async function handler(_req: NextRequest) {
  return NextResponse.json(
    {
      error: 'This endpoint is deprecated.',
      reason:
        'POST /api/voice/bookings created bookings as CONFIRMED with isPaid:false, ' +
        'bypassing the payment flow. Use POST /api/public/bookings/bulk via the ' +
        'drivebook-hybrid service instead — it generates a paymentToken, sends the ' +
        'SMS payment link immediately, and only confirms after Stripe payment succeeds.',
      replacement: 'POST /api/public/bookings/bulk',
    },
    { status: 410 }
  );
}

export const POST = withVoiceServiceAuth(handler);
