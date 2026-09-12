/**
 * Legacy webhook path — proxies to the canonical Stripe webhook handler.
 *
 * The OpenAPI spec (openapi-webhooks.yaml) documents this path as /api/webhooks/stripe
 * but the real implementation lives at /api/stripe/webhook.
 *
 * This route forwards the raw request body and headers to the canonical handler
 * so both paths work. The canonical handler at /api/stripe/webhook is the source of truth.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Forward the raw body and all headers to the canonical webhook handler
    const body = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const canonicalUrl = new URL('/api/stripe/webhook', req.url);
    const response = await fetch(canonicalUrl.toString(), {
      method: 'POST',
      headers: {
        ...headers,
        'content-type': 'application/json',
      },
      body,
    });

    const responseBody = await response.text();
    return new NextResponse(responseBody, {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook proxy error:', error);
    return NextResponse.json({ error: 'Webhook proxy failed' }, { status: 500 });
  }
}
