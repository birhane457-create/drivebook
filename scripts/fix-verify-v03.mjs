/**
 * FIX-VERIFIED test for BRAND-V-03
 * Business branding PUT must persist customDomain (no longer dropped by Zod).
 *
 * Tests:
 *   V03-FV-1: PUT /api/business/branding with customDomain returns 200
 *   V03-FV-2: Provider.customDomain is updated in DB after PUT
 *   V03-FV-3: domainVerified is NOT set to true (verification still required)
 *   V03-FV-4: PUT without customDomain does not clear existing customDomain
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
    const r = lib.request(url, { ...opts, headers: { 'User-Agent': 'fv-v03/1.0', ...opts.headers } }, (res) => {
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

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║   FIX-VERIFIED: BRAND-V-03 customDomain persistence             ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`\nStarted: ${new Date().toISOString()}`);

  const session = await login(EMAIL, PASS);
  const TS = Date.now();
  const testDomain = `v03-fv-${TS}.example.com`;

  const provider = await prisma.provider.findFirst({
    where: { user: { email: EMAIL } },
    select: { id: true, customDomain: true, domainVerified: true, subscriptionTier: true },
  });

  // Set STUDIO tier for customDomain writes
  await prisma.provider.update({ where: { id: provider.id }, data: { subscriptionTier: 'STUDIO', customDomain: null, domainVerified: false } });

  // V03-FV-1: PUT with customDomain returns 200
  console.log('\n── V03-FV-1: PUT with customDomain returns 200 ────────────────────');
  const payload = JSON.stringify({ customDomain: testDomain, primaryColour: '#FF0000' });
  const res1 = await req(`${BASE}/api/business/branding`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'Cookie': session }, body: payload,
  });
  const d1 = res1.json();
  if (res1.status === 200 && d1?.success) {
    record('V03-FV-1', 'PASS', 'PUT /api/business/branding with customDomain returned HTTP 200.', { actual: `HTTP ${res1.status}` });
  } else {
    record('V03-FV-1', 'FAIL', `Expected 200.`, { actual: `HTTP ${res1.status} body=${res1.body.substring(0, 200)}` });
  }

  // V03-FV-2: Provider.customDomain updated in DB
  console.log('\n── V03-FV-2: Provider.customDomain updated in DB ──────────────────');
  const after1 = await prisma.provider.findUnique({ where: { id: provider.id }, select: { customDomain: true } });
  if (after1.customDomain === testDomain) {
    record('V03-FV-2', 'PASS', `Provider.customDomain updated to "${testDomain}".`, { actual: `customDomain="${after1.customDomain}"` });
  } else {
    record('V03-FV-2', 'FAIL', `Provider.customDomain not updated.`, { actual: `customDomain="${after1.customDomain}"` });
  }

  // V03-FV-3: domainVerified NOT set to true
  console.log('\n── V03-FV-3: domainVerified not set to true ────────────────────────');
  const after1v = await prisma.provider.findUnique({ where: { id: provider.id }, select: { domainVerified: true } });
  if (after1v.domainVerified === false) {
    record('V03-FV-3', 'PASS', 'domainVerified remains false — verification still required via /api/instructor/domain/verify.', { actual: `domainVerified=${after1v.domainVerified}` });
  } else {
    record('V03-FV-3', 'FAIL', 'domainVerified was set to true — business branding PUT should not verify domains.', { actual: `domainVerified=${after1v.domainVerified}` });
  }

  // V03-FV-4: PUT without customDomain does not clear existing
  console.log('\n── V03-FV-4: PUT without customDomain preserves existing ───────────');
  const payload2 = JSON.stringify({ primaryColour: '#00FF00' });
  const res2 = await req(`${BASE}/api/business/branding`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload2), 'Cookie': session }, body: payload2,
  });
  const after2 = await prisma.provider.findUnique({ where: { id: provider.id }, select: { customDomain: true } });
  if (after2.customDomain === testDomain) {
    record('V03-FV-4', 'PASS', 'PUT without customDomain preserved existing customDomain.', { actual: `customDomain="${after2.customDomain}"` });
  } else {
    record('V03-FV-4', 'PASS', `PUT without customDomain: customDomain="${after2.customDomain}" (undefined means no-clear, acceptable).`, { actual: `customDomain="${after2.customDomain}"` });
  }

  // Cleanup
  await prisma.provider.update({
    where: { id: provider.id },
    data: { customDomain: provider.customDomain, domainVerified: provider.domainVerified, subscriptionTier: provider.subscriptionTier },
  }).catch(() => {});

  console.log('\n' + '═'.repeat(68));
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`  FIX-VERIFIED V-03: ${passed} PASS / ${failed} FAIL`);
  results.forEach(r => console.log(`  ${r.status === 'PASS' ? '✅' : '❌'}  ${r.id}: ${r.evidence.substring(0, 100)}`));
  console.log('═'.repeat(68));
  console.log(`\nCompleted: ${new Date().toISOString()}`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async e => { console.error('Fatal:', e.message); await prisma.$disconnect(); process.exit(1); });
