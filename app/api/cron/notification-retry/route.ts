/**
 * Cron Job: Notification Retry Queue Processor
 *
 * Endpoint: /api/cron/notification-retry
 * Schedule: Every 5 minutes (vercel.json)
 * Auth:     Vercel Crons (x-vercel-cron header) or CRON_SECRET bearer
 *
 * Picks up PENDING NotificationRetry rows that are due for retry and
 * attempts to send them via email or SMS. Uses exponential backoff:
 *   Attempt 1 → 2 → 3, then marks as FAILED for manual admin review.
 *
 * See: lib/services/notificationRetry.ts for full logic.
 */

import { NextRequest, NextResponse } from 'next/server'
import { processRetryQueue } from '@/lib/services/notificationRetry'
import { pingCronHealth, failCronHealth } from '@/lib/services/cron-health'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const startTime = Date.now()

  // Auth: Vercel Crons or CRON_SECRET bearer
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  const authHeader = req.headers.get('authorization')
  const hasCronSecret =
    process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!isVercelCron && !hasCronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processRetryQueue()

    await pingCronHealth('notification-retry')

    return NextResponse.json({
      success: true,
      ...result,
      duration: `${Date.now() - startTime}ms`,
    })
  } catch (error) {
    console.error('[notification-retry cron] Unhandled error:', error)
    await failCronHealth('notification-retry', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    )
  }
}

// Allow POST for manual triggers
export async function POST(req: NextRequest) {
  return GET(req)
}
