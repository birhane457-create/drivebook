/**
 * runtime-verify-registration.cjs
 *
 * Runtime HTTP verification of registration API behaviour.
 * Tests actual HTTP responses against the running dev server.
 * Does NOT create real accounts — uses unique test emails that are cleaned up.
 *
 * Run after the dev server is started on port 3000:
 *   node scripts/runtime-verify-registration.cjs
 */

'use strict';
const http  = require('http');
const https = require('https');
const { PrismaClient } = require('@prisma/client');

process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:3000';
const TIMESTAMP = Date.now();

async function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = {
      hostname: 'localhost', port: 3000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload),
                 // Use different IPs to avoid rate limiting across test runs
                 'x-forwarded-for': `192.168.1.${Math.floor(Math.random() * 200) + 10}` },
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, body: data }) }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function ok(label)   { console.log(`  ✅ ${label}`); }
function fail(label) { console.log(`  ❌ FAIL: ${label}`); process.exitCode = 1; }
function info(label) { console.log(`     ${label}`); }

async function cleanup(emails) {
  for (const email of emails) {
    try {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, providerId: true } });
      if (!user) continue;
      if (user.providerId) {
        await prisma.provider.delete({ where: { id: user.providerId } }).catch(() => {});
      }
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    } catch {}
  }
}

const created = [];

async function main() {
  console.log('='.repeat(72));
  console.log('Runtime verification — registration API');
  console.log(`Server: ${BASE_URL}`);
  console.log('='.repeat(72));

  const BASE = {
    name: 'Runtime Test',
    password: 'TestPass123!',
    phone: '0411111111',
    privacyAccepted: true,
  };

  async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── RT-1: Marketplace + accepted → 201 ACCEPTED ───────────────────────────
  console.log('\nRT-1 | Marketplace + termsAccepted=true → 201 ACCEPTED');
  const email1 = `rt-mkt-${TIMESTAMP}@rt.test`;
  created.push(email1);
  const r1 = await post('/api/register', {
    ...BASE, email: email1, businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: true,
  });
  info(`status=${r1.status} commercialAgreementStatus=${r1.body?.commercialAgreementStatus}`);
  r1.status === 201 ? ok('HTTP 201') : fail(`Expected 201, got ${r1.status}: ${JSON.stringify(r1.body)}`);
  r1.body?.commercialAgreementStatus === 'ACCEPTED' ? ok('commercialAgreementStatus=ACCEPTED') : fail(`Expected ACCEPTED, got ${r1.body?.commercialAgreementStatus}`);

  // ── RT-2: Marketplace without termsAccepted → 400 MARKETPLACE_TERMS_REQUIRED
  console.log('\nRT-2 | Marketplace without termsAccepted → 400 MARKETPLACE_TERMS_REQUIRED');
  const email2 = `rt-mkt-no-terms-${TIMESTAMP}@rt.test`;
  const r2 = await post('/api/register', {
    ...BASE, email: email2, businessType: 'driving', businessModel: 'MARKETPLACE',
    // no termsAccepted
  });
  info(`status=${r2.status} code=${r2.body?.code}`);
  r2.status === 400 ? ok('HTTP 400') : fail(`Expected 400, got ${r2.status}`);
  r2.body?.code === 'MARKETPLACE_TERMS_REQUIRED' ? ok('code=MARKETPLACE_TERMS_REQUIRED') : fail(`Expected MARKETPLACE_TERMS_REQUIRED, got ${r2.body?.code}`);

  // ── RT-3: Marketplace with termsAccepted=false → 400 ─────────────────────
  console.log('\nRT-3 | Marketplace + termsAccepted=false → 400');
  const email3 = `rt-mkt-false-${TIMESTAMP}@rt.test`;
  const r3 = await post('/api/register', {
    ...BASE, email: email3, businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: false,
  });
  info(`status=${r3.status} code=${r3.body?.code}`);
  r3.status === 400 ? ok('HTTP 400') : fail(`Expected 400, got ${r3.status}`);

  // ── RT-4: SaaS → 201 PENDING, no userTerms ───────────────────────────────
  console.log('\nRT-4 | Driving SaaS → 201 PENDING, no User.termsAcceptedAt');
  const email4 = `rt-saas-${TIMESTAMP}@rt.test`;
  created.push(email4);
  const r4 = await post('/api/register', {
    ...BASE, email: email4, businessType: 'driving', businessModel: 'SAAS',
    // termsAccepted NOT sent (SaaS — no agreement yet)
  });
  info(`status=${r4.status} commercialAgreementStatus=${r4.body?.commercialAgreementStatus}`);
  r4.status === 201 ? ok('HTTP 201') : fail(`Expected 201, got ${r4.status}: ${JSON.stringify(r4.body)}`);
  r4.body?.commercialAgreementStatus === 'PENDING' ? ok('commercialAgreementStatus=PENDING') : fail(`Expected PENDING, got ${r4.body?.commercialAgreementStatus}`);

  // Verify User.termsAcceptedAt is null for SaaS
  if (r4.status === 201) {
    const user4 = await prisma.user.findUnique({ where: { email: email4 }, select: { termsAcceptedAt: true, termsVersion: true } });
    user4?.termsAcceptedAt === null ? ok('User.termsAcceptedAt=null (SaaS)') : fail(`Expected null termsAcceptedAt, got ${user4?.termsAcceptedAt}`);
    user4?.termsVersion === null ? ok('User.termsVersion=null (SaaS)') : fail(`Expected null termsVersion, got ${user4?.termsVersion}`);
  }

  // ── RT-5: Non-driving (plumber) → 201 SOLE_TRADER, PENDING ───────────────
  console.log('\nRT-5 | Plumber → 201 SOLE_TRADER, PENDING');
  const email5 = `rt-plumber-${TIMESTAMP}@rt.test`;
  created.push(email5);
  const r5 = await post('/api/register', {
    ...BASE, email: email5, businessType: 'plumber',
  });
  info(`status=${r5.status} organisationType=${r5.body?.organisationType}`);
  r5.status === 201 ? ok('HTTP 201') : fail(`Expected 201, got ${r5.status}: ${JSON.stringify(r5.body)}`);
  r5.body?.organisationType === 'SOLE_TRADER' ? ok('organisationType=SOLE_TRADER') : fail(`Expected SOLE_TRADER, got ${r5.body?.organisationType}`);

  // ── RT-6: Non-driving + REGISTERED_BUSINESS → 201 REGISTERED_BUSINESS ────
  console.log('\nRT-6 | Plumber + REGISTERED_BUSINESS → 201 REGISTERED_BUSINESS');
  const email6 = `rt-regbiz-${TIMESTAMP}@rt.test`;
  created.push(email6);
  const r6 = await post('/api/register', {
    ...BASE, email: email6, businessType: 'plumber', organisationType: 'REGISTERED_BUSINESS',
  });
  info(`status=${r6.status} organisationType=${r6.body?.organisationType}`);
  r6.status === 201 ? ok('HTTP 201') : fail(`Expected 201, got ${r6.status}: ${JSON.stringify(r6.body)}`);
  r6.body?.organisationType === 'REGISTERED_BUSINESS' ? ok('organisationType=REGISTERED_BUSINESS') : fail(`Expected REGISTERED_BUSINESS, got ${r6.body?.organisationType}`);

  // ── RT-7: DRIVING_SCHOOL → 400 DRIVING_SCHOOL_NOT_AVAILABLE ─────────────
  console.log('\nRT-7 | DRIVING_SCHOOL → 400 DRIVING_SCHOOL_NOT_AVAILABLE');
  const email7 = `rt-school-${TIMESTAMP}@rt.test`;
  const r7 = await post('/api/register', {
    ...BASE, email: email7, businessType: 'driving', businessModel: 'SAAS', organisationType: 'DRIVING_SCHOOL',
  });
  info(`status=${r7.status} code=${r7.body?.code}`);
  r7.status === 400 ? ok('HTTP 400') : fail(`Expected 400, got ${r7.status}`);
  r7.body?.code === 'DRIVING_SCHOOL_NOT_AVAILABLE' ? ok('code=DRIVING_SCHOOL_NOT_AVAILABLE') : fail(`Expected DRIVING_SCHOOL_NOT_AVAILABLE, got ${r7.body?.code}`);

  // ── RT-8: BUSINESS org type → 400 ORGANISATION_TYPE_NOT_AVAILABLE ────────
  console.log('\nRT-8 | BUSINESS org type → 400 ORGANISATION_TYPE_NOT_AVAILABLE');
  const email8 = `rt-business-org-${TIMESTAMP}@rt.test`;
  const r8 = await post('/api/register', {
    ...BASE, email: email8, businessType: 'plumber', organisationType: 'BUSINESS',
  });
  info(`status=${r8.status} code=${r8.body?.code}`);
  r8.status === 400 ? ok('HTTP 400') : fail(`Expected 400, got ${r8.status}`);
  r8.body?.code === 'ORGANISATION_TYPE_NOT_AVAILABLE' ? ok('code=ORGANISATION_TYPE_NOT_AVAILABLE') : fail(`Expected ORGANISATION_TYPE_NOT_AVAILABLE, got ${r8.body?.code}`);

  // ── RT-9: Non-driving + INDIVIDUAL_INSTRUCTOR → 400 INVALID ──────────────
  console.log('\nRT-9 | Non-driving + INDIVIDUAL_INSTRUCTOR → 400 INVALID_ORGANISATION_TYPE');
  const email9 = `rt-invalid-org-${TIMESTAMP}@rt.test`;
  const r9 = await post('/api/register', {
    ...BASE, email: email9, businessType: 'plumber', organisationType: 'INDIVIDUAL_INSTRUCTOR',
  });
  info(`status=${r9.status} code=${r9.body?.code}`);
  r9.status === 400 ? ok('HTTP 400') : fail(`Expected 400, got ${r9.status}`);
  r9.body?.code === 'INVALID_ORGANISATION_TYPE' ? ok('code=INVALID_ORGANISATION_TYPE') : fail(`Expected INVALID_ORGANISATION_TYPE, got ${r9.body?.code}`);

  // ── RT-10: Missing privacyAccepted → 400 Zod error ───────────────────────
  console.log('\nRT-10 | Missing privacyAccepted → 400 (Zod validation)');
  const { privacyAccepted: _, ...noPrivacy } = BASE;
  const r10 = await post('/api/register', {
    ...noPrivacy, email: `rt-noprivacy-${TIMESTAMP}@rt.test`, businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: true,
  });
  info(`status=${r10.status}`);
  r10.status === 400 ? ok('HTTP 400 (Zod validation)') : fail(`Expected 400, got ${r10.status}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(72));
  console.log(`Runtime verification complete. Exit code: ${process.exitCode ?? 0}`);
  if (!process.exitCode) console.log('All runtime checks passed.');
  console.log('='.repeat(72));
}

main()
  .catch(e => { console.error('Script error:', e.message); process.exitCode = 1; })
  .finally(async () => {
    console.log('\nCleaning up test accounts...');
    await cleanup(created);
    await prisma.$disconnect();
    console.log('Cleanup complete.');
  });
