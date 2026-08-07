/**
 * EmailContext — the single object passed to sendEmail().
 *
 * Routes declare what event is happening.
 * resolveSender() turns that into the correct From address.
 *
 * Resolution order:
 *   1. Explicit `from` string        — escape hatch, white-label override
 *   2. Event registry default        — normal path via EMAIL_EVENTS
 *   3. 'support' fallback            — safety net
 *
 * Future — BUSINESS tier white-label:
 *   When a school account with a verified custom domain is introduced,
 *   add a `schoolId` to the branding block and resolve branding from
 *   the DB here. The resolution chain above naturally accommodates it
 *   between steps 1 and 2 without changing any call sites.
 *
 *   Example future shape:
 *     branding?: { schoolId: string }
 *   resolveSender would then do a DB lookup for the school's name/domain
 *   and return e.g. "Perth Drive Academy <bookings@perthdrive.com.au>".
 *   The instructorId is intentionally NOT passed here — branding is a
 *   school-level (BUSINESS tier) concern, not an individual instructor concern.
 */

import { EMAIL_EVENTS, type EmailEvent } from './registry'
import { SENDERS, formatSender, type SenderKey } from './senders'

export interface EmailContext {
  /**
   * The platform event being sent.
   * Determines sender, replyTo, category, and (future) template automatically.
   */
  event?: EmailEvent

  /**
   * Explicit From override — escape hatch.
   * Use only when the event registry default is insufficient
   * (e.g. transactional emails from a verified custom domain in the future).
   * Always wins over event default.
   */
  from?: string
}

/**
 * Resolves the final From address for an outgoing email.
 * Synchronous — no DB calls at this tier.
 */
export function resolveSender(ctx: EmailContext): string {
  if (ctx.from) return ctx.from
  if (ctx.event) return formatSender(EMAIL_EVENTS[ctx.event].sender)
  return formatSender('support')
}

/**
 * Resolves the Reply-To address from the event registry.
 * Returns undefined if the event has no replyTo configured.
 */
export function resolveReplyTo(ctx: EmailContext): string | undefined {
  if (!ctx.event) return undefined
  const cfg = EMAIL_EVENTS[ctx.event] as { sender: SenderKey; replyTo?: SenderKey; id: string; category: string }
  return cfg.replyTo ? SENDERS[cfg.replyTo].email : undefined
}
