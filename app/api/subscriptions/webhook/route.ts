/**
 * LEGACY WEBHOOK — RETIRED
 *
 * This route is intentionally disabled.
 *
 * All Stripe webhook events are handled exclusively by:
 *   POST /api/stripe/webhook
 *
 * If this URL is still registered in the Stripe dashboard, REMOVE IT to prevent
 * double-processing of events.
 *
 * We return 200 (not 410/404) so Stripe does not retry and spam logs,
 * but we log a critical alert so the misconfiguration is visible.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  console.error(
    '🚨 CRITICAL: Legacy webhook endpoint /api/subscriptions/webhook received a request. ' +
    'This endpoint is RETIRED. Remove this URL from the Stripe dashboard immediately. ' +
    'All events should go to /api/stripe/webhook only.'
  );
  // Return 200 so Stripe does not retry (would create noisy duplicate delivery attempts).
  // The real handler at /api/stripe/webhook will process the same event via its own registration.
  return NextResponse.json({ received: true, warning: 'legacy_endpoint_retired' });
}
