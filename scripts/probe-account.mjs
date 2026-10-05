/**
 * Probe whether an account exists and attempt login.
 * Usage: node scripts/probe-account.mjs <email> <password>
 */
import https from 'https';

const [,, EMAIL = 'birhane157@gmail.com', PASSWORD = 'Test123456!'] = process.argv;
const BASE = 'https://drivebook-wheat.vercel.app';

function req(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0', ...opts.headers };
    const r = https.request(url, { ...opts, headers }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    r.on('error', reject);
    r.setTimeout(25000, () => { r.destroy(); reject(new Error('timeout')); });
    if (opts.body) r.write(opts.body);
    r.end();
  });
}

console.log(`Probing: ${EMAIL}`);

// Step 1: CSRF
const csrfRes = await req(`${BASE}/api/auth/csrf`);
const csrfToken = JSON.parse(csrfRes.body).csrfToken;
const csrfCookies = (csrfRes.headers['set-cookie'] ?? []).map(c => c.split(';')[0]).join('; ');
console.log('CSRF token obtained:', !!csrfToken);

// Step 2: Login attempt
const body = `csrfToken=${encodeURIComponent(csrfToken)}&email=${encodeURIComponent(EMAIL)}&password=${encodeURIComponent(PASSWORD)}`;
const authRes = await req(`${BASE}/api/auth/callback/credentials`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body),
    'Cookie': csrfCookies,
  },
  body,
});

const allCookies = authRes.headers['set-cookie'] ?? [];
const sessionRaw = allCookies.find(c => c.includes('session-token'));
const location   = authRes.headers['location'] ?? '(no redirect)';
const cookieNames = allCookies.map(c => c.split('=')[0]).join(', ') || '(none)';

console.log(`Login HTTP:   ${authRes.status}`);
console.log(`Redirect:     ${location}`);
console.log(`Cookies:      ${cookieNames}`);
console.log(`Session:      ${sessionRaw ? sessionRaw.split(';')[0].substring(0, 60) + '...' : 'NOT FOUND'}`);

if (sessionRaw) {
  // Step 3: Verify session
  const sesRes = await req(`${BASE}/api/auth/session`, {
    headers: { Cookie: sessionRaw.split(';')[0] },
  });
  const sesData = JSON.parse(sesRes.body);
  console.log(`\nSession user: ${JSON.stringify(sesData.user ?? '(empty)')}`);
  console.log('\n✅ LOGIN SUCCEEDED');
} else if (location.includes('error=')) {
  const err = decodeURIComponent(location.split('error=')[1] ?? '');
  console.log(`\n❌ LOGIN FAILED — ${err}`);
} else {
  console.log('\n❌ LOGIN FAILED — no session cookie, unknown reason');
}
