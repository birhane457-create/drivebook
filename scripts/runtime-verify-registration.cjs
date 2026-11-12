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

const PORT = process.env.TEST_PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;
const TIMESTAMP = Date.now();

async function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = {
      hostname: 'localhost', port: PORT, path, method: 'POST',
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
  let deleted = 0;
  let failed = 0;
  let notFound = 0;
  for (const email of emails) {
    try {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, providerId: true } });
      if (!user) { notFound++; continue; }
      if (user.providerId) {
        await prisma.provider.delete({ where: { id: user.providerId } }).catch(e => { failed++; console.error(`  ⚠ Failed to delete Provider ${user.providerId}: ${e.message}`); });
      }
      await prisma.user.delete({ where: { id: user.id } }).catch(e => { failed++; console.error(`  ⚠ Failed to delete User ${user.id}: ${e.message}`); });
      deleted++;
    } catch (e) {
      failed++;
      console.error(`  ⚠ Cleanup error for ${email}: ${e.message}`);
    }
  }
  console.log(`  Cleanup: ${deleted} deleted, ${notFound} not found, ${failed} failed`);
  if (failed > 0) console.error('  ⚠ CLEANUP FAILURES — manual deletion may be required');
  return failed;
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

  // RT-1DB: Full Provider DB persistence — Marketplace
  if (r1.status === 201) {
    if (!r1.body?.providerId) { fail('HTTP 201 missing providerId — DB assertions cannot run'); }
    else {
      console.log('\nRT-1DB | Full Provider DB persistence — Marketplace');
      const p1 = await prisma.provider.findUnique({
      where: { id: r1.body.providerId },
      select: { commercialAgreementType: true, commercialAgreementStatus: true, commercialAgreementVersion: true,
                commercialAgreementAcceptedAt: true, privacyPolicyVersion: true, privacyPolicyAcceptedAt: true,
                organisationType: true, businessModel: true, paymentMode: true },
    });
    info(`agreementType=${p1?.commercialAgreementType} status=${p1?.commercialAgreementStatus} version=${p1?.commercialAgreementVersion}`);
    info(`privacyVersion=${p1?.privacyPolicyVersion} orgType=${p1?.organisationType} businessModel=${p1?.businessModel} paymentMode=${p1?.paymentMode}`);
    p1?.commercialAgreementType === 'MARKETPLACE_TERMS' ? ok('DB: commercialAgreementType=MARKETPLACE_TERMS') : fail(`DB: expected MARKETPLACE_TERMS, got ${p1?.commercialAgreementType}`);
    p1?.commercialAgreementStatus === 'ACCEPTED' ? ok('DB: commercialAgreementStatus=ACCEPTED') : fail(`DB: expected ACCEPTED, got ${p1?.commercialAgreementStatus}`);
    p1?.commercialAgreementVersion === '2.0' ? ok('DB: commercialAgreementVersion=2.0') : fail(`DB: expected 2.0, got ${p1?.commercialAgreementVersion}`);
    p1?.commercialAgreementAcceptedAt !== null ? ok('DB: commercialAgreementAcceptedAt set') : fail('DB: expected non-null commercialAgreementAcceptedAt');
    p1?.privacyPolicyVersion === '2.0' ? ok('DB: privacyPolicyVersion=2.0') : fail(`DB: expected 2.0, got ${p1?.privacyPolicyVersion}`);
    p1?.privacyPolicyAcceptedAt !== null ? ok('DB: privacyPolicyAcceptedAt set') : fail('DB: expected non-null privacyPolicyAcceptedAt');
    p1?.organisationType === 'INDIVIDUAL_INSTRUCTOR' ? ok('DB: organisationType=INDIVIDUAL_INSTRUCTOR') : fail(`DB: expected INDIVIDUAL_INSTRUCTOR, got ${p1?.organisationType}`);
    p1?.businessModel === 'MARKETPLACE' ? ok('DB: businessModel=MARKETPLACE') : fail(`DB: expected MARKETPLACE, got ${p1?.businessModel}`);
    p1?.paymentMode === 'PLATFORM' ? ok('DB: paymentMode=PLATFORM') : fail(`DB: expected PLATFORM, got ${p1?.paymentMode}`);
    // Also verify User.termsAcceptedAt is set for Marketplace
    const u1 = await prisma.user.findUnique({ where: { email: email1 }, select: { termsAcceptedAt: true, termsVersion: true } });
    u1?.termsAcceptedAt !== null ? ok('DB: User.termsAcceptedAt set (Marketplace)') : fail('DB: expected non-null User.termsAcceptedAt');
    u1?.termsVersion === '2.0' ? ok('DB: User.termsVersion=2.0 (Marketplace)') : fail(`DB: expected 2.0, got ${u1?.termsVersion}`);
    }
  }

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

  // RT-4DB: Full Provider DB persistence — SaaS
  if (r4.status === 201) {
    if (!r4.body?.providerId) { fail('HTTP 201 missing providerId — DB assertions cannot run'); }
    else {
      console.log('\nRT-4DB | Full Provider DB persistence — SaaS');
    const p4 = await prisma.provider.findUnique({
      where: { id: r4.body.providerId },
      select: { commercialAgreementType: true, commercialAgreementStatus: true, commercialAgreementVersion: true,
                commercialAgreementAcceptedAt: true, privacyPolicyVersion: true, privacyPolicyAcceptedAt: true,
                organisationType: true, businessModel: true, paymentMode: true },
    });
    info(`agreementType=${p4?.commercialAgreementType} status=${p4?.commercialAgreementStatus} version=${p4?.commercialAgreementVersion}`);
    info(`privacyVersion=${p4?.privacyPolicyVersion} orgType=${p4?.organisationType} businessModel=${p4?.businessModel} paymentMode=${p4?.paymentMode}`);
    p4?.commercialAgreementType === 'SAAS_TERMS' ? ok('DB: commercialAgreementType=SAAS_TERMS') : fail(`DB: expected SAAS_TERMS, got ${p4?.commercialAgreementType}`);
    p4?.commercialAgreementStatus === 'PENDING' ? ok('DB: commercialAgreementStatus=PENDING') : fail(`DB: expected PENDING, got ${p4?.commercialAgreementStatus}`);
    p4?.commercialAgreementVersion === null ? ok('DB: commercialAgreementVersion=null') : fail(`DB: expected null, got ${p4?.commercialAgreementVersion}`);
    p4?.commercialAgreementAcceptedAt === null ? ok('DB: commercialAgreementAcceptedAt=null') : fail('DB: expected null commercialAgreementAcceptedAt');
    p4?.privacyPolicyVersion === '2.0' ? ok('DB: privacyPolicyVersion=2.0') : fail(`DB: expected 2.0, got ${p4?.privacyPolicyVersion}`);
    p4?.privacyPolicyAcceptedAt !== null ? ok('DB: privacyPolicyAcceptedAt set') : fail('DB: expected non-null privacyPolicyAcceptedAt');
    p4?.organisationType === 'INDIVIDUAL_INSTRUCTOR' ? ok('DB: organisationType=INDIVIDUAL_INSTRUCTOR') : fail(`DB: expected INDIVIDUAL_INSTRUCTOR, got ${p4?.organisationType}`);
    p4?.businessModel === 'SAAS' ? ok('DB: businessModel=SAAS') : fail(`DB: expected SAAS, got ${p4?.businessModel}`);
    p4?.paymentMode === 'DIRECT' ? ok('DB: paymentMode=DIRECT') : fail(`DB: expected DIRECT, got ${p4?.paymentMode}`);
    }
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

  // RT-5DB: Full Provider DB persistence — Non-driving SaaS (Plumber)
  if (r5.status === 201) {
    if (!r5.body?.providerId) { fail('HTTP 201 missing providerId — DB assertions cannot run'); }
    else {
      console.log('\nRT-5DB | Full Provider DB persistence — Plumber (non-driving SaaS)');
    const p5 = await prisma.provider.findUnique({
      where: { id: r5.body.providerId },
      select: { commercialAgreementType: true, commercialAgreementStatus: true, commercialAgreementVersion: true,
                commercialAgreementAcceptedAt: true, privacyPolicyVersion: true, privacyPolicyAcceptedAt: true,
                organisationType: true, businessModel: true, paymentMode: true, industry: true },
    });
    info(`agreementType=${p5?.commercialAgreementType} status=${p5?.commercialAgreementStatus} version=${p5?.commercialAgreementVersion}`);
    info(`privacyVersion=${p5?.privacyPolicyVersion} orgType=${p5?.organisationType} businessModel=${p5?.businessModel} paymentMode=${p5?.paymentMode} industry=${p5?.industry}`);
    p5?.commercialAgreementType === 'SAAS_TERMS' ? ok('DB: commercialAgreementType=SAAS_TERMS') : fail(`DB: expected SAAS_TERMS, got ${p5?.commercialAgreementType}`);
    p5?.commercialAgreementStatus === 'PENDING' ? ok('DB: commercialAgreementStatus=PENDING') : fail(`DB: expected PENDING, got ${p5?.commercialAgreementStatus}`);
    p5?.commercialAgreementVersion === null ? ok('DB: commercialAgreementVersion=null') : fail(`DB: expected null, got ${p5?.commercialAgreementVersion}`);
    p5?.commercialAgreementAcceptedAt === null ? ok('DB: commercialAgreementAcceptedAt=null') : fail('DB: expected null commercialAgreementAcceptedAt');
    p5?.privacyPolicyVersion === '2.0' ? ok('DB: privacyPolicyVersion=2.0') : fail(`DB: expected 2.0, got ${p5?.privacyPolicyVersion}`);
    p5?.privacyPolicyAcceptedAt !== null ? ok('DB: privacyPolicyAcceptedAt set (independent of commercial)') : fail('DB: expected non-null privacyPolicyAcceptedAt');
    p5?.organisationType === 'SOLE_TRADER' ? ok('DB: organisationType=SOLE_TRADER') : fail(`DB: expected SOLE_TRADER, got ${p5?.organisationType}`);
    p5?.businessModel === 'SAAS' ? ok('DB: businessModel=SAAS') : fail(`DB: expected SAAS, got ${p5?.businessModel}`);
    p5?.paymentMode === 'DIRECT' ? ok('DB: paymentMode=DIRECT') : fail(`DB: expected DIRECT, got ${p5?.paymentMode}`);
    p5?.industry === 'plumber' ? ok('DB: industry=plumber') : fail(`DB: expected plumber, got ${p5?.industry}`);
    }
  }

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
