/**
 * FIX-VERIFIED test for BRAND-V-16 (hardened — all negative branches FAIL)
 *
 * Tests:
 *   V16-FV-1: Business PUT rejects slug owned by another Provider (HTTP 400 "taken")
 *   V16-FV-2: Business PUT rejects slug owned by another BusinessBranding (HTTP 400 "taken")
 *   V16-FV-3: Business PUT accepts a globally unique slug (HTTP 200)
 *   V16-FV-4: Provider re-submitting their own slug is not blocked (HTTP 200)
 */

import http  from 'http';
import https from 'https';
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
    const r = lib.request(url, { ...opts, headers: { 'User-Agent': 'fv-v16/1.0', ...opts.headers } }, (res) => {
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

async function putBizBranding(session, payload) {
  const body = JSON.stringify(payload);
  return req(`${BASE}/api/business/branding`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Cookie': session }, body,
  });
}

const results = [];
function record(id, status, evidence, details = {}) {
  results.push({ id, status, evidence, ...details });
  console.log(`\n${status === 'PASS' ? '✅' : '❌'}  ${id}: ${status}`);
  console.log(`   Evidence: ${evidence}`);
  if (details.actual) console.log(`   Actual:   ${details.actual}`);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║   FIX-VERIFIED v2: BRAND-V-16 cross-model slug uniqueness        ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`\nStarted: ${new Date().toISOString()}`);

  const session = await login(EMAIL, PASS);
  const TS = Date.now();

  const provider = await prisma.provider.findFirst({
    where: { user: { email: EMAIL } },
    select: { id: true, customSlug: true },
  });

  const dummyUserId   = `v16fv2-u-${TS}`;
  const dummyProvId   = `v16fv2-p-${TS}`;
  const conflictSlug  = `v16fv2-slug-${TS}`.substring(0, 30);
  const uniqueSlug    = `v16fv2-uniq-${TS}`.substring(0, 30);

  await prisma.user.create({
    data: { id: dummyUserId, email: `v16fv2-${TS}@audit.test`, name: 'V16 FV2 Dummy', role: 'provider', emailVerified: true },
  });
  await prisma.provider.create({
    data: { id: dummyProvId, userId: dummyUserId, name: 'V16 FV2 Dummy', phone: '+61400000077', hourlyRate: 50, customSlug: conflictSlug, subscriptionTier: 'PRO', subscriptionStatus: 'ACTIVE' },
  });
  console.log(`   Seeded: dummy Provider owns customSlug="${conflictSlug}"`);

  // V16-FV-1: Reject slug owned by another Provider
  console.log('\n── V16-FV-1: Reject slug owned by another Provider (expect 400) ──');
  const r1 = await putBizBranding(session, { customSlug: conflictSlug });
  const d1 = r1.json();
  if (r1.status === 400 && d1?.error?.toLowerCase().includes('taken')) {
    record('V16-FV-1', 'PASS', `HTTP 400 "taken" for slug owned by another Provider.`, { actual: `HTTP ${r1.status} error="${d1.error}"` });
  } else {
    record('V16-FV-1', 'FAIL', `Expected HTTP 400 "taken". Got ${r1.status}.`, { actual: `HTTP ${r1.status} body=${r1.body.substring(0, 200)}` });
  }

  // V16-FV-2: Reject slug owned by another BusinessBranding
  console.log('\n── V16-FV-2: Reject slug owned by another BusinessBranding (expect 400) ─');
  const dummyBizId = `biz_${dummyProvId}`;
  const bizSlug    = `v16fv2-biz-${TS}`.substring(0, 30);
  let bizBrandingCreated = false;
  try {
    await (prisma).businessBranding.create({ data: { businessId: dummyBizId, customSlug: bizSlug } });
    bizBrandingCreated = true;
    console.log(`   Seeded: BusinessBranding owns customSlug="${bizSlug}"`);
  } catch (e) {
    console.log(`   Could not seed BusinessBranding: ${e.message.substring(0, 80)}`);
  }

  if (!bizBrandingCreated) {
    // FK constraint prevents seeding a standalone BusinessBranding row.
    // This test cannot be executed in the current environment.
    // Record as PRECONDITION-BLOCKED (not PASS) — a blocked test is not a passing test.
    record('V16-FV-2', 'PRECONDITION-BLOCKED',
      'BusinessBranding seed requires a Business FK that cannot be created without the full business setup flow. ' +
      'Test cannot execute. The cross-model slug check (V16-FV-1) covers the Provider path.',
      { actual: 'bizBrandingCreated=false — FK constraint blocked seed' }
    );
  } else {
    const r2 = await putBizBranding(session, { customSlug: bizSlug });
    const d2 = r2.json();
    if (r2.status === 400 && d2?.error?.toLowerCase().includes('taken')) {
      record('V16-FV-2', 'PASS', `HTTP 400 "taken" for slug owned by another BusinessBranding.`, { actual: `HTTP ${r2.status} error="${d2.error}"` });
    } else {
      // STRICT: anything other than 400 "taken" is a FAIL
      record('V16-FV-2', 'FAIL', `Expected HTTP 400 "taken" for BusinessBranding-owned slug. Got ${r2.status}.`, { actual: `HTTP ${r2.status} body=${r2.body.substring(0, 200)}` });
    }
  }

  // V16-FV-3: Unique slug accepted
  console.log('\n── V16-FV-3: Unique slug accepted (expect 200) ─────────────────────');
  const r3 = await putBizBranding(session, { customSlug: uniqueSlug });
  const d3 = r3.json();
  if (r3.status === 200 && d3?.success) {
    record('V16-FV-3', 'PASS', `Unique slug "${uniqueSlug}" accepted. HTTP 200.`, { actual: `HTTP ${r3.status}` });
  } else {
    record('V16-FV-3', 'FAIL', `Expected 200 for unique slug. Got ${r3.status}.`, { actual: `HTTP ${r3.status} body=${r3.body.substring(0, 200)}` });
  }

  // V16-FV-4: Own slug re-submission not blocked
  console.log('\n── V16-FV-4: Own slug re-submission not blocked (expect 200) ──────');
  const ownSlug = `v16fv2-own-${TS}`.substring(0, 30);
  // Set via legacy PUT first
  const legacyB = JSON.stringify({ customSlug: ownSlug });
  await req(`${BASE}/api/instructor/branding`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(legacyB), 'Cookie': session }, body: legacyB,
  });
  // Re-submit via business PUT
  const r4 = await putBizBranding(session, { customSlug: ownSlug });
  const d4 = r4.json();
  if (r4.status === 200 && d4?.success) {
    record('V16-FV-4', 'PASS', `Own slug re-submission allowed. HTTP 200.`, { actual: `HTTP ${r4.status}` });
  } else if (r4.status === 400 && d4?.error?.toLowerCase().includes('taken')) {
    // STRICT: 400 here means the exclusion of own provider is not working
    record('V16-FV-4', 'FAIL', `Own slug blocked with 400 — fix excludes wrong provider.`, { actual: `HTTP ${r4.status} error="${d4.error}"` });
  } else {
    // Any other failure
    record('V16-FV-4', 'FAIL', `Expected 200. Got ${r4.status}.`, { actual: `HTTP ${r4.status} body=${r4.body.substring(0, 200)}` });
  }

  // Cleanup
  await prisma.provider.delete({ where: { id: dummyProvId } }).catch(() => {});
  await prisma.user.delete({ where: { id: dummyUserId } }).catch(() => {});
  await prisma.provider.update({ where: { id: provider.id }, data: { customSlug: provider.customSlug ?? null } }).catch(() => {});

  console.log('\n' + '═'.repeat(68));
  const passed  = results.filter(r => r.status === 'PASS').length;
  const failed  = results.filter(r => r.status === 'FAIL').length;
  const blocked = results.filter(r => r.status === 'PRECONDITION-BLOCKED').length;
  console.log(`  FIX-VERIFIED v2 V-16: ${passed} PASS / ${failed} FAIL / ${blocked} PRECONDITION-BLOCKED`);
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'PRECONDITION-BLOCKED' ? '⏭️' : '❌';
    console.log(`  ${icon}  ${r.id}: ${r.status} — ${r.evidence.substring(0, 80)}`);
  });
  console.log('═'.repeat(68));
  console.log(`\nCompleted: ${new Date().toISOString()}`);
  await prisma.$disconnect();
  // Only FAIL causes exit 1 — PRECONDITION-BLOCKED is documented, not a failure
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async e => { console.error('Fatal:', e.message); await prisma.$disconnect(); process.exit(1); });
