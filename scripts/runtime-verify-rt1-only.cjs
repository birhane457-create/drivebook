'use strict';
const http  = require('http');
const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient();

const TIMESTAMP = Date.now();

async function post(path, body, ip) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = {
      hostname: 'localhost', port: 3000, path, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-forwarded-for': ip || `10.0.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`,
      },
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
    req.setTimeout(120000, () => { req.destroy(new Error('Request timeout')); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('RT-1 retry: Marketplace + termsAccepted=true (timeout raised to 30s)');
  const email = `rt1-retry-${TIMESTAMP}@rt.test`;
  const r = await post('/api/register', {
    name: 'Runtime Test', password: 'TestPass123!', phone: '0411111111',
    privacyAccepted: true, businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: true,
    email,
  });
  console.log(`  status=${r.status} commercialAgreementStatus=${r.body?.commercialAgreementStatus} organisationType=${r.body?.organisationType}`);
  if (r.status === 201) {
    console.log('  ✅ HTTP 201');
    if (r.body?.commercialAgreementStatus === 'ACCEPTED') console.log('  ✅ commercialAgreementStatus=ACCEPTED');
    else console.log(`  ❌ Expected ACCEPTED, got ${r.body?.commercialAgreementStatus}`);
    if (r.body?.organisationType === 'INDIVIDUAL_INSTRUCTOR') console.log('  ✅ organisationType=INDIVIDUAL_INSTRUCTOR');
    // Verify DB
    const user = await prisma.user.findUnique({ where: { email }, select: { termsAcceptedAt: true, termsVersion: true, provider: { select: { commercialAgreementStatus: true, commercialAgreementVersion: true, privacyPolicyVersion: true, organisationType: true } } } });
    if (user?.termsAcceptedAt) console.log('  ✅ User.termsAcceptedAt set (Marketplace)');
    if (user?.termsVersion === '2.0') console.log('  ✅ User.termsVersion=2.0');
    if (user?.provider?.commercialAgreementStatus === 'ACCEPTED') console.log('  ✅ Provider.commercialAgreementStatus=ACCEPTED');
    if (user?.provider?.commercialAgreementVersion === '2.0') console.log('  ✅ Provider.commercialAgreementVersion=2.0');
    if (user?.provider?.privacyPolicyVersion === '2.0') console.log('  ✅ Provider.privacyPolicyVersion=2.0');
    if (user?.provider?.organisationType === 'INDIVIDUAL_INSTRUCTOR') console.log('  ✅ Provider.organisationType=INDIVIDUAL_INSTRUCTOR');
    // Cleanup
    if (user && user?.provider) {
      const p = await prisma.user.findUnique({ where: { email }, select: { providerId: true } });
      if (p?.providerId) await prisma.provider.delete({ where: { id: p.providerId } }).catch(() => {});
      await prisma.user.delete({ where: { email } }).catch(() => {});
      console.log('  Cleaned up test account.');
    }
  } else {
    console.log(`  ❌ Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
  }
}

main()
  .catch(e => { console.error(e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
