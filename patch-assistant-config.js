'use strict';
/**
 * patch-assistant-config.js
 * 
 * Patches the live VAPI assistant to add:
 *   - serverUrl (Railway hybrid endpoint)
 *   - serverUrlSecret (x-vapi-secret for auth)
 *   - silenceTimeoutSeconds: 55
 * 
 * Does NOT touch tools, voice, transcriber, or system prompt.
 * 
 * Usage: node patch-assistant-config.js
 */
const https = require('https');

const API_KEY       = 'f0b85cb8-acf6-4717-95d4-d9af01d1af42';
const ASSISTANT_ID  = 'a97b2303-b75c-4764-abb8-28e13e0416b9';
const BASE_URL      = 'drivebook-production-12ab.up.railway.app';
const WEBHOOK_SECRET = '194cad50a0fe4bd22dbfad9940abc8dea55b2058bd52c42d59cb0be9e76b560c';

function patch(body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: 'api.vapi.ai',
      path: '/assistant/' + ASSISTANT_ID,
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer ' + API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('Patching assistant: ' + ASSISTANT_ID);
  console.log('Adding: serverUrl, serverUrlSecret, silenceTimeoutSeconds=55');

  const result = await patch({
    serverUrl: 'https://' + BASE_URL,
    serverUrlSecret: WEBHOOK_SECRET,
    silenceTimeoutSeconds: 55,
  });

  if (result.status === 200) {
    console.log('\nDone.');
    console.log('  serverUrl:             https://' + BASE_URL);
    console.log('  serverUrlSecret:       SET');
    console.log('  silenceTimeoutSeconds: 55');
    console.log('  Tools:                 unchanged');
    console.log('  Voice:                 unchanged');
    console.log('  Prompt:                unchanged');
  } else {
    console.error('Failed (' + result.status + '):');
    console.error(JSON.stringify(result.body, null, 2));
    process.exit(1);
  }
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
