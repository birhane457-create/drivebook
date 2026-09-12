#!/usr/bin/env node
/**
 * build-vapi-prompt.js
 *
 * Reads VAPI_SYSTEM_PROMPT.md, substitutes SUPPORT_PHONE and SUPPORT_EMAIL
 * from environment variables, and writes the result to
 * VAPI_SYSTEM_PROMPT.built.md (git-ignored).
 *
 * Usage:
 *   node scripts/build-vapi-prompt.js
 *   # or via npm:
 *   npm run build:vapi-prompt
 *
 * The built file is what you upload to the VAPI dashboard — never upload
 * the raw .md directly, as it contains placeholder values.
 *
 * Required env vars (from .env or shell):
 *   SUPPORT_PHONE   — e.g. 0488000000
 *   SUPPORT_EMAIL   — e.g. support@drivebook.com.au
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Load .env if present (dev convenience — production uses real env)
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch {
  // dotenv is optional — skip if not installed
}

const SUPPORT_PHONE = process.env.SUPPORT_PHONE;
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL;

if (!SUPPORT_PHONE || !SUPPORT_EMAIL) {
  console.error('❌  SUPPORT_PHONE and SUPPORT_EMAIL must be set in the environment.');
  console.error('    Copy .env.example → .env and fill in the values, or export them in your shell.');
  process.exit(1);
}

const srcPath  = path.join(__dirname, '..', 'VAPI_SYSTEM_PROMPT.md');
const destPath = path.join(__dirname, '..', 'VAPI_SYSTEM_PROMPT.built.md');

let prompt = fs.readFileSync(srcPath, 'utf8');

// Replace the two canonical placeholder values in the SUPPORT CONTACT block
// and in any inline escalation scripts throughout the prompt.
prompt = prompt
  .replace(/0488 000 000/g, SUPPORT_PHONE)
  .replace(/support@drivebook\.com\.au/g, SUPPORT_EMAIL);

fs.writeFileSync(destPath, prompt, 'utf8');

console.log(`✅  Built VAPI prompt → ${destPath}`);
console.log(`    SUPPORT_PHONE : ${SUPPORT_PHONE}`);
console.log(`    SUPPORT_EMAIL : ${SUPPORT_EMAIL}`);
console.log('');
console.log('    Upload VAPI_SYSTEM_PROMPT.built.md to the VAPI dashboard.');
console.log('    Do NOT commit the .built.md file — it is git-ignored.');
