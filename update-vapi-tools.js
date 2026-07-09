/**
 * Updates all Vapi tools to point directly at Vercel instead of Railway.
 * Run: node update-vapi-tools.js YOUR_VAPI_PRIVATE_KEY
 */

const https = require('https');

const apiKey = process.argv[2];
if (!apiKey) {
  console.error('Usage: node update-vapi-tools.js YOUR_VAPI_PRIVATE_KEY');
  process.exit(1);
}

const OLD_BASE = 'drivebook-production-12ab.up.railway.app';
const NEW_BASE = 'drivebook-delta.vercel.app';

function vapiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.vapi.ai',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  // Get all tools
  const listResult = await vapiRequest('GET', '/tool?limit=100', null);
  if (listResult.status !== 200) {
    console.error('Failed to list tools:', listResult.body);
    process.exit(1);
  }

  const tools = listResult.body;
  console.log(`Found ${tools.length} tools`);

  let updated = 0;
  let skipped = 0;

  for (const tool of tools) {
    if (!tool.url || !tool.url.includes(OLD_BASE)) {
      skipped++;
      continue;
    }

    const newUrl = tool.url.replace(OLD_BASE, NEW_BASE);
    console.log(`  Updating ${tool.function?.name || tool.id}: ${tool.url} → ${newUrl}`);

    const updateResult = await vapiRequest('PATCH', `/tool/${tool.id}`, { url: newUrl });
    if (updateResult.status === 200) {
      console.log(`  ✅ Updated`);
      updated++;
    } else {
      console.error(`  ❌ Failed:`, JSON.stringify(updateResult.body));
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
}

main().catch(console.error);
