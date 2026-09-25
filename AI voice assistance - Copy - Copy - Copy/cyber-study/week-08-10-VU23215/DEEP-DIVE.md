# VU23215 — Deep Dive: Security Testing Every Term with Real Code

## Why security testing exists

You cannot know your system is secure by reading the code. You must actively try to break it. Security testing is structured adversarial thinking — you become the attacker, document what you find, and then fix it.

---

## TERM: Vulnerability

**What it is:** A weakness in a system that can be exploited by a threat actor.

**Why you need it:** Every security finding you document is a vulnerability. Your OWASP assessment identified vulnerabilities in DriveBook.

**Vulnerability vs Threat vs Risk:**
```
ASSET:        DriveBook user database (instructor bank details)
VULNERABILITY: No MFA on instructor accounts
THREAT:        Credential stuffing attack using leaked passwords
RISK:          Attacker logs into instructor account, changes bank details,
               pockets next payout = financial harm

RISK = LIKELIHOOD × IMPACT
Likelihood: Medium (instructor credentials likely in breach dumps)
Impact: High (direct financial loss, legal liability)
Risk Score: High
```

---

## TERM: OWASP (Open Web Application Security Project)

**What it is:** A non-profit that maintains free, open security standards and tools. Their Top 10 is the most referenced list of web vulnerabilities globally.

**Why it matters:** Every web security certification references OWASP. Your assessor will ask you to name and explain Top 10 items.

**Full OWASP Top 10 with code examples:**

---

### A01: Broken Access Control

**Definition:** Users can access resources or perform actions beyond their intended permissions.

**Why it happens:** Developers check authentication (are you logged in?) but forget authorisation (are you allowed to do THIS?).

**Vulnerable code:**
```typescript
// BAD — no ownership check
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const booking = await prisma.booking.findUnique({ where: { id: params.id } })
  return NextResponse.json(booking)  // ← returns ANY booking to ANY logged-in user
}
```

**Attack:**
```
GET /api/bookings/booking-123   ← legitimate user's booking
GET /api/bookings/booking-456   ← another user's booking — also works!
```

**Fixed code (DriveBook pattern):**
```typescript
// GOOD — verify ownership
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.instructorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const booking = await prisma.booking.findUnique({
    where: {
      id: params.id,
      instructorId: session.user.instructorId  // ← MUST belong to this instructor
    }
  })
  
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(booking)
}
```

**Testing for it:**
```
1. Log in as Instructor A
2. Note a booking ID belonging to Instructor B
3. Call GET /api/bookings/[instructor-B-booking-id]
4. If you get the booking data → VULNERABLE
5. If you get 403 or 404 → FIXED
```

---

### A02: Cryptographic Failures

**Definition:** Sensitive data exposed because it is stored or transmitted without adequate encryption, or using weak cryptographic algorithms.

**Why it happens:** Developers use whatever is convenient — MD5 for passwords, HTTP for forms, localStorage for tokens.

**Vulnerable patterns:**
```typescript
// BAD 1: MD5 password hashing (broken algorithm — collisions found, rainbow tables exist)
const hash = crypto.createHash('md5').update(password).digest('hex')

// BAD 2: Storing password in plain text
await prisma.user.create({ data: { email, password } })  // no hashing at all

// BAD 3: Storing JWT in localStorage (accessible to JavaScript → XSS vulnerability)
localStorage.setItem('token', jwtToken)

// BAD 4: Sensitive data in URL
GET /api/bookings?token=eyJhbGciOiJIUzI1NiJ9...  // appears in server logs, browser history
```

**DriveBook correct patterns:**
```typescript
// GOOD 1: bcrypt with work factor
const hashedPassword = await bcrypt.hash(password, 10)  // 10 = 2^10 iterations

// GOOD 2: HttpOnly cookie — not accessible to JavaScript
cookies: {
  sessionToken: {
    name: '__Secure-next-auth.session-token',
    options: {
      httpOnly: true,    // ← JavaScript cannot read this
      secure: true,      // ← only sent over HTTPS
      sameSite: 'lax',   // ← CSRF protection
    }
  }
}
```

**Why bcrypt over SHA-256:**
```
SHA-256:
- Designed for speed (10 billion hashes/second on modern GPU)
- An attacker with your database can try 10B passwords/second
- "password123" cracked in microseconds

bcrypt with work factor 10:
- Deliberately slow (2^10 = 1,024 iterations)
- ~10 hashes/second on same GPU
- "password123" takes 10 million seconds to crack
- Work factor can be increased as hardware gets faster
```

---

### A03: Injection

**Definition:** User-supplied data is interpreted as code or commands by the application.

**Types:**
- SQL injection — user input becomes SQL
- Command injection — user input becomes OS commands
- LDAP injection — user input manipulates directory queries
- XSS (Cross-Site Scripting) — user input becomes JavaScript

**SQL Injection — step by step:**

```sql
-- Vulnerable query (string concatenation):
"SELECT * FROM users WHERE email = '" + userEmail + "'"

-- Attacker enters as email:
' OR '1'='1

-- Query becomes:
SELECT * FROM users WHERE email = '' OR '1'='1'
-- '1'='1' is always true → returns ALL users

-- Attacker enters:
'; DROP TABLE users; --

-- Query becomes:
SELECT * FROM users WHERE email = ''; DROP TABLE users; --'
-- Destroys the users table!
```

**Why DriveBook is safe:**
```typescript
// Prisma NEVER does string concatenation
// It uses parameterised queries internally

await prisma.user.findUnique({
  where: { email: userEmail }  // userEmail is a PARAMETER, not concatenated string
})

// What Prisma sends to PostgreSQL:
// SELECT * FROM "User" WHERE email = $1
// Parameters: [$1 = "whatever the user typed"]
// Even if userEmail = "'; DROP TABLE users; --"
// It's treated as data, not SQL code
```

**XSS (Cross-Site Scripting) — step by step:**
```
1. Attacker posts a review: <script>document.cookie</script>
2. Vulnerable site stores this without sanitisation
3. When any user views the review, the browser executes the script
4. Script steals the victim's session cookie and sends it to attacker's server
5. Attacker uses stolen cookie to log in as victim

PROTECTION: Never render user input as raw HTML
React (used in DriveBook) escapes HTML by default:
  <p>{userInput}</p>
  ← React automatically converts < > to &lt; &gt;
  ← The text is displayed, not executed

WARNING: dangerouslySetInnerHTML bypasses this — never use with user input
```

---

### A04: Insecure Design

**Definition:** Security flaws that exist because the system was designed without security in mind — not just implementation bugs.

**Example 1 — No rate limiting (design flaw):**
```
System designed without considering: "What if someone tries 1 million passwords?"
No lockout, no rate limiting → brute force is trivially possible

FIX: Design the authentication flow WITH rate limiting from the start
```

**Example 2 — Short-notice booking design:**
```
DriveBook design decision: short-notice bookings (< 2 hours) require instructor approval
If NOT designed this way: attackers could spam the booking system filling all slots
The isShortNotice flag in the booking schema = secure design decision
```

**Code showing secure design:**
```typescript
// business_rules.ts - security baked into the design
const SHORT_NOTICE_THRESHOLD_HOURS = 2

function isShortNotice(startTime: Date): boolean {
  const hoursUntilLesson = (startTime.getTime() - Date.now()) / 3_600_000
  return hoursUntilLesson < SHORT_NOTICE_THRESHOLD_HOURS
}

// Booking creation checks this:
if (isShortNotice(scheduledStart)) {
  booking.status = 'PENDING'      // requires instructor approval
  booking.requiresApproval = true // no payment until approved
} else {
  booking.status = 'PENDING_PAYMENT'  // normal flow
}
```

---

### A05: Security Misconfiguration

**Definition:** Default settings, unnecessary features enabled, missing headers, verbose error messages in production.

**What to check:**

**HTTP Security Headers:**
```typescript
// next.config.js — DriveBook has these:
headers: [
  { key: 'X-Frame-Options', value: 'DENY' },
  // ↑ Prevents your site being embedded in an iframe (clickjacking)

  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // ↑ Browser must use declared content-type, not sniff it
  // Prevents: serving a .txt file that contains JavaScript
  
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // ↑ Controls how much URL info is sent to other sites
  
  // MISSING — should add:
  { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' ..." },
  // ↑ Whitelist of where scripts/styles can load from — blocks XSS
]
```

**Production vs Development errors:**
```typescript
// BAD in production:
res.status(500).json({
  error: 'Database connection failed',
  stack: 'Error: connect ECONNREFUSED\n    at TCPConnectWrap...',  // exposes internals
  query: 'SELECT * FROM "User" WHERE...',  // exposes table names
})

// GOOD — Next.js automatically does this with NODE_ENV=production:
res.status(500).json({ error: 'Internal Server Error' })
```

**Checking for misconfiguration:**
```bash
# Run Nikto against your dev server:
nikto -h http://localhost:3000

# It checks for:
# - Missing security headers
# - Default files/directories (/.git, /robots.txt, /phpinfo.php)
# - Outdated server software
# - Known vulnerabilities in detected software versions
```

---

### A07: Authentication Failures

**Definition:** Problems with login, session management, or credential handling.

**Credential Stuffing Attack — step by step:**
```
1. Data breach at another company exposes 10 million email/password pairs
2. Attacker buys this list from dark web marketplace
3. Attacker runs automated tool (e.g., Sentry MBA, Openbullet):
   - Tries every email/password against drivebook.com.au/api/auth/signin
   - Tool varies delays to avoid rate limiting
   - Uses residential proxy IPs to rotate between attempts

4. Even if only 0.5% reuse the same password:
   10,000,000 × 0.005 = 50,000 compromised DriveBook accounts

PROTECTION:
1. Rate limit: authRateLimit → 5 attempts per 15 minutes per IP (implemented ✓)
2. Detect unusual patterns: same IP, many different emails, all failing
3. Add CAPTCHA on repeated failures
4. Notify user of login from new device/IP
5. Implement MFA (not yet implemented in DriveBook)
```

**Session Token Security — what makes a token safe:**
```typescript
// NextAuth generates session tokens using:
// 1. Cryptographically random (not guessable)
crypto.randomBytes(32)  // 256 bits of randomness

// 2. Signed with NEXTAUTH_SECRET
// Even if attacker guesses the content, they can't produce a valid signature
// without the secret

// 3. HttpOnly — cannot be stolen via XSS
// 4. Secure — only sent over HTTPS
// 5. Short expiry — 7 days, not 30 days (smaller window if stolen)
// 6. Rotating — each request gets a refreshed token
```

---

### A08: Software and Data Integrity

**Definition:** Code and data that can be modified or replaced without detection.

**Stripe Webhook Signature Verification — full explanation:**

```typescript
// app/api/stripe/webhook/route.ts

export async function POST(req: NextRequest) {
  const body = await req.text()  // ← raw body, NOT parsed JSON
  const sig = req.headers.get('stripe-signature')
  
  let event: Stripe.Event
  try {
    // Stripe signs every webhook payload with HMAC-SHA256
    // using your STRIPE_WEBHOOK_SECRET
    event = stripe.webhooks.constructEvent(body, sig!, webhookSecret)
    // ↑ If the signature doesn't match, this THROWS an error
    
  } catch (err) {
    // This happens if:
    // 1. Body was tampered with (signature won't match)
    // 2. Wrong webhook secret (can't verify)
    // 3. Replay attack (timestamp too old — Stripe includes timestamp in signature)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }
  
  // Only reach here if signature verified
  // Now safe to process the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object)
      break
  }
}
```

**Why this matters:**
```
WITHOUT signature verification:
Attacker POST /api/stripe/webhook with:
{ "type": "payment_intent.succeeded", "data": { "amount": 83916 } }

If accepted → attacker can trigger wallet credits without paying anything!

WITH signature verification:
Attacker's request has no valid Stripe signature → rejected immediately
Only real Stripe webhooks signed with your secret are processed
```

---

## TERM: CVSS Score

**What it is:** Common Vulnerability Scoring System. A standardised way to rate the severity of a vulnerability from 0.0 to 10.0.

**Why you need it:** Every professional pen test report includes CVSS scores. Assessors expect you to rate your findings.

**CVSS v3.1 Score Components:**

```
BASE SCORE (0-10):
├── Attack Vector (AV)
│   ├── Network (N)    = 3.9   ← remotely exploitable, highest risk
│   ├── Adjacent (A)   = 2.8   ← same network required
│   ├── Local (L)      = 2.1   ← local access required
│   └── Physical (P)   = 0.85  ← physical access required
│
├── Attack Complexity (AC)
│   ├── Low (L)        = 0.77  ← no special conditions needed
│   └── High (H)       = 0.44  ← requires specific conditions
│
├── Privileges Required (PR)
│   ├── None (N)       = 0.85  ← no authentication needed
│   ├── Low (L)        = 0.62  ← basic auth needed
│   └── High (H)       = 0.27  ← admin access needed
│
├── Confidentiality Impact (C): None/Low/High
├── Integrity Impact (I):       None/Low/High
└── Availability Impact (A):    None/Low/High
```

**Example CVSS score for a DriveBook finding:**

```
Finding: Missing MFA on instructor accounts

AV: Network (N)           ← exploitable from internet
AC: Low (L)               ← just need a valid password
PR: None (N)              ← no current auth needed
UI: None (N)              ← no user interaction
Scope: Unchanged
Confidentiality: High     ← bank details exposed
Integrity: High           ← payout destination changeable
Availability: None        ← doesn't affect availability

CVSS Score: 9.1 (Critical)

Meaning: "This is extremely serious. Fix immediately."
```

---

## TERM: Penetration Test Report Structure

Every finding follows this exact format:

```markdown
## Finding 001: Missing Multi-Factor Authentication on Instructor Accounts

**Severity:** Critical (CVSS 9.1)
**Category:** A07 – Identification and Authentication Failures

**Description:**
Instructor accounts do not require a second authentication factor beyond a password.
If an instructor's password is compromised (via credential stuffing, phishing, or
reuse from another breached service), an attacker can fully access the account
including the ability to change payout bank account details.

**Affected Component:**
- `/api/auth/callback/credentials` (login endpoint)
- `/app/dashboard/settings` (bank details page)

**Steps to Reproduce:**
1. Navigate to drivebook.com.au/login
2. Enter a valid instructor email and password
3. Observe: login succeeds without any second factor challenge
4. Navigate to /dashboard/settings — payout bank details are fully accessible

**Evidence:**
[Screenshot of successful login with no MFA prompt]
[Screenshot of bank details page accessible]

**Risk:**
- An attacker with a compromised password gains full account access
- They can redirect weekly payouts to their own bank account
- The instructor has no way to know until they miss a payout

**Remediation:**
Add TOTP-based MFA as an optional (initially) then mandatory step for:
1. Any login from a new device or IP
2. Any change to payout bank account details
3. Any change to email address or password

Recommended implementation: next-auth with TOTP via `otplib` library
Timeline: High priority — complete before instructor count exceeds 50

**Verification:**
After fix: attempt login — MFA challenge appears.
Attempt to change bank details without MFA — blocked.
```

---

## TERM: Common Security Tools

### Nmap — Network Scanner

**What it does:** Discovers open ports, running services, and operating system versions.

**Step-by-step usage:**
```bash
# Basic scan — find open ports
nmap localhost

# Service version scan
nmap -sV localhost

# Scan specific ports
nmap -p 3000,3001,5432 localhost

# Example output:
PORT     STATE  SERVICE   VERSION
3000/tcp open   http      Next.js dev server
3001/tcp open   http      Node.js (Express)
5432/tcp closed postgresql  ← closed from your machine (only Vercel can reach it)
```

**What an attacker learns:** What services are running and their versions. If version has a known CVE, that's the attack vector.

---

### Burp Suite — Web Proxy

**What it does:** Sits between your browser and the web app. You can:
- Intercept every request
- Modify parameters before they reach the server
- Replay requests
- Fuzz parameters with many values

**Step-by-step — testing for IDOR (Broken Access Control):**
```
1. Open Burp Suite → Proxy → Intercept ON
2. In browser: navigate to your booking at /api/bookings/booking-abc123
3. Burp captures the GET request
4. Modify the URL: /api/bookings/booking-xyz789 (another booking ID)
5. Forward the modified request
6. If you get the other booking's data → IDOR vulnerability confirmed
```

---

### OWASP ZAP — Automated Scanner

**What it does:** Automated vulnerability scanner for web applications.

**Step-by-step:**
```
1. Start OWASP ZAP
2. Set target URL: http://localhost:3000
3. Run "Active Scan"
4. ZAP automatically tests for:
   - SQL injection in all form fields
   - XSS in all form fields
   - Missing security headers
   - Open redirects
   - Path traversal
   - Directory listing
5. Review findings — HIGH/MEDIUM/LOW/INFORMATIONAL
6. Fix each HIGH finding before going to production
```

---

### npm audit — Dependency Scanner

**What it does:** Checks all your npm packages against the National Vulnerability Database.

**Step-by-step:**
```bash
cd drivebook
npm audit

# Example output:
found 3 vulnerabilities (1 moderate, 2 high)

# high severity:
# CVE-2024-12345 in package 'some-package'
# Path: drivebook > some-package
# Fix: npm update some-package
# Or: npm audit fix

# To fix automatically:
npm audit fix

# To see full details:
npm audit --json
```

**Why it matters:** Supply chain attacks (A06) target outdated dependencies. `npm audit` is your first defence.

---

## TERM: CVSS vs Risk Ratings

In your pen test report, you must explain the difference:

```
CVSS Score: Technical severity of the vulnerability in isolation
Risk Rating: Business impact to YOUR organisation

CVSS 9.1 (Critical) doesn't automatically mean Critical for you:
- If the vulnerable feature is disabled: CVSS 9.1, actual risk = Low
- If your app has no users yet: CVSS 9.1, actual risk = Low (no one to attack)

CVSS 3.0 (Medium) might be Critical for you:
- If the medium vulnerability exposes payout bank details for 1,000 instructors
- Business risk = Critical (regulatory breach, financial liability)

Your report must document BOTH:
"CVSS: 9.1 (Critical) — Actual business risk: High
Rationale: Platform currently has fewer than 10 instructors;
however, exploitation would allow complete account takeover
and payout redirection. Treat as High priority given financial impact."
```
