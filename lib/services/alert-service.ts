/**
 * Alert Service
 *
 * Sends operational alerts to ADMIN_EMAIL when critical financial events occur.
 * Never throws — alert failure must never block payouts, refunds, or other core flows.
 *
 * Alert types:
 *   NEGATIVE_BALANCE      — platform balance went negative (CRITICAL)
 *   PAYOUT_FAILED         — executePayout() returned FAILED (CRITICAL)
 *   ABN_REVOKED           — weekly cron revoked an instructor's ABN (CRITICAL)
 *   RECONCILIATION_ISSUES — daily cron found missing payments/transfers or stuck payouts (WARNING)
 *
 * FIX #15: Webhook alerting — set ALERT_WEBHOOK_URL to receive alerts in Slack, Discord,
 *   or any webhook endpoint (e.g. PagerDuty) alongside the email.
 *
 * FIX #11: Throttle state persisted in DB (SystemFlag) so it survives cold starts.
 *   Falls back to in-memory if DB write fails — never blocks the alert itself.
 */

import { emailService } from '@/lib/services/email';
import { prisma } from '@/lib/prisma';

export type AlertType =
  | 'NEGATIVE_BALANCE'
  | 'PAYOUT_FAILED'
  | 'ABN_REVOKED'
  | 'RECONCILIATION_ISSUES'
  | 'DISPUTE_OPENED'          // Sprint A: chargeback filed
  | 'DISPUTE_WON'             // Sprint A: chargeback won — liability cleared
  | 'DISPUTE_LOST'            // Sprint A: chargeback confirmed — cash loss
  | 'DISPUTE_EVIDENCE_NEEDED' // Sprint A: manual evidence submission required
  | 'REFUND_SYNCED'           // Sprint B: out-of-band refund detected
  | 'TRANSFER_FAILED'         // Sprint C: Stripe Connect transfer failed
  | 'BOOKING_AUTO_NO_SHOW';   // cleanup cron auto-no-show alert

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'HIGH' | 'LOW';

export interface AlertPayload {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  entityId?: string;          // payoutId, instructorId, etc. — used for throttle key
  metadata?: Record<string, unknown>;
}

// ── In-memory fallback throttle (used if DB throttle fails) ──────────────────
const memThrottleCache = new Map<string, number>();
const THROTTLE_MS = 60 * 60 * 1000; // 1 hour

// ── DB-persisted throttle ─────────────────────────────────────────────────────
// FIX #11: Throttle state was in-memory and reset on every cold start.
// Cron invocations on Vercel always cold-start — the throttle was meaningless.
// Now we persist last-sent timestamps in the DB via AuditLog metadata lookup,
// with an in-memory fallback if the DB write fails.

async function isThrottledDb(key: string): Promise<boolean> {
  try {
    const cutoff = new Date(Date.now() - THROTTLE_MS);
    const recent = await (prisma as any).auditLog.findFirst({
      where: {
        action: 'ALERT_SENT',
        targetId: key,
        createdAt: { gte: cutoff },
      },
      orderBy: { createdAt: 'desc' },
    });
    return !!recent;
  } catch {
    // DB unavailable — fall back to in-memory
    const last = memThrottleCache.get(key);
    if (!last) return false;
    return Date.now() - last < THROTTLE_MS;
  }
}

async function markSentDb(type: AlertType, entityId?: string): Promise<void> {
  const key = `${type}:${entityId ?? 'global'}`;
  // Persist to DB
  try {
    await (prisma as any).auditLog.create({
      data: {
        action: 'ALERT_SENT',
        actorId: 'SYSTEM',
        actorRole: 'SYSTEM',
        targetType: 'ALERT',
        targetId: key,
        success: true,
        metadata: { alertType: type, entityId: entityId ?? null },
      },
    });
  } catch {
    // Fallback — in-memory
    memThrottleCache.set(key, Date.now());
  }
}

// ── Webhook delivery ──────────────────────────────────────────────────────────
// FIX #15: Post to ALERT_WEBHOOK_URL (Slack, Discord, PagerDuty, etc.)
// Compatible with Slack Incoming Webhooks format out of the box.

async function sendWebhook(payload: AlertPayload): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  const icon = payload.severity === 'CRITICAL' ? '🚨' : '⚠️';
  const text = `${icon} *[${payload.severity}] DriveBook: ${payload.type.replace(/_/g, ' ')}*\n${payload.message}${payload.entityId ? `\nEntity: \`${payload.entityId}\`` : ''}`;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error('[ALERT WEBHOOK FAILED]', err);
    // Never throw — webhook failure must not block core flows
  }
}

// ── Format helpers ────────────────────────────────────────────────────────────

function formatTimestamp(): string {
  return new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Perth',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) + ' AWST';
}

function buildEmailHtml(payload: AlertPayload): string {
  const severityColor = payload.severity === 'CRITICAL' ? '#dc2626' : '#d97706';
  const severityBg = payload.severity === 'CRITICAL' ? '#fef2f2' : '#fffbeb';
  const actionRequired = payload.severity === 'CRITICAL' ? 'Yes — immediate review required' : 'Yes — review at next opportunity';

  const metaRows = payload.metadata
    ? Object.entries(payload.metadata)
        .map(([k, v]) => `<tr><td style="padding:4px 8px;color:#6b7280;font-size:13px;">${k}</td><td style="padding:4px 8px;font-size:13px;font-weight:600;">${JSON.stringify(v)}</td></tr>`)
        .join('')
    : '';

  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
      <div style="background:${severityBg};border-left:4px solid ${severityColor};padding:16px 20px;margin-bottom:20px;">
        <p style="margin:0;font-size:12px;font-weight:700;color:${severityColor};text-transform:uppercase;letter-spacing:0.05em;">${payload.severity}</p>
        <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#111827;">${payload.type.replace(/_/g, ' ')}</p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="padding:4px 8px;color:#6b7280;font-size:13px;">Time</td><td style="padding:4px 8px;font-size:13px;font-weight:600;">${formatTimestamp()}</td></tr>
        <tr><td style="padding:4px 8px;color:#6b7280;font-size:13px;">Message</td><td style="padding:4px 8px;font-size:13px;font-weight:600;">${payload.message}</td></tr>
        ${payload.entityId ? `<tr><td style="padding:4px 8px;color:#6b7280;font-size:13px;">Entity ID</td><td style="padding:4px 8px;font-size:13px;font-weight:600;font-family:monospace;">${payload.entityId}</td></tr>` : ''}
        ${metaRows}
        <tr><td style="padding:4px 8px;color:#6b7280;font-size:13px;">Action required</td><td style="padding:4px 8px;font-size:13px;font-weight:600;color:${severityColor};">${actionRequired}</td></tr>
      </table>

      <p style="font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;">
        DriveBook automated alert · <a href="${process.env.NEXTAUTH_URL}/admin/payouts" style="color:#3b82f6;">Open Admin</a>
      </p>
    </div>
  `;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function sendAlert(payload: AlertPayload): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const key = `${payload.type}:${payload.entityId ?? 'global'}`;

  if (!adminEmail && !process.env.ALERT_WEBHOOK_URL) {
    console.warn(`[ALERT] Neither ADMIN_EMAIL nor ALERT_WEBHOOK_URL set — alert not sent: ${payload.type} ${payload.message}`);
    return;
  }

  // FIX #11: Check DB-persisted throttle (survives cold starts)
  if (await isThrottledDb(key)) {
    console.log(`[ALERT] Throttled (${key}) — skipping duplicate`);
    return;
  }

  try {
    // Send email if configured
    if (adminEmail) {
      const subject = `[${payload.severity}] DriveBook: ${payload.message}`;
      const html = buildEmailHtml(payload);
      await emailService.sendGenericEmail({ to: adminEmail, subject, html });
    }

    // FIX #15: Send to webhook (Slack / Discord / PagerDuty) if configured
    await sendWebhook(payload);

    // Persist throttle state to DB
    await markSentDb(payload.type, payload.entityId);

    console.log(`[ALERT SENT] ${payload.severity} ${payload.type}${adminEmail ? ` → ${adminEmail}` : ''}${process.env.ALERT_WEBHOOK_URL ? ' + webhook' : ''}`);
  } catch (err) {
    // Never throw — alert failure must not block core flows
    console.error(`[ALERT FAILED] Could not send alert ${payload.type}:`, err);
  }
}
