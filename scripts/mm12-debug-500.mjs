/**
 * Debug the MM-12 add-credit 500 on production
 */
import { PrismaClient } from '@prisma/client';
import * as https from 'https';

const PRODUCTION_URL = 'https://drivebook-wheat.vercel.app';
const ADMIN_EMAIL    = 'testadminemi';
const ADMIN_PASSWORD = 'pass';
const CUSTOMER_ID    = 'customerid';

function req(url, options = {}) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0',
      'Accept': 'application/json',
      ...options.headers,
    };
    const r = https.request(url, { ...options, headers }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', reject);
    if (options.body) r.write(options.body);
    r.end();
  });
}

// Authenticate
const csrfRes = await req(`${PRODUCTION_URL}/api/auth/csrf`);
const csrfToken = JSON.parse(csrfRes.body).csrfToken;
const csrfCookies = (csrfRes.headers?.['set-cookie'] ?? []).map(c => c.split(';')[0]).join('; ');
const body = `csrfToken=${encodeURIComponent(csrfToken)}&email=${encodeURIComponent(ADMIN_EMAIL)}&password=${encodeURIComponent(ADMIN_PASSWORD)}`;
const authRes = await req(`${PRODUCTION_URL}/api/auth/callback/credentials`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), 'Cookie': csrfCookies },
  body,
});
const sessionCookie = (authRes.headers?.['set-cookie'] ?? []).find(c => c.includes('session-token'))?.split(';')[0];
console.log('Session cookie obtained:', !!sessionCookie);

// Try a fresh add-credit request
const key = crypto.randomUUID();
const creditBody = JSON.stringify({ amount: 50, reason: 'Debug test' });
const r = await req(`${PRODUCTION_URL}/api/admin/clients/${CUSTOMER_ID}/wallet/add-credit`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(creditBody),
    'Cookie': sessionCookie,
    'Idempotency-Key': key,
  },
  body: creditBody,
});
console.log('Status:', r.status);
console.log('Body:', r.body.substring(0, 500));
