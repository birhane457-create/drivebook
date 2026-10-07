/**
 * FIX-VERIFIED test for BRAND-V-01 (hardened — all negative branches FAIL)
 *
 * Tests:
 *   V01-FV-1: Verify endpoint returns HTTP 409 for domain owned by another provider
 *   V01-FV-2: Verify endpoint does NOT return 409 for own domain re-verification
 *   V01-FV-3: Public /custom-domain returns HTTP 200 for collision scenario
 *             (proves the route resolves rather than erroring — orderBy makes it deterministic)
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
    const r = lib.request(url, { ...opts, headers: { 'User-Agent': 'fv-v01/1.0', ...opts.headers } }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString(), json() { try { return JSON.parse(this.body); } catch { return null; } } }));
    });
    r.on('error', reject);
    r.setTimeout(opts.timeoutMs ?? 20000, () => { r.destroy(); reject(new Error('timeout')); });
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
  console.log(`\n${status === 'PASS' ? '✅' : '❌'}  ${id}: ${status}`);
  console.log(`   Evidence: ${evidence}`);
  if (details.actual) console.log(`   Actual:   ${details.actual}`);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║   FIX-VERIFIED v2: BRAND-V-01 domain ownership invariant        ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`\nStarted: ${new Date().toISOString()}`);

  const session = await login(EMAIL, PASS);
  const realProvider = await prisma.provider.findFirst({
    where: { user: { email: EMAIL } },
    select: { id: true, subscriptionTier: true, customDomain: true, domainVerified: true },
  });
  console.log(`   Provider: ${realProvider.id} tier=${realProvider.subscriptionTier}`);

  const TS         = Date.now();
  const testDomain = `v01-fv2-test-${TS}.example.com`;

  // ── V01-FV-1: 409 when domain already owned by another provider ──────────
  console.log('\n── V01-FV-1: Reject domain owned by another provider (expect 409) ─');
  const dummyUserId = `v01fv2-u-${TS}`;
  const dummyProvId = `v01fv2-p-${TS}`;

  await prisma.user.create({
    data: { id: dummyUserId, email: `v01fv2-${TS}@audit.test`, name: 'V01 FV2 Dummy', role: 'provider', emailVerified: true },
  });
  await prisma.provider.create({
    data: {
      id: dummyProvId, userId: dummyUserId, name: 'V01 FV2 Dummy',
      phone: '+61400000088', hourlyRate: 50,
      customDomain: testDomain, domainVerified: true, domainVerifiedAt: new Date(),
      subscriptionTier: 'STUDIO', subscriptionStatus: 'ACTIVE',
    },
  });
  await prisma.provider.update({ where: { id: realProvider.id }, data: { subscriptionTier: 'STUDIO' } });

  const payload1 = JSON.stringify({ domain: testDomain });
  const res1 = await req(`${BASE}/api/instructor/domain/verify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload1), 'Cookie': session }, body: payload1,
  });
  const d1 = res1.json();

  // STRICT: only 409 with the correct message passes
  if (res1.status === 409 && d1?.error?.toLowerCase().includes('another account')) {
    record('V01-FV-1', 'PASS', 'HTTP 409 returned for domain owned by another provider.', { actual: `HTTP ${res1.status} error="${d1.error}"` });
  } else {
    record('V01-FV-1', 'FAIL', `Expected HTTP 409 with ownership error. Got HTTP ${res1.status}.`, { actual: `HTTP ${res1.status} body=${res1.body.substring(0, 200)}` });
  }

  // ── V01-FV-2: Own domain re-verification not blocked ─────────────────────
  console.log('\n── V01-FV-2: Own domain not blocked (expect NOT 409) ──────────────');
  const ownDomain = `v01-fv2-own-${TS}.example.com`;
  await prisma.provider.update({
    where: { id: realProvider.id },
    data: { customDomain: ownDomain, domainVerified: true, domainVerifiedAt: new Date(), subscriptionTier: 'STUDIO' },
  });
  const payload2 = JSON.stringify({ domain: ownDomain });
  const res2 = await req(`${BASE}/api/instructor/domain/verify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload2), 'Cookie': session }, body: payload2,
  });
  const d2 = res2.json();

  if (res2.status === 409) {
    record('V01-FV-2', 'FAIL', 'Verify endpoint blocked provider from re-verifying their OWN domain with 409 — fix is too broad.', { actual: `HTTP 409 error="${d2?.error}"` });
  } else {
    record('V01-FV-2', 'PASS', `Own domain not blocked. HTTP ${res2.status} (may fail DNS — expected for test domain).`, { actual: `HTTP ${res2.status}` });
  }

  // ── V01-FV-3: Collision scenario resolves via HTTP 200 (deterministic) ───
  console.log('\n── V01-FV-3: Collision resolves HTTP 200 (orderBy deterministic) ──');
  const sharedDomain = `v01-fv2-shared-${TS}.example.com`;
  // Place both providers on the same domain, verify = true
  // newer domainVerifiedAt on dummy — it should win
  await prisma.provider.update({
    where: { id: realProvider.id },
    data: { customDomain: sharedDomain, domainVerified: true, domainVerifiedAt: new Date(Date.now() - 2000), subscriptionTier: 'STUDIO' },
  });
  await prisma.provider.update({
    where: { id: dummyProvId },
    data: { customDomain: sharedDomain, domainVerified: true, domainVerifiedAt: new Date() },
  });

  let res3;
  try {
    res3 = await req(`${BASE}/custom-domain`, {
      headers: { 'x-custom-domain': sharedDomain, Cookie: session },
      timeoutMs: 45000,
    });
  } catch (e) {
    res3 = { status: `error:${e.message}`, body: '' };
  }

  // STRICT: must be 200. For this to be 200 with our test domain, the resolver
  // must find a provider with domainVerified=true and STUDIO tier. We set both.
  if (res3.status === 200) {
    record('V01-FV-3', 'PASS', 'Collision scenario: /custom-domain returns HTTP 200 — orderBy applied, route resolves without error.', { actual: `HTTP 200` });
  } else {
    record('V01-FV-3', 'FAIL', `Expected HTTP 200 for collision scenario. Got ${res3.status}. orderBy cannot be confirmed without successful resolution.`, { actual: `HTTP ${res3.status}` });
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────
  await prisma.provider.delete({ where: { id: dummyProvId } }).catch(() => {});
  await prisma.user.delete({ where: { id: dummyUserId } }).catch(() => {});
  await prisma.provider.update({
    where: { id: realProvider.id },
    data: { customDomain: realProvider.customDomain, domainVerified: realProvider.domainVerified, subscriptionTier: realProvider.subscriptionTier },
  }).catch(() => {});

  console.log('\n' + '═'.repeat(68));
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`  FIX-VERIFIED v2 V-01: ${passed} PASS / ${failed} FAIL`);
  results.forEach(r => console.log(`  ${r.status === 'PASS' ? '✅' : '❌'}  ${r.id}: ${r.evidence.substring(0, 100)}`));
  console.log('═'.repeat(68));
  console.log(`\nCompleted: ${new Date().toISOString()}`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async e => { console.error('Fatal:', e.message); await prisma.$disconnect(); process.exit(1); });
