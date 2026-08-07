import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * DEPRECATED — consolidated into /api/cron/instructor-onboarding
 *
 * The setup nudge logic is now step 2 of the onboarding sequence
 * (id: 'onboarding.setup', delayDays: 1).
 *
 * This endpoint is kept so any existing Railway/Vercel cron references
 * don't 404, but it does nothing. Remove it once all references are updated.
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json({
    deprecated: true,
    message: 'This cron has been consolidated into /api/cron/instructor-onboarding. No action taken.',
  })
}
