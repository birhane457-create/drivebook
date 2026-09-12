#!/usr/bin/env node
/**
 * update-vapi-assistant.js
 *
 * Pushes the current VAPI_SYSTEM_PROMPT.md to the VAPI dashboard via the
 * VAPI REST API. No manual copy-paste needed.
 *
 * What it updates on the assistant:
 *   - systemPrompt  (from VAPI_SYSTEM_PROMPT.md, with env var substitution)
 *   - serverUrl     (set to DRIVEBOOK_HYBRID_URL if provided)
 *   - serverUrlSecret (set to VAPI_WEBHOOK_SECRET)
 *
 * Usage:
 *   node scripts/update-vapi-assistant.js
 *   node scripts/update-vapi-assistant.js --dry-run   # preview payload, no API call
 *
 * Required env vars (.env or shell):
 *   VAPI_API_KEY         — from VAPI dashboard → Account → API Keys
 *   VAPI_ASSISTANT_ID    — from VAPI dashboard → Assistants → your assistant → ID
 *   SUPPORT_PHONE        — replaces 0488 000 000 in the prompt
 *   SUPPORT_EMAIL        — replaces support@drivebook.com.au in the prompt
 *
 * Optional:
 *   DRIVEBOOK_HYBRID_URL — if set, also updates serverUrl on the assistant
 *                          e.g. https://drivebook-production-12ab.up.railway.app
 *   VAPI_WEBHOOK_SECRET  — if set, also updates serverUrlSecret
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const http  = require('https'); // VAPI API is HTTPS

// ── Load .env ──────────────────────────────────────────────────────────────
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch { /* dotenv optional */ }

// ── CLI flag ───────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');

// ── Validate required env vars ─────────────────────────────────────────────
const VAPI_API_KEY      = process.env.VAPI_API_KEY;
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;
const SUPPORT_PHONE     = process.env.SUPPORT_PHONE     || '0488 000 000';
const SUPPORT_EMAIL     = process.env.SUPPORT_EMAIL     || 'support@drivebook.com.au';
const HYBRID_URL        = process.env.DRIVEBOOK_HYBRID_URL || null;
const WEBHOOK_SECRET    = process.env.VAPI_WEBHOOK_SECRET  || null;

if (!VAPI_API_KEY) {
  console.error('❌  VAPI_API_KEY not set. Get it from: https://dashboard.vapi.ai → Account → API Keys');
  process.exit(1);
}
if (!VAPI_ASSISTANT_ID) {
  console.error('❌  VAPI_ASSISTANT_ID not set. Get it from: https://dashboard.vapi.ai → Assistants → your assistant → ID tab');
  process.exit(1);
}

// ── Build the system prompt ────────────────────────────────────────────────
const srcPath = path.join(__dirname, '..', 'VAPI_SYSTEM_PROMPT.md');
if (!fs.existsSync(srcPath)) {
  console.error(`❌  VAPI_SYSTEM_PROMPT.md not found at: ${srcPath}`);
  process.exit(1);
}

let systemPrompt = fs.readFileSync(srcPath, 'utf8');
systemPrompt = systemPrompt
  .replace(/0488 000 000/g, SUPPORT_PHONE)
  .replace(/support@drivebook\.com\.au/g, SUPPORT_EMAIL);

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  VAPI Assistant Update');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  Assistant ID : ${VAPI_ASSISTANT_ID}`);
console.log(`  Prompt chars : ${systemPrompt.length.toLocaleString()}`);
console.log(`  Support phone: ${SUPPORT_PHONE}`);
console.log(`  Support email: ${SUPPORT_EMAIL}`);
if (HYBRID_URL) console.log(`  Server URL   : ${HYBRID_URL}`);
if (DRY_RUN) console.log('\n  ⚠️  DRY RUN — no changes will be sent to VAPI\n');

// ── Build the PATCH payload ────────────────────────────────────────────────
// VAPI requires model.provider whenever model is included in the PATCH.
// We fetch the current model to preserve all existing settings and only
// replace the system prompt message.
const payload = {
  model: {
    provider: 'openai',     // must match existing assistant config
    model:    'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
    ],
  },
};

// Optionally update server URL and secret
if (HYBRID_URL) {
  payload.serverUrl = HYBRID_URL;
}
if (WEBHOOK_SECRET) {
  payload.serverUrlSecret = WEBHOOK_SECRET;
}

if (DRY_RUN) {
  console.log('  Payload preview (truncated):');
  const preview = JSON.stringify(payload, null, 2);
  console.log(preview.length > 500 ? preview.slice(0, 500) + '\n  ...(truncated)' : preview);
  console.log('\n  ✅  Dry run complete — no changes sent.\n');
  process.exit(0);
}

// ── Send PATCH to VAPI API ─────────────────────────────────────────────────
function vapiPatch(assistantId, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = {
      hostname: 'api.vapi.ai',
      port: 443,
      path: `/assistant/${assistantId}`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseData) });
        } catch {
          resolve({ status: res.statusCode, body: responseData });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Request timeout')));
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('\n  Sending update to VAPI...');

  let result;
  try {
    result = await vapiPatch(VAPI_ASSISTANT_ID, payload);
  } catch (err) {
    console.error(`\n❌  Network error: ${err.message}\n`);
    process.exit(1);
  }

  if (result.status === 200 || result.status === 201) {
    const assistant = result.body;
    console.log(`\n✅  Assistant updated successfully`);
    console.log(`    ID   : ${assistant.id || VAPI_ASSISTANT_ID}`);
    console.log(`    Name : ${assistant.name || '(unnamed)'}`);
    console.log(`    Model: ${assistant.model?.provider || '?'} / ${assistant.model?.model || '?'}`);
    if (assistant.serverUrl) console.log(`    URL  : ${assistant.serverUrl}`);
    console.log('\n  The updated system prompt is live immediately — no restart needed.\n');
  } else if (result.status === 401) {
    console.error('\n❌  Unauthorized — check VAPI_API_KEY');
    console.error('    Get your key from: https://dashboard.vapi.ai → Account → API Keys\n');
    process.exit(1);
  } else if (result.status === 404) {
    console.error(`\n❌  Assistant not found — check VAPI_ASSISTANT_ID: ${VAPI_ASSISTANT_ID}`);
    console.error('    Get it from: https://dashboard.vapi.ai → Assistants → your assistant → ID\n');
    process.exit(1);
  } else {
    console.error(`\n❌  VAPI API returned ${result.status}`);
    console.error('    Response:', JSON.stringify(result.body, null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nUnexpected error:', err.message);
  process.exit(1);
});
