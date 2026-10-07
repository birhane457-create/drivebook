/**
 * FIX-VERIFIED test for BRAND-V-11
 * Provider.customSlug must have a @unique constraint matching BusinessBranding.customSlug.
 *
 * Tests:
 *   V11-FV-1: schema.prisma has @unique on Provider.customSlug (source)
 *   V11-FV-2: DB confirms Provider_customSlug_key unique index exists (runtime DB)
 *   V11-FV-3: Legacy branding PUT with a taken slug returns HTTP 400 (runtime API)
 *   V11-FV-4: Revert-detection — constraint must exist
 */

import http  from 'http';
import https from 'https';
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config({ path: '.env' });

const BASE   = 'http://localhost:3000';
const EMAIL  = 'birhane157@gmail.com';
const PASS   = 'Test123456!';
const prisma = new PrismaClient();

function req(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const r = lib.request(url, { ...opts, headers: { 'User-Agent': 'fv-v11/1.0', ...opts.headers } }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString(), json() { try { return JSON.parse(this.body); } catch { return null; } } }));
    });
    r.on('error', reject);
    r.setTimeout(15000, () => { r.destroy(); reject(new Error('timeout')); });
    if (opts.body) r.write(opts.body);
    r.end();
  });
}

async function login(email, password) {
  const csrfRes    = await req(`${BASE}/api/auth/csrf`);
  const csrfToken  = JSON.parse(csrfRes.body).csrfToken;
  const csrfCookies = (csrfRes.headers['set-cookie'] ?? []).map(c => c.split(';')[0]).join('; ');
  const body = `csrfToken=${encodeURIComponent(csrfToken)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  const authRes = await req(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), 'Cookie': csrfCookies }, body,
  });
  const sessionRaw = (authRes.headers['set-cookie'] ?? []).find(c => c.includes('session-token'));
  if (!sessionRaw) throw new Error(`Login failed HTTP ${authRes.status}`);
  return sessionRaw.split(';')[0];
}

const results = [];
function record(id, status, evidence, details = {}) {
  results.push({ id, status, evidence, ...details });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`\n${icon}  ${id}: ${status}`);
  console.log(`   Evidence: ${evidence}`);
  if (details.actual) console.log(`   Actual:   ${details.actual}`);
}

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║   FIX-VERIFIED: BRAND-V-11 Provider.customSlug @unique          ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log(`\nStarted: ${new Date().toISOString()}`);

// V11-FV-1: schema.prisma has @unique on Provider.customSlug
const schema = readFileSync('prisma/schema.prisma', 'utf-8');
const providerBlock = schema.substring(schema.indexOf('model Provider {'), schema.indexOf('model Provider {') + 6000);
// Find the actual code line (not comments) containing customSlug with @unique
const slugLine = providerBlock.split('\n').find(l =>
  l.includes('customSlug') && !l.trim().startsWith('//')
);
const schemaHasUnique = slugLine ? slugLine.includes('@unique') : false;
if (schemaHasUnique) {
  record('V11-FV-1', 'PASS', 'schema.prisma: Provider.customSlug has @unique constraint.', { actual: `slugLine="${slugLine?.trim()}"` });
} else {
  record('V11-FV-1', 'FAIL', 'Provider.customSlug does not have @unique in schema.prisma.', { actual: `slugLine="${slugLine?.trim()}"` });
}

// V11-FV-2: DB unique index exists
const idx = await prisma.$queryRawUnsafe(
  "SELECT indexname FROM pg_indexes WHERE tablename='Provider' AND indexname='Provider_customSlug_key'"
).catch(() => []);
const indexExists = Array.isArray(idx) && idx.length > 0;
if (indexExists) {
  record('V11-FV-2', 'PASS', 'DB confirms Provider_customSlug_key unique index exists.', { actual: `indexExists=${indexExists}` });
} else {
  record('V11-FV-2', 'FAIL', 'Provider_customSlug_key unique index NOT found in DB.', { actual: `indexExists=${indexExists}` });
}

// V11-FV-3: API enforces uniqueness — duplicate slug via legacy PUT returns 400
const session = await login(EMAIL, PASS);
const TS = Date.now();
const slug = `v11fv-${TS}`.substring(0, 30);

// Create a dummy provider with the slug directly in DB
const dummyUId = `v11fv-u-${TS}`;
const dummyPId = `v11fv-p-${TS}`;
await prisma.user.create({ data: { id: dummyUId, email: `v11fv-${TS}@audit.test`, name: 'V11 FV Dummy', role: 'provider', emailVerified: true } });
await prisma.provider.create({ data: { id: dummyPId, userId: dummyUId, name: 'V11 FV Dummy', phone: '+61400000055', hourlyRate: 50, customSlug: slug, subscriptionTier: 'PRO', subscriptionStatus: 'ACTIVE' } });
console.log(`   Seeded dummy provider with customSlug="${slug}"`);

// Try to set same slug on main provider via legacy PUT
const body1 = JSON.stringify({ customSlug: slug });
const res1 = await req(`${BASE}/api/instructor/branding`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body1), 'Cookie': session }, body: body1,
});
const d1 = res1.json();
console.log(`   Legacy PUT with duplicate slug: HTTP ${res1.status} error="${d1?.error}"`);

if (res1.status === 400 && d1?.error?.toLowerCase().includes('taken')) {
  record('V11-FV-3', 'PASS', 'Legacy branding PUT returns HTTP 400 "taken" when slug already owned.', { actual: `HTTP ${res1.status} error="${d1.error}"` });
} else if (res1.status === 400) {
  record('V11-FV-3', 'PASS', `Legacy PUT returned HTTP 400 — slug conflict enforced.`, { actual: `HTTP ${res1.status} body=${res1.body.substring(0, 100)}` });
} else {
  record('V11-FV-3', 'FAIL', `Expected HTTP 400 for duplicate slug. Got ${res1.status}.`, { actual: `HTTP ${res1.status} body=${res1.body.substring(0, 200)}` });
}

// V11-FV-4: Revert-detection — schema must still have @unique
if (schemaHasUnique && indexExists) {
  record('V11-FV-4', 'PASS', 'Revert-detection: @unique in schema and index in DB both confirmed. Fix is stable.', { actual: `schemaUnique=${schemaHasUnique} dbIndex=${indexExists}` });
} else {
  record('V11-FV-4', 'FAIL', 'Revert-detection: @unique or DB index missing.', { actual: `schemaUnique=${schemaHasUnique} dbIndex=${indexExists}` });
}

// Cleanup
await prisma.provider.delete({ where: { id: dummyPId } }).catch(() => {});
await prisma.user.delete({ where: { id: dummyUId } }).catch(() => {});

console.log('\n' + '═'.repeat(68));
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
console.log(`  FIX-VERIFIED V-11: ${passed} PASS / ${failed} FAIL`);
results.forEach(r => console.log(`  ${r.status === 'PASS' ? '✅' : '❌'}  ${r.id}: ${r.evidence.substring(0, 100)}`));
console.log('═'.repeat(68));
console.log(`\nCompleted: ${new Date().toISOString()}`);
await prisma.$disconnect();
process.exit(failed > 0 ? 1 : 0);
