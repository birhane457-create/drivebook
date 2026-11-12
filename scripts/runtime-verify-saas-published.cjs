/**
 * runtime-verify-saas-published.cjs
 *
 * HTTP verification of the SaaS Terms published lifecycle.
 * Requires the dev server running with SaaS Terms published via env vars:
 *
 *   set SAAS_TERMS_PUBLISHED_OVERRIDE=true
 *   set SAAS_TERMS_VERSION_OVERRIDE=1.0
 *   npm run dev
 *
 * Then run:
 *   set DIRECT_URL=<your-db-url>
 *   node scripts/runtime-verify-saas-published.cjs
 *
 * Tests:
 *   SP-1: SaaS without saasTermsAccepted → 400 SAAS_TERMS_REQUIRED
 *   SP-2: SaaS with saasTermsAccepted=false → 400
 *   SP-3: SaaS with saasTermsAccepted=true → 201 ACCEPTED
 *   SP-3DB: Full Provider DB persistence — published SaaS accepted
 *   SP-4: Non-driving SaaS without acceptance → 400
 *   SP-5: Non-driving SaaS with acceptance → 201 ACCEPTED
 */

'use strict';
const http  = require('http');
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
      // Delete Provider first — if this fails, User deletion will fail due to FK
      if (user.providerId) {
        try {
          await prisma.provider.delete({ where: { id: user.providerId } });
        } catch (e) {
          failed++;
          console.error(`  ⚠ Failed to delete Provider ${user.providerId}: ${e.message}`);
          continue; // Skip User deletion — FK relationship will prevent it
        }
      }
      try {
        await prisma.user.delete({ where: { id: user.id } });
        deleted++;
      } catch (e) {
        failed++;
        console.error(`  ⚠ Failed to delete User ${user.id}: ${e.message}`);
      }
    } catch (e) {
      failed++;
      console.error(`  ⚠ Cleanup error for ${email}: ${e.message}`);
    }
  }
  console.log(`  Cleanup: ${deleted} deleted, ${notFound} not found, ${failed} failed`);
  if (failed > 0) {
    console.error('  ⚠ CLEANUP FAILURES — manual deletion may be required');
    process.exitCode = process.exitCode || 1;
  }
  return failed;
}

const created = [];

async function main() {
  console.log('='.repeat(72));
  console.log('Runtime verification — SaaS Terms PUBLISHED lifecycle');
  console.log(`Server: ${BASE_URL}`);
  console.log('='.repeat(72));

  // Verify the server is running with published SaaS terms by checking
  // that a SaaS registration without acceptance is rejected
  const BASE = {
    name: 'SaaS Published Test',
    password: 'TestPass123!',
    phone: '0411111112',
    privacyAccepted: true,
  };

  // ── SP-1: SaaS without saasTermsAccepted → 400 SAAS_TERMS_REQUIRED ──────
  console.log('\nSP-1 | SaaS without saasTermsAccepted → 400 SAAS_TERMS_REQUIRED');
  const email1 = `sp-noaccept-${TIMESTAMP}@sp.test`;
  const r1 = await post('/api/register', {
    ...BASE, email: email1, businessType: 'driving', businessModel: 'SAAS',
  });
  info(`status=${r1.status} code=${r1.body?.code}`);
  r1.status === 400 ? ok('HTTP 400') : fail(`Expected 400, got ${r1.status}: ${JSON.stringify(r1.body)}`);
  r1.body?.code === 'SAAS_TERMS_REQUIRED' ? ok('code=SAAS_TERMS_REQUIRED') : fail(`Expected SAAS_TERMS_REQUIRED, got ${r1.body?.code}`);

  // ── SP-2: SaaS with saasTermsAccepted=false → 400 ────────────────────────
  console.log('\nSP-2 | SaaS with saasTermsAccepted=false → 400');
  const email2 = `sp-false-${TIMESTAMP}@sp.test`;
  const r2 = await post('/api/register', {
    ...BASE, email: email2, businessType: 'driving', businessModel: 'SAAS', saasTermsAccepted: false,
  });
  info(`status=${r2.status} code=${r2.body?.code}`);
  r2.status === 400 ? ok('HTTP 400') : fail(`Expected 400, got ${r2.status}`);
  r2.body?.code === 'SAAS_TERMS_REQUIRED' ? ok('code=SAAS_TERMS_REQUIRED') : fail(`Expected SAAS_TERMS_REQUIRED, got ${r2.body?.code}`);

  // ── SP-3: SaaS with saasTermsAccepted=true → 201 ACCEPTED ───────────────
  console.log('\nSP-3 | SaaS with saasTermsAccepted=true → 201 ACCEPTED');
  const email3 = `sp-accepted-${TIMESTAMP}@sp.test`;
  created.push(email3);
  const r3 = await post('/api/register', {
    ...BASE, email: email3, businessType: 'driving', businessModel: 'SAAS', saasTermsAccepted: true,
  });
  info(`status=${r3.status} commercialAgreementStatus=${r3.body?.commercialAgreementStatus} commercialAgreementVersion=${r3.body?.commercialAgreementVersion}`);
  r3.status === 201 ? ok('HTTP 201') : fail(`Expected 201, got ${r3.status}: ${JSON.stringify(r3.body)}`);
  r3.body?.commercialAgreementStatus === 'ACCEPTED' ? ok('commercialAgreementStatus=ACCEPTED') : fail(`Expected ACCEPTED, got ${r3.body?.commercialAgreementStatus}`);

  // ── SP-3DB: Full Provider DB persistence — published SaaS accepted ──────
  if (r3.status === 201) {
    if (!r3.body?.providerId) { fail('HTTP 201 missing providerId — DB assertions cannot run'); }
    else {
      console.log('\nSP-3DB | Full Provider DB persistence — published SaaS accepted');
    const p3 = await prisma.provider.findUnique({
      where: { id: r3.body.providerId },
      select: { commercialAgreementType: true, commercialAgreementStatus: true, commercialAgreementVersion: true,
                commercialAgreementAcceptedAt: true, privacyPolicyVersion: true, privacyPolicyAcceptedAt: true,
                organisationType: true, businessModel: true, paymentMode: true },
    });
    info(`agreementType=${p3?.commercialAgreementType} status=${p3?.commercialAgreementStatus} version=${p3?.commercialAgreementVersion}`);
    info(`privacyVersion=${p3?.privacyPolicyVersion} orgType=${p3?.organisationType} businessModel=${p3?.businessModel} paymentMode=${p3?.paymentMode}`);
    p3?.commercialAgreementType === 'SAAS_TERMS' ? ok('DB: commercialAgreementType=SAAS_TERMS') : fail(`DB: expected SAAS_TERMS, got ${p3?.commercialAgreementType}`);
    p3?.commercialAgreementStatus === 'ACCEPTED' ? ok('DB: commercialAgreementStatus=ACCEPTED') : fail(`DB: expected ACCEPTED, got ${p3?.commercialAgreementStatus}`);
    p3?.commercialAgreementVersion === '1.0' ? ok('DB: commercialAgreementVersion=1.0') : fail(`DB: expected 1.0, got ${p3?.commercialAgreementVersion}`);
    p3?.commercialAgreementAcceptedAt !== null ? ok('DB: commercialAgreementAcceptedAt set') : fail('DB: expected non-null commercialAgreementAcceptedAt');
    p3?.privacyPolicyVersion === '2.0' ? ok('DB: privacyPolicyVersion=2.0') : fail(`DB: expected 2.0, got ${p3?.privacyPolicyVersion}`);
    p3?.privacyPolicyAcceptedAt !== null ? ok('DB: privacyPolicyAcceptedAt set') : fail('DB: expected non-null privacyPolicyAcceptedAt');
    p3?.organisationType === 'INDIVIDUAL_INSTRUCTOR' ? ok('DB: organisationType=INDIVIDUAL_INSTRUCTOR') : fail(`DB: expected INDIVIDUAL_INSTRUCTOR, got ${p3?.organisationType}`);
    p3?.businessModel === 'SAAS' ? ok('DB: businessModel=SAAS') : fail(`DB: expected SAAS, got ${p3?.businessModel}`);
    p3?.paymentMode === 'DIRECT' ? ok('DB: paymentMode=DIRECT') : fail(`DB: expected DIRECT, got ${p3?.paymentMode}`);
    // Legacy User.terms* must remain null even when SaaS terms are published
    const u3 = await prisma.user.findUnique({ where: { email: email3 }, select: { termsAcceptedAt: true, termsVersion: true } });
    u3?.termsAcceptedAt === null ? ok('DB: User.termsAcceptedAt=null (SaaS isolation maintained)') : fail('DB: expected null User.termsAcceptedAt');
    u3?.termsVersion === null ? ok('DB: User.termsVersion=null (SaaS isolation maintained)') : fail(`DB: expected null, got ${u3?.termsVersion}`);
    }
  }

  // ── SP-4: Non-driving SaaS without acceptance → 400 ─────────────────────
  console.log('\nSP-4 | Non-driving SaaS without saasTermsAccepted → 400');
  const email4 = `sp-plumber-no-${TIMESTAMP}@sp.test`;
  const r4 = await post('/api/register', {
    ...BASE, email: email4, businessType: 'plumber',
  });
  info(`status=${r4.status} code=${r4.body?.code}`);
  r4.status === 400 ? ok('HTTP 400') : fail(`Expected 400, got ${r4.status}`);
  r4.body?.code === 'SAAS_TERMS_REQUIRED' ? ok('code=SAAS_TERMS_REQUIRED') : fail(`Expected SAAS_TERMS_REQUIRED, got ${r4.body?.code}`);

  // ── SP-5: Non-driving SaaS with acceptance → 201 ACCEPTED ──────────────
  console.log('\nSP-5 | Non-driving SaaS with saasTermsAccepted=true → 201 ACCEPTED');
  const email5 = `sp-plumber-yes-${TIMESTAMP}@sp.test`;
  created.push(email5);
  const r5 = await post('/api/register', {
    ...BASE, email: email5, businessType: 'plumber', saasTermsAccepted: true,
  });
  info(`status=${r5.status} commercialAgreementStatus=${r5.body?.commercialAgreementStatus}`);
  r5.status === 201 ? ok('HTTP 201') : fail(`Expected 201, got ${r5.status}: ${JSON.stringify(r5.body)}`);
  r5.body?.commercialAgreementStatus === 'ACCEPTED' ? ok('commercialAgreementStatus=ACCEPTED') : fail(`Expected ACCEPTED, got ${r5.body?.commercialAgreementStatus}`);
  r5.body?.organisationType === 'SOLE_TRADER' ? ok('organisationType=SOLE_TRADER') : fail(`Expected SOLE_TRADER, got ${r5.body?.organisationType}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(72));
  console.log(`SaaS published verification complete. Exit code: ${process.exitCode ?? 0}`);
  if (!process.exitCode) console.log('All SaaS published checks passed.');
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
