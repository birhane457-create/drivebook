// app/api/webhooks/whatsapp/route.ts
//
// WhatsApp Business API webhook endpoint.
//
// Meta sends:
//   GET  — webhook verification (returns hub.challenge if verify token matches)
//   POST — incoming messages and status updates
//
// Required env vars:
//   WHATSAPP_WEBHOOK_VERIFY_TOKEN  — the verify token you set in Meta dashboard
//   WHATSAPP_APP_SECRET             — used to verify the X-Hub-Signature-256 header
//   (optional but recommended for production)

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// ── GET: Webhook verification ─────────────────────────────────────────────────
//
// When you first set up the webhook in the Meta Developer dashboard, Meta sends
// a GET request with:
//   hub.mode          = "subscribe"
//   hub.verify_token  = the token you configured
//   hub.challenge     = a random string to echo back
//
// We verify the token matches and return the challenge as plain text.

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode')
  const token = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  // Support both env var names for compatibility
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

  if (!expectedToken) {
    logger.error('[WhatsApp Webhook] WHATSAPP_VERIFY_TOKEN not set in env')
    return new NextResponse('Verify token not configured', { status: 500 })
  }

  if (mode === 'subscribe' && token === expectedToken) {
    logger.info('[WhatsApp Webhook] Verification successful')
    // Must return the challenge as plain text, 200 OK
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  logger.warn('[WhatsApp Webhook] Verification failed', { mode, tokenProvided: !!token })
  return new NextResponse('Forbidden', { status: 403 })
}

// ── POST: Incoming messages & status updates ──────────────────────────────────
//
// Meta sends POST requests when:
//   - A user sends a message to your WhatsApp Business number
//   - A message status changes (sent, delivered, read)
//
// Payload structure (simplified):
//   {
//     "object": "whatsapp_business_account",
//     "entry": [{
//       "id": "...",
//       "changes": [{
//         "value": {
//           "messaging_product": "whatsapp",
//           "metadata": { "phone_number_id": "...", "display_phone_number": "..." },
//           "messages": [{ "from": "61...", "id": "wamid...", "type": "text", "text": { "body": "..." } }],
//           "statuses": [{ "id": "wamid...", "status": "delivered", ... }]
//         },
//         "field": "messages"
//       }]
//     }]
//   }

export async function POST(req: NextRequest) {
  try {
    // ── Signature verification (if app secret is configured) ─────────────────
    const appSecret = process.env.WHATSAPP_APP_SECRET
    if (appSecret) {
      const signature = req.headers.get('x-hub-signature-256') || ''
      const body = await req.text()

      const expectedSig = 'sha256=' + crypto
        .createHmac('sha256', appSecret)
        .update(body)
        .digest('hex')

      if (!crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSig)
      )) {
        logger.warn('[WhatsApp Webhook] Invalid signature — rejecting')
        return new NextResponse('Unauthorized', { status: 401 })
      }

      // Parse the verified body
      const payload = JSON.parse(body)
      return handleWebhookPayload(payload)
    }

    // No app secret configured — accept without signature check (dev/testing)
    const payload = await req.json()
    return handleWebhookPayload(payload)

  } catch (error) {
    logger.error('[WhatsApp Webhook] POST error:', {
      error: error instanceof Error ? error.message : String(error),
    })
    // Always return 200 to prevent Meta from retrying endlessly
    return new NextResponse('OK', { status: 200 })
  }
}

// ── Webhook payload handler ───────────────────────────────────────────────────

function handleWebhookPayload(payload: any): NextResponse {
  if (payload?.object !== 'whatsapp_business_account') {
    return new NextResponse('OK', { status: 200 })
  }

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue

      const value = change.value

      // ── Incoming messages ─────────────────────────────────────────────────
      if (value.messages?.length) {
        for (const msg of value.messages) {
          handleIncomingMessage(msg, value.metadata, value.contacts)
        }
      }

      // ── Status updates (sent, delivered, read) ────────────────────────────
      if (value.statuses?.length) {
        for (const status of value.statuses) {
          logger.info('[WhatsApp Webhook] Status update', {
            messageId: status.id,
            status: status.status,
            recipient: status.recipient_id,
            timestamp: status.timestamp,
          })
          // TODO: Update message delivery status in DB if tracking messages
        }
      }
    }
  }

  // Always return 200 — Meta retries if it gets anything else
  return new NextResponse('OK', { status: 200 })
}

// ── Message handler ───────────────────────────────────────────────────────────

function handleIncomingMessage(
  msg: any,
  metadata: any,
  contacts: any[]
) {
  const from = msg.from  // phone number (e.g. "61412345678")
  const msgId = msg.id   // wamid.*
  const type = msg.type   // "text", "image", "audio", "button", etc.
  const timestamp = msg.timestamp

  // Resolve contact name if available
  const contact = contacts?.find((c: any) => c.wa_id === from)
  const senderName = contact?.profile?.name || from

  let textBody = ''
  if (type === 'text') {
    textBody = msg.text?.body || ''
  } else if (type === 'button') {
    textBody = msg.button?.text || msg.button?.payload || ''
  } else if (type === 'interactive') {
    textBody = msg.interactive?.button_reply?.title
      || msg.interactive?.list_reply?.title
      || ''
  }

  logger.info('[WhatsApp Webhook] Incoming message', {
    from,
    senderName,
    msgId,
    type,
    text: textBody,
    timestamp,
  })

  // TODO: Route the message to your handling logic:
  //   - Look up the sender in the DB (by phone number)
  //   - If they're a client → handle booking enquiry, reply via WhatsApp API
  //   - If unknown → send welcome / booking link
  //   - Could also forward to the AI voice assistant for NLP processing
}
