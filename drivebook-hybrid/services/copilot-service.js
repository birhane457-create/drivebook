'use strict';

/**
 * copilot-service.js
 *
 * Bridges the voice service to Microsoft Copilot Studio via the Direct Line API.
 *
 * Flow:
 *   1. Start a Direct Line conversation (POST /v3/directline/conversations)
 *   2. Send the assembled system prompt + caller context as the first message
 *   3. Poll for the bot's first response (GET /v3/directline/conversations/:id/activities)
 *   4. Return { type: "say", text: "..." } for Twilio to speak
 *
 * The Direct Line secret is in COPILOT_DIRECT_LINE_SECRET env var.
 * The bot responds with its opening greeting which Twilio speaks to the caller.
 */

const fetch = global.fetch || require('node-fetch');
const config = require('../utils/config');
const logger = require('../utils/logger');
const { buildSystemPrompt } = require('./system-prompt-builder');

const DIRECT_LINE_BASE = 'https://directline.botframework.com/v3/directline';
const POLL_INTERVAL_MS = 1000;   // poll every 1 second
const POLL_MAX_ATTEMPTS = 8;     // max 8 seconds wait for first response

/**
 * Start a Direct Line conversation and return { conversationId, token, streamUrl }
 */
async function startConversation(directLineSecret) {
  const res = await fetch(`${DIRECT_LINE_BASE}/conversations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${directLineSecret}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Direct Line conversation start failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Send a message to the bot in an existing conversation.
 */
async function sendMessage(conversationId, token, text) {
  const res = await fetch(`${DIRECT_LINE_BASE}/conversations/${conversationId}/activities`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'message',
      from: { id: 'voice-service', name: 'DriveBook Voice Service' },
      text,
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Direct Line send message failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Poll for bot activities until we get a message from the bot.
 * Returns the first bot message text, or null if timeout.
 */
async function pollForBotResponse(conversationId, token, afterWatermark = '') {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const url = afterWatermark
      ? `${DIRECT_LINE_BASE}/conversations/${conversationId}/activities?watermark=${afterWatermark}`
      : `${DIRECT_LINE_BASE}/conversations/${conversationId}/activities`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) continue;

    const data = await res.json();
    const botMessages = (data.activities || []).filter(
      a => a.type === 'message' && a.from?.id !== 'voice-service'
    );

    if (botMessages.length > 0) {
      return botMessages[botMessages.length - 1].text || '';
    }

    afterWatermark = data.watermark || afterWatermark;
  }

  return null;
}

/**
 * Main entry point — called by voice-webhook.js on every incoming call.
 *
 * Returns { type: "say", text: "..." } for Twilio to speak,
 * or null if the connection fails (webhook falls back to voicemail).
 */
async function connectToCopilotAgent(instructorId, callerData) {
  const directLineSecret = config.COPILOT_DIRECT_LINE_SECRET || process.env.COPILOT_DIRECT_LINE_SECRET;

  // ── Fallback: no Direct Line secret configured ────────────────────────────
  // If secret not set, fall through to the simple HTTP mode (for non-Copilot Studio agents)
  if (!directLineSecret) {
    return connectToHttpAgent(instructorId, callerData);
  }

  try {
    // Build the system prompt with live instructor context
    let systemPrompt = '';
    try {
      systemPrompt = await buildSystemPrompt(
        instructorId,
        callerData?.callerPhone || null,
        'booking',
        null
      );
    } catch (promptErr) {
      logger.logWarning('Failed to build system prompt', { instructorId, err: promptErr.message });
    }

    logger.logInfo('Starting Direct Line conversation', { instructorId });

    // 1. Start conversation
    const { conversationId, token } = await startConversation(directLineSecret);

    // 2. Send the system prompt + caller context as the first message
    // Copilot Studio receives this and uses it to prime the conversation
    const firstMessage = systemPrompt
      ? `[SYSTEM CONTEXT]\n${systemPrompt}\n\n[CALLER]\nPhone: ${callerData?.callerPhone || 'unknown'}\nBegin the call now with the opening greeting.`
      : `Caller phone: ${callerData?.callerPhone || 'unknown'}. Begin the call with the opening greeting.`;

    await sendMessage(conversationId, token, firstMessage);

    // 3. Poll for the bot's opening greeting
    const botGreeting = await pollForBotResponse(conversationId, token);

    if (!botGreeting) {
      logger.logWarning('No response from Copilot Studio within timeout', { instructorId });
      return null;
    }

    logger.logInfo('Copilot Studio responded', { instructorId, responseLength: botGreeting.length });

    return { type: 'say', text: botGreeting };

  } catch (err) {
    logger.logError(err, { instructorId, context: 'direct-line-connect' });
    return null;
  }
}

/**
 * Fallback for non-Copilot-Studio agents (simple HTTP POST to COPILOT_BASE_URL).
 * Used when COPILOT_DIRECT_LINE_SECRET is not set.
 */
async function connectToHttpAgent(instructorId, callerData) {
  const timeout = config.COPILOT_TIMEOUT_MS || 5000;
  const url = `${config.COPILOT_BASE_URL}/agents/${instructorId}/connect`;

  let systemPrompt = null;
  try {
    systemPrompt = await buildSystemPrompt(instructorId, callerData?.callerPhone || null);
  } catch (promptErr) {
    logger.logWarning('Failed to build system prompt, using agent defaults', {
      instructorId,
      err: promptErr.message,
    });
  }

  try {
    logger.logInfo('Connecting to HTTP Copilot agent', { instructorId, url });
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...callerData,
        systemPrompt: systemPrompt || undefined,
      }),
      signal: AbortSignal.timeout(timeout),
    });

    if (!res.ok) {
      logger.logWarning('HTTP agent returned non-ok', { status: res.status });
      return null;
    }

    const json = await res.json();
    logger.logInfo('HTTP agent response', { instructorId, response: json });
    return json;
  } catch (err) {
    logger.logError(err, { instructorId });
    return null;
  }
}

module.exports = { connectToCopilotAgent };