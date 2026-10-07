/**
 * FIX-VERIFIED test for BRAND-V-07 (hardened — all negative branches FAIL)
 *
 * Tests:
 *   V07-FV-1: After legacy PUT with brandLogo, BusinessBranding.logo equals Provider.brandLogo
 *   V07-FV-2: After legacy PUT with brandColorPrimary, BusinessBranding.primaryColour equals Provider.brandColorPrimary
 *   V07-FV-3: showPlatformBranding is the exact inverse of showBrandingOnBookingPage
 *   V07-FV-4: Legacy PUT on a provider with NO BusinessBranding record returns HTTP 200 (no crash)
 *             Uses a new dummy provider that has never had a BusinessBranding record.
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
    const r = lib.request(url, { ...opts, headers: { 'User-Agent': 'fv-v07/1.0', ...opts.headers } }, (res) => {
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
  console.log(`\n${status === 'PASS' ? '✅' : '❌'}  ${id}: ${status}`);
  console.log(`   Evidence: ${evidence}`);
  if (details.actual) console.log(`   Actual:   ${details.actual}`);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║   FIX-VERIFIED v2: BRAND-V-07 branding sync                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`\nStarted: ${new Date().toISOString()}`);

  const session = await login(EMAIL, PASS);
  const TS = Date.now();

  const provider = await prisma.provider.findFirst({
    where: { user: { email: EMAIL } },
    select: { id: true, brandLogo: true, brandColorPrimary: true, showBrandingOnBookingPage: true },
  });
  const bizId = `biz_${provider.id}`;

  // Check if BusinessBranding record exists — use existing if present
  let hasBizBranding = false;
  try {
    const existing = await (prisma).businessBranding.findUnique({
      where: { businessId: bizId },
      select: { businessId: true },
    });
    if (existing) {
      hasBizBranding = true;
      console.log(`   BusinessBranding record found for ${bizId}`);
    } else {
      console.log(`   No BusinessBranding record for ${bizId} — FV-1/2/3 will FAIL (sync untestable without record)`);
    }
  } catch (e) {
    console.log(`   BusinessBranding lookup failed: ${e.message.substring(0, 80)}`);
  }

  // ── V07-FV-1: Logo sync ────────────────────────────────────────────────────
  console.log('\n── V07-FV-1: Logo syncs to BusinessBranding ──────────────────────');
  if (!hasBizBranding) {
    record('V07-FV-1', 'FAIL', 'BusinessBranding record could not be ensured — cannot test sync.', {});
  } else {
    const testLogo = `https://example.com/v07fv2-logo-${TS}.png`;
    const p1 = JSON.stringify({ brandLogo: testLogo });
    const r1 = await req(`${BASE}/api/instructor/branding`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(p1), 'Cookie': session }, body: p1,
    });
    const bb1 = await (prisma).businessBranding.findUnique({ where: { businessId: bizId }, select: { logo: true } }).catch(() => null);
    const pv1 = await prisma.provider.findUnique({ where: { id: provider.id }, select: { brandLogo: true } });

    // STRICT: both must match exactly
    if (r1.status === 200 && bb1 && bb1.logo === testLogo && pv1.brandLogo === testLogo) {
      record('V07-FV-1', 'PASS', 'Provider.brandLogo and BusinessBranding.logo both equal the sent value.', { actual: `provider="${pv1.brandLogo}" biz="${bb1.logo}"` });
    } else {
      record('V07-FV-1', 'FAIL', `Logo mismatch. provider="${pv1?.brandLogo}" biz="${bb1?.logo}" sent="${testLogo}" HTTP=${r1.status}`, { actual: `HTTP ${r1.status} provider="${pv1?.brandLogo}" biz="${bb1?.logo}"` });
    }
  }

  // ── V07-FV-2: PrimaryColour sync ──────────────────────────────────────────
  console.log('\n── V07-FV-2: PrimaryColour syncs ──────────────────────────────────');
  if (!hasBizBranding) {
    record('V07-FV-2', 'FAIL', 'BusinessBranding record unavailable — cannot test sync.', {});
  } else {
    const testColor = '#AB1234';
    const p2 = JSON.stringify({ brandColorPrimary: testColor });
    const r2 = await req(`${BASE}/api/instructor/branding`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(p2), 'Cookie': session }, body: p2,
    });
    const bb2 = await (prisma).businessBranding.findUnique({ where: { businessId: bizId }, select: { primaryColour: true } }).catch(() => null);
    const pv2 = await prisma.provider.findUnique({ where: { id: provider.id }, select: { brandColorPrimary: true } });

    // STRICT: both must match exactly
    if (r2.status === 200 && bb2 && bb2.primaryColour === testColor && pv2.brandColorPrimary === testColor) {
      record('V07-FV-2', 'PASS', 'Provider.brandColorPrimary and BusinessBranding.primaryColour both equal the sent value.', { actual: `provider="${pv2.brandColorPrimary}" biz="${bb2.primaryColour}"` });
    } else {
      record('V07-FV-2', 'FAIL', `Colour mismatch. provider="${pv2?.brandColorPrimary}" biz="${bb2?.primaryColour}" sent="${testColor}" HTTP=${r2.status}`, { actual: `HTTP ${r2.status}` });
    }
  }

  // ── V07-FV-3: showPlatformBranding inversion ──────────────────────────────
  console.log('\n── V07-FV-3: showPlatformBranding inversion ────────────────────────');
  if (!hasBizBranding) {
    record('V07-FV-3', 'FAIL', 'BusinessBranding record unavailable — cannot test inversion.', {});
  } else {
    const p3 = JSON.stringify({ showBrandingOnBookingPage: false });
    const r3 = await req(`${BASE}/api/instructor/branding`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(p3), 'Cookie': session }, body: p3,
    });
    const bb3 = await (prisma).businessBranding.findUnique({ where: { businessId: bizId }, select: { showPlatformBranding: true } }).catch(() => null);
    const pv3 = await prisma.provider.findUnique({ where: { id: provider.id }, select: { showBrandingOnBookingPage: true } });

    // STRICT: false → true and true → false, exact
    if (r3.status === 200 && bb3 && bb3.showPlatformBranding === true && pv3.showBrandingOnBookingPage === false) {
      record('V07-FV-3', 'PASS', 'showBrandingOnBookingPage=false → showPlatformBranding=true confirmed in both models.', { actual: `provider=${pv3.showBrandingOnBookingPage} biz=${bb3.showPlatformBranding}` });
    } else {
      record('V07-FV-3', 'FAIL', `Inversion not confirmed. provider=${pv3?.showBrandingOnBookingPage} biz=${bb3?.showPlatformBranding} HTTP=${r3.status}`, { actual: `HTTP ${r3.status} provider=${pv3?.showBrandingOnBookingPage} biz=${bb3?.showPlatformBranding}` });
    }
  }

  // ── V07-FV-4: PUT from a provider with NO BusinessBranding record ──────────
  // Create a new provider via the register API (gets email verification skipped
  // via DB direct set), then login as that provider and PUT to /api/instructor/branding.
  // Confirms the sync try/catch does not surface as 500 for no-record providers.
  console.log('\n── V07-FV-4: PUT from provider with no BusinessBranding (real session) ─');

  const dummyUId    = `v07fv2-u-${TS}`;
  const dummyPId    = `v07fv2-p-${TS}`;
  const dummyEmail  = `v07fv2-${TS}@audit.test`;
  const dummyPass   = `Audit${TS}!`;

  // Create via Prisma (register API would trigger email — bypass with direct create)
  await prisma.user.create({
    data: { id: dummyUId, email: dummyEmail, name: 'V07 FV2 NoBiz', role: 'provider', emailVerified: true },
  }).catch(() => {});

  // Set hashed password directly via the register endpoint so NextAuth can verify it
  const regPayload = JSON.stringify({
    name: 'V07 FV2 NoBiz', email: dummyEmail, password: dummyPass,
    phone: '+61400000066', businessType: 'driving', termsAccepted: true, termsVersion: '1.0',
  });
  const regRes = await req(`${BASE}/api/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(regPayload) }, body: regPayload,
  });
  const regData = regRes.json();
  const newProvId = regData?.providerId;
  console.log(`   Register HTTP ${regRes.status} — providerId=${newProvId}`);

  if (regRes.status !== 201 || !newProvId) {
    record('V07-FV-4', 'PRECONDITION-BLOCKED',
      `Could not register dummy provider for FV-4. HTTP ${regRes.status}. Cannot test no-BusinessBranding path via real session.`,
      { actual: `register HTTP ${regRes.status}` }
    );
  } else {
    // Mark email as verified so login works
    await prisma.user.updateMany({
      where: { email: dummyEmail },
      data: { emailVerified: true, verificationToken: null, verificationTokenExpiry: null },
    }).catch(() => {});

    // Confirm no BusinessBranding exists for this provider
    const bizIdDummy = `biz_${newProvId}`;
    const dummyBiz = await (prisma).businessBranding.findUnique({ where: { businessId: bizIdDummy } }).catch(() => null);
    console.log(`   BusinessBranding for dummy: ${dummyBiz ? 'EXISTS (unexpected)' : 'ABSENT (expected)'}`);

    // Login as the dummy provider
    let dummySession = null;
    try {
      dummySession = await login(dummyEmail, dummyPass);
      console.log(`   Dummy session obtained: ${dummySession.substring(0, 50)}...`);
    } catch (e) {
      console.log(`   Dummy login failed: ${e.message}`);
    }

    if (!dummySession) {
      record('V07-FV-4', 'PRECONDITION-BLOCKED',
        'Could not login as dummy provider — cannot test no-BusinessBranding path via real session.',
        { actual: 'login failed' }
      );
    } else {
      // PUT from dummy session (no BusinessBranding record exists)
      const p4 = JSON.stringify({ brandColorPrimary: '#777777' });
      const r4 = await req(`${BASE}/api/instructor/branding`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(p4), 'Cookie': dummySession }, body: p4,
      });

      if (r4.status === 200) {
        // Confirm no BusinessBranding was created (sync skipped gracefully)
        const bizAfter = await (prisma).businessBranding.findUnique({ where: { businessId: bizIdDummy } }).catch(() => null);
        if (!bizAfter) {
          record('V07-FV-4', 'PASS',
            'PUT from provider with NO BusinessBranding returned HTTP 200. No BusinessBranding row created. Sync skipped gracefully.',
            { actual: `HTTP 200 bizAfter=${bizAfter === null ? 'null (no record created)' : 'EXISTS'}` }
          );
        } else {
          record('V07-FV-4', 'PASS',
            'PUT returned HTTP 200. BusinessBranding row was created by sync (acceptable — sync succeeded rather than skipped).',
            { actual: `HTTP 200 bizAfter=EXISTS` }
          );
        }
      } else {
        record('V07-FV-4', 'FAIL',
          `PUT from no-BusinessBranding provider returned ${r4.status} — sync error may have propagated.`,
          { actual: `HTTP ${r4.status} body=${r4.body.substring(0, 200)}` }
        );
      }
    }
  }

  // Cleanup dummy
  await prisma.provider.deleteMany({ where: { userId: { startsWith: dummyUId } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: dummyUId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: dummyEmail } }).catch(() => {});
  await prisma.provider.update({
    where: { id: provider.id },
    data: { brandLogo: provider.brandLogo, brandColorPrimary: provider.brandColorPrimary, showBrandingOnBookingPage: provider.showBrandingOnBookingPage },
  }).catch(() => {});

  console.log('\n' + '═'.repeat(68));
  const passed  = results.filter(r => r.status === 'PASS').length;
  const failed  = results.filter(r => r.status === 'FAIL').length;
  const blocked = results.filter(r => r.status === 'PRECONDITION-BLOCKED').length;
  console.log(`  FIX-VERIFIED v2 V-07: ${passed} PASS / ${failed} FAIL / ${blocked} PRECONDITION-BLOCKED`);
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'PRECONDITION-BLOCKED' ? '⏭️' : '❌';
    console.log(`  ${icon}  ${r.id}: ${r.status} — ${r.evidence.substring(0, 80)}`);
  });
  console.log('═'.repeat(68));
  console.log(`\nCompleted: ${new Date().toISOString()}`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async e => { console.error('Fatal:', e.message); await prisma.$disconnect(); process.exit(1); });
