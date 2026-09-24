/**
 * Isolate the Check 4 failure — single add-credit after wallet reset
 */
import { PrismaClient } from '@prisma/client';
import * as https from 'https';

const PRODUCTION_URL = 'https://drivebook-wheat.vercel.app';
const ADMIN_EMAIL    = 'mm12-prod-verify-admin@test.internal';
const ADMIN_PASSWORD = 'mm12-prod-verify-pass-2026';

// Get a fresh customer for this test only
const prisma = new PrismaClient();
const customer = await prisma.customer.findFirst({
  where: { email: 'mm12-prod-verify-customer@test.internal' },
  select: { id: true, userId: true },
});
if (!customer) { console.log('No customer found'); process.exit(1); }
const wallet = await prisma.clientWallet.findUnique({ where: { userId: customer.userId }, select: { id: true, balance: true } });
console.log('Customer:', customer.id, 'Wallet:', wallet?.id, 'Balance:', wallet?.balance);

function httpReq(url, options = {}) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0', 'Accept': 'application/json', ...options.headers };
    const r = https.request(url, { ...options, headers }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d, headers: res.headers }));
    });
    r.on('error', reject);
    if (options.body) r.write(options.body);
    r.end();
  });
}

// Auth
const csrfRes = await httpReq(`${PRODUCTION_URL}/api/auth/csrf`);
const csrfToken = JSON.parse(csrfRes.body).csrfToken;
const csrfCookies = (csrfRes.headers['set-cookie'] ?? []).map(c => c.split(';')[0]).join('; ');
const body = `csrfToken=${encodeURIComponent(csrfToken)}&email=${encodeURIComponent(ADMIN_EMAIL)}&password=${encodeURIComponent(ADMIN_PASSWORD)}`;
const authRes = await httpReq(`${PRODUCTION_URL}/api/auth/callback/credentials`, {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), 'Cookie': csrfCookies }, body,
});
const sessionCookie = (authRes.headers['set-cookie'] ?? []).find(c => c.includes('session-token'))?.split(';')[0];
console.log('Authenticated:', !!sessionCookie, sessionCookie?.substring(0, 40));

// Single credit
const key = crypto.randomUUID();
const creditBody = JSON.stringify({ amount: 10, reason: 'Debug check 4' });
const r = await httpReq(`${PRODUCTION_URL}/api/admin/clients/${customer.id}/wallet/add-credit`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(creditBody), 'Cookie': sessionCookie, 'Idempotency-Key': key },
  body: creditBody,
});
console.log('Status:', r.status);
console.log('Body:', r.body.substring(0, 300));

await prisma.$disconnect();
