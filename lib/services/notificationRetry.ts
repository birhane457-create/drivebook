/**
 * lib/services/notificationRetry.ts
 *
 * Lightweight retry queue for failed email and SMS sends.
 *
 * FLOW:
 *   1. A send fails → call enqueueNotification() — writes a NotificationRetry row
 *   2. Cron /api/cron/notification-retry runs every 5 minutes
 *   3. It calls processRetryQueue() which picks up PENDING rows where nextAttemptAt <= now
 *   4. Each row is attempted; on success → status = SENT
 *   5. On failure → attemptCount++, nextAttemptAt set via exponential backoff
 *   6. After maxAttempts (3) → status = FAILED (visible to admin for manual review)
 *
 * BACKOFF SCHEDULE (minutes): [5, 15, 45]
 *   Attempt 1 fails → retry in 5 min
 *   Attempt 2 fails → retry in 15 min
 *   Attempt 3 fails → retry in 45 min → FAILED
 *
 * IDEMPOTENCY:
 *   Each enqueue requires an idempotencyKey. Duplicate keys are silently ignored.
 *   This means you can safely call enqueueNotification() in a catch block even
 *   if the same event fires twice (e.g. Stripe webhook retry).
 */

import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/services/email'
import { smsService } from '@/lib/services/sms'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minutes to wait before each retry attempt (index = attemptCount after failure) */
const BACKOFF_MINUTES = [5, 15, 45] as const

const MAX_ATTEMPTS = 3

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationChannel = 'EMAIL' | 'SMS'

export interface EnqueueEmailParams {
  channel: 'EMAIL'
  recipient: string       // email address
  subject: string
  body: string            // HTML
  idempotencyKey: string  // unique per send event, e.g. `booking-confirm-${bookingId}`
  bookingId?: string
  userId?: string
  metadata?: Record<string, unknown>
}

export interface EnqueueSMSParams {
  channel: 'SMS'
  recipient: string       // E.164 phone number
  body: string            // plain text
  idempotencyKey: string
  bookingId?: string
  userId?: string
  metadata?: Record<string, unknown>
}

export type EnqueueParams = EnqueueEmailParams | EnqueueSMSParams

// ── enqueueNotification ───────────────────────────────────────────────────────

/**
 * Add a failed notification to the retry queue.
 *
 * Safe to call in a catch block — duplicate idempotencyKey is silently ignored
 * (upsert with no-op on conflict).
 *
 * @example
 * try {
 *   await emailService.sendGenericEmail({ to, subject, html })
 * } catch (err) {
 *   console.error('Email failed, queuing retry:', err)
 *   await enqueueNotification({
 *     channel: 'EMAIL',
 *     recipient: to,
 *     subject,
 *     body: html,
 *     idempotencyKey: `booking-confirm-${bookingId}`,
 *     bookingId,
 *   })
 * }
 */
export async function enqueueNotification(params: EnqueueParams): Promise<void> {
  try {
    await (prisma as any).notificationRetry.upsert({
      where: { idempotencyKey: params.idempotencyKey },
      create: {
        channel: params.channel,
        recipient: params.recipient,
        subject: 'subject' in params ? params.subject : null,
        body: params.body,
        idempotencyKey: params.idempotencyKey,
        status: 'PENDING',
        attemptCount: 0,
        maxAttempts: MAX_ATTEMPTS,
        nextAttemptAt: new Date(), // due immediately for first attempt
        bookingId: params.bookingId ?? null,
        userId: params.userId ?? null,
        metadata: params.metadata ?? null,
      },
      update: {
        // Already queued — don't overwrite status/attempts
        // (idempotent: second call is a no-op)
      },
    })
  } catch (err) {
    // Non-fatal: if we can't enqueue, we've already logged the original send failure.
    // Don't throw — the caller shouldn't fail because the queue write failed.
    console.error('[NotificationRetry] enqueueNotification failed:', err)
  }
}

// ── drainRetryQueueAsync ──────────────────────────────────────────────────────

/**
 * Fire-and-forget helper: attempts to process due retry rows immediately,
 * without blocking the calling request.
 *
 * Because Vercel Hobby only allows daily cron jobs, the cron for notification-retry
 * runs once per day. Call this in any booking mutation catch block AFTER enqueuing,
 * so the notification is retried on the very next user-triggered API call rather
 * than waiting up to 24 hours.
 *
 * Usage (non-blocking — does NOT await):
 *   drainRetryQueueAsync()
 *
 * This is safe to call unconditionally — it's idempotent and bounded (max 50 rows).
 */
export function drainRetryQueueAsync(): void {
  // Don't await — let it run in the background after the response is sent
  processRetryQueue().catch((err) =>
    console.error('[NotificationRetry] Background drain failed:', err)
  )
}

interface ProcessResult {
  processed: number
  sent: number
  failed: number
  errors: { id: string; error: string }[]
}

/**
 * Process all PENDING retry rows that are due now.
 * Called by /api/cron/notification-retry.
 *
 * Each row is attempted individually. A single send failure does not abort
 * the rest of the batch.
 */
export async function processRetryQueue(): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, sent: 0, failed: 0, errors: [] }

  const now = new Date()

  // Fetch PENDING rows due for retry — limit 50 per run to bound execution time
  const rows = await (prisma as any).notificationRetry.findMany({
    where: {
      status: 'PENDING',
      nextAttemptAt: { lte: now },
    },
    orderBy: { nextAttemptAt: 'asc' },
    take: 50,
  })

  for (const row of rows) {
    result.processed++

    // Mark as PROCESSING to prevent concurrent runs from picking up the same row
    await (prisma as any).notificationRetry.update({
      where: { id: row.id },
      data: { status: 'PROCESSING', lastAttemptAt: now },
    })

    try {
      if (row.channel === 'EMAIL') {
        await emailService.sendGenericEmail({
          to: row.recipient,
          subject: row.subject ?? '(no subject)',
          html: row.body,
        })
      } else if (row.channel === 'SMS') {
        const success = await smsService.sendSMS({ to: row.recipient, message: row.body })
        if (!success) throw new Error('SMS send returned false (provider error)')
      }

      // Success — mark SENT
      await (prisma as any).notificationRetry.update({
        where: { id: row.id },
        data: {
          status: 'SENT',
          attemptCount: { increment: 1 },
          lastAttemptAt: now,
          lastError: null,
        },
      })

      result.sent++
      console.log(`[NotificationRetry] ✅ Sent ${row.channel} to ${row.recipient} (id=${row.id})`)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      const newAttemptCount = (row.attemptCount ?? 0) + 1
      result.errors.push({ id: row.id, error: errorMessage })

      if (newAttemptCount >= MAX_ATTEMPTS) {
        // Exhausted retries — mark as FAILED for manual review
        await (prisma as any).notificationRetry.update({
          where: { id: row.id },
          data: {
            status: 'FAILED',
            attemptCount: newAttemptCount,
            lastAttemptAt: now,
            lastError: errorMessage,
          },
        })
        result.failed++
        console.error(
          `[NotificationRetry] ❌ FAILED after ${newAttemptCount} attempts — ${row.channel} to ${row.recipient} (id=${row.id}): ${errorMessage}`
        )
      } else {
        // Schedule next attempt with exponential backoff
        const backoffMinutes = BACKOFF_MINUTES[newAttemptCount - 1] ?? 45
        const nextAttemptAt = new Date(now.getTime() + backoffMinutes * 60 * 1000)

        await (prisma as any).notificationRetry.update({
          where: { id: row.id },
          data: {
            status: 'PENDING',
            attemptCount: newAttemptCount,
            lastAttemptAt: now,
            lastError: errorMessage,
            nextAttemptAt,
          },
        })
        console.warn(
          `[NotificationRetry] ⚠️ Attempt ${newAttemptCount}/${MAX_ATTEMPTS} failed — ` +
          `retrying in ${backoffMinutes}min (id=${row.id}): ${errorMessage}`
        )
      }
    }
  }

  return result
}
