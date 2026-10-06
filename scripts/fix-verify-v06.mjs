/**
 * FIX-VERIFIED test for BRAND-V-06
 * Legacy branding PUT must require STUDIO/PREMIUM for customDomain writes.
 *
 * Tests:
 *   V06-FV-1: PRO-tier provider cannot write customDomain (expect 403)
 *   V06-FV-2: BASIC-tier provider cannot write customDomain (expect 403)
 *   V06-FV-3: STUDIO-tier provider CAN write customDomain (expect 200)
 *   V06-FV-4: Any tier can still write brandColorPrimary (gate is customDomain-only)
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
    const r = lib.request(url, { ...opts, headers: { 'User-Agent': 'fv-v06/1.0', ...opts.headers } }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString(), json() { try { return JSON.parse(this.body); } catch { return null; } } }));
    });
    r.on('error', reject);
    r.setTimeout(opts.timeoutMs ?? 15000, () => { r.destroy(); reject(new Error('timeout')); });
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

async function putBranding(session, payload) {
  const body = JSON.stringify(payload);
  return req(`${BASE}/api/instructor/branding`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Cookie': session },
    body,
  });
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
  console.log('║   FIX-VERIFIED: BRAND-V-06 customDomain tier gate               ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`\nStarted: ${new Date().toISOString()}`);

  const session = await login(EMAIL, PASS);
  const TS = Date.now();

  const provider = await prisma.provider.findFirst({
    where: { user: { email: EMAIL } },
    select: { id: true, subscriptionTier: true },
  });

  // ── V06-FV-1: PRO tier blocked ────────────────────────────────────────────
  console.log('\n── V06-FV-1: PRO tier cannot write customDomain (expect 403) ──────');
  await prisma.provider.update({ where: { id: provider.id }, data: { subscriptionTier: 'PRO' } });
  const res1 = await putBranding(session, { customDomain: `v06-fv-pro-${TS}.example.com` });
  const d1 = res1.json();
  if (res1.status === 403 && d1?.error?.toLowerCase().includes('studio')) {
    record('V06-FV-1', 'PASS', `PRO tier blocked from customDomain write. HTTP 403.`, { actual: `HTTP ${res1.status} error="${d1.error}"` });
  } else {
    record('V06-FV-1', 'FAIL', `Expected 403 for PRO tier.`, { actual: `HTTP ${res1.status} body=${res1.body.substring(0, 200)}` });
  }

  // ── V06-FV-2: BASIC tier blocked ─────────────────────────────────────────
  console.log('\n── V06-FV-2: BASIC tier cannot write customDomain (expect 403) ────');
  await prisma.provider.update({ where: { id: provider.id }, data: { subscriptionTier: 'BASIC' } });
  const res2 = await putBranding(session, { customDomain: `v06-fv-basic-${TS}.example.com` });
  const d2 = res2.json();
  if (res2.status === 403) {
    record('V06-FV-2', 'PASS', `BASIC tier blocked from customDomain write. HTTP 403.`, { actual: `HTTP ${res2.status} error="${d2?.error}"` });
  } else {
    record('V06-FV-2', 'FAIL', `Expected 403 for BASIC tier.`, { actual: `HTTP ${res2.status} body=${res2.body.substring(0, 200)}` });
  }

  // ── V06-FV-3: STUDIO tier allowed ─────────────────────────────────────────
  console.log('\n── V06-FV-3: STUDIO tier can write customDomain (expect 200) ──────');
  await prisma.provider.update({ where: { id: provider.id }, data: { subscriptionTier: 'STUDIO' } });
  const res3 = await putBranding(session, { customDomain: `v06-fv-studio-${TS}.example.com` });
  const d3 = res3.json();
  if (res3.status === 200 && d3?.success) {
    record('V06-FV-3', 'PASS', `STUDIO tier allowed to write customDomain. HTTP 200.`, { actual: `HTTP ${res3.status} customDomain="${d3?.branding?.customDomain}"` });
  } else {
    record('V06-FV-3', 'FAIL', `Expected 200 for STUDIO tier.`, { actual: `HTTP ${res3.status} body=${res3.body.substring(0, 200)}` });
  }

  // ── V06-FV-4: Non-domain fields still available to lower tiers ───────────
  console.log('\n── V06-FV-4: PRO tier can write brandColorPrimary (gate is domain-only)');
  await prisma.provider.update({ where: { id: provider.id }, data: { subscriptionTier: 'PRO' } });
  const res4 = await putBranding(session, { brandColorPrimary: '#FF5500' });
  const d4 = res4.json();
  if (res4.status === 200 && d4?.success) {
    record('V06-FV-4', 'PASS', `PRO tier can write brandColorPrimary (gate only on customDomain). HTTP 200.`, { actual: `HTTP ${res4.status}` });
  } else {
    record('V06-FV-4', 'FAIL', `PRO tier blocked from brandColorPrimary unexpectedly.`, { actual: `HTTP ${res4.status} body=${res4.body.substring(0, 200)}` });
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────
  await prisma.provider.update({
    where: { id: provider.id },
    data: { subscriptionTier: provider.subscriptionTier, customDomain: null },
  }).catch(() => {});

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(68));
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`  FIX-VERIFIED V-06: ${passed} PASS / ${failed} FAIL`);
  results.forEach(r => console.log(`  ${r.status === 'PASS' ? '✅' : '❌'}  ${r.id}: ${r.evidence.substring(0, 100)}`));
  console.log('═'.repeat(68));
  console.log(`\nCompleted: ${new Date().toISOString()}`);

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async e => { console.error('Fatal:', e.message); await prisma.$disconnect(); process.exit(1); });
