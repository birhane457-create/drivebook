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
 * Throttle: same alert type + entityId won't fire more than once per hour.
 * Throttle state is in-memory — resets on cold start. Good enough for v1.
 */

import { emailService } from '@/lib/services/email';

export type AlertType =
  | 'NEGATIVE_BALANCE'
  | 'PAYOUT_FAILED'
  | 'ABN_REVOKED'
  | 'RECONCILIATION_ISSUES';

export type AlertSeverity = 'CRITICAL' | 'WARNING';

export interface AlertPayload {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  entityId?: string;          // payoutId, instructorId, etc. — used for throttle key
  metadata?: Record<string, unknown>;
}

// ── In-memory throttle ────────────────────────────────────────────────────────
// key: `${type}:${entityId}` → last sent timestamp
const throttleCache = new Map<string, number>();
const THROTTLE_MS = 60 * 60 * 1000; // 1 hour

function isThrottled(type: AlertType, entityId?: string): boolean {
  const key = `${type}:${entityId ?? 'global'}`;
  const last = throttleCache.get(key);
  if (!last) return false;
  return Date.now() - last < THROTTLE_MS;
}

function markSent(type: AlertType, entityId?: string) {
  const key = `${type}:${entityId ?? 'global'}`;
  throttleCache.set(key, Date.now());
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
  if (!adminEmail) {
    console.warn(`[ALERT] ADMIN_EMAIL not set — alert not sent: ${payload.type} ${payload.message}`);
    return;
  }

  if (isThrottled(payload.type, payload.entityId)) {
    console.log(`[ALERT] Throttled (${payload.type}:${payload.entityId ?? 'global'}) — skipping duplicate`);
    return;
  }

  try {
    const subject = `[${payload.severity}] DriveBook: ${payload.message}`;
    const html = buildEmailHtml(payload);

    await emailService.sendGenericEmail({ to: adminEmail, subject, html });
    markSent(payload.type, payload.entityId);

    console.log(`[ALERT SENT] ${payload.severity} ${payload.type} → ${adminEmail}`);
  } catch (err) {
    // Never throw — alert failure must not block core flows
    console.error(`[ALERT FAILED] Could not send alert ${payload.type}:`, err);
  }
}
