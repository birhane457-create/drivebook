# VU23220 — Deep Dive: Cyber Security Industry Project

## Who this is for

This unit is the capstone of the entire certificate. It brings together every concept from
every unit and asks you to apply them to a real system.

If you are new to security: start at "Level 1 — Foundations" in each section.
If you have been coding for years: jump to "Level 3 — Advanced" where relevant.
The DriveBook examples are real files — every code snippet shown here exists in the repo.

---

## PART 1 — WHAT IS A SECURITY PROJECT?

### Level 1 — Absolute Beginner

A security project is simply this: you look at a system, you find the weaknesses, you
fix the most important ones, and you write it all down.

Think of it like a safety inspection of a building.
The inspector walks through, checks the locks, the fire exits, the wiring.
They write down every problem they find, rate how dangerous each one is, and
recommend what to fix first.

You are the inspector. DriveBook is the building.

**The three questions you must answer:**
```
1. What could go wrong?          ← Risk Assessment
2. How bad would it be?          ← Impact Rating
3. What did I do about it?       ← Remediation
```

### Level 2 — Intermediate

The formal process is structured as a penetration test or security audit.
Both follow the same phases:

```
PHASE 1: SCOPE AND PLANNING
  Define: what systems are in scope?
  Define: what test methods are allowed?
  Define: what is NOT in scope?

PHASE 2: RECONNAISSANCE (information gathering)
  Passive: read code, read docs, map the attack surface
  Active: run scanners, probe endpoints (only against your own system)

PHASE 3: VULNERABILITY IDENTIFICATION
  Match what you found against known vulnerability classes (OWASP Top 10)

PHASE 4: RISK ASSESSMENT
  Rate each finding by likelihood and impact

PHASE 5: REMEDIATION
  Fix the high-priority findings

PHASE 6: VERIFICATION
  Re-test to confirm each fix works

PHASE 7: REPORTING
  Document everything in a formal report
```

### Level 3 — Advanced

A professional penetration test also includes:
- Threat modelling using STRIDE or PASTA frameworks
- Attack chain mapping (how findings could be combined for greater impact)
- CVSS v3.1 scoring for each finding
- Remediation verification with proof-of-fix evidence
- Executive summary for non-technical readers
- Technical appendix with raw tool output

Your assessment needs to reach at least Level 2 quality.
Including Level 3 elements will distinguish your report.

---

## PART 2 — SCOPE DEFINITION

### Level 1 — Absolute Beginner

Scope means: "what am I allowed to test?"

This matters legally. Testing a system you don't own without permission is a crime under
the Criminal Code Act 1995 (s478.1). Since DriveBook is your own platform, you are
authorised to test everything.

But you still write it down — because the assessor needs to see you understand the concept.

**Your scope document (fill in the blanks):**
```
PROJECT TITLE: Cyber Security Hardening for DriveBook.com.au

AUTHORISATION:
  System owner: Debesay Weldegebriel Birhane
  Role: Founder and sole developer
  Written authorisation: Self-authorised (own system)

IN SCOPE:
  ✓ Main web application (drivebook.com.au) — Vercel hosted
  ✓ Hybrid voice service — Railway hosted
  ✓ Database (Supabase PostgreSQL)
  ✓ Source code (GitHub repository)
  ✓ Infrastructure configuration (.env, next.config.js, Prisma schema)

OUT OF SCOPE:
  ✗ Stripe's infrastructure (you can test your integration, not Stripe itself)
  ✗ Supabase's infrastructure (same reason)
  ✗ Vercel's infrastructure
  ✗ Social engineering attacks against real customers
  ✗ Production database (use a test environment for destructive tests)

TEST METHODS ALLOWED:
  ✓ Static code analysis (reading the code)
  ✓ Automated scanning (OWASP ZAP, npm audit, Nikto)
  ✓ Manual testing (Burp Suite, curl, browser dev tools)
  ✓ Review of configuration files

RULES OF ENGAGEMENT:
  - Do not test on production with real user data
  - Do not export or copy real customer data
  - All findings to be remediated before public launch

DATES: [Your study period dates]
TESTER: Debesay Weldegebriel Birhane (self-assessment)
```

### Level 2 — Intermediate

The scope also defines what testing METHODS you will use. Different tools reveal different things:

```
TOOL              WHAT IT FINDS                      TIME REQUIRED
npm audit         Known CVEs in dependencies         5 minutes
OWASP ZAP         Automated web vulnerability scan   30 minutes setup
Burp Suite        Manual request interception        Ongoing during test
Nikto             Web server misconfiguration        10 minutes
Manual code review Logic flaws, auth gaps            Hours
Prisma schema review Data model exposure             30 minutes
.env review       Secret management issues           10 minutes
```

### Level 3 — Advanced

Professional engagements also define:
- **Escalation path**: who to call if you find evidence of an existing breach
- **Safe harbour clause**: legal protection for the tester
- **Data handling**: what happens to vulnerability details after the engagement
- **Liability cap**: what the tester is responsible for if something goes wrong

---

## PART 3 — RECONNAISSANCE (KNOW YOUR SYSTEM)

### Level 1 — Absolute Beginner

Before you look for problems, you need to understand what you have.
This is called reconnaissance or "recon". You are mapping the system.

Think of it like drawing a map of a building before doing the safety inspection.

**Simple system map for DriveBook:**
```
Who can use the system?
  → Public (not logged in): browse instructors, read prices
  → Student: book lessons, manage bookings, pay
  → Instructor: manage schedule, see bookings, get paid
  → Admin: see everything, manage everyone

Where does data come from?
  → User fills in a form in the browser
  → Browser sends form data to the server (an API endpoint)
  → Server validates the data
  → Server writes to the database
  → Server sends a response back

Where does data go?
  → Database: stores bookings, users, payments
  → Stripe: processes real money
  → Cloudinary: stores uploaded documents (photos, licences)
  → Twilio: sends SMS messages
  → VAPI: handles phone calls
```

### Level 2 — Intermediate

More precise system map — every external entry point:

```
ENTRY POINTS (internet-facing, publicly reachable):
┌──────────────────────────────────────────────────────────────────┐
│ ROUTE                             │ AUTH? │ METHOD │ RISK LEVEL  │
├───────────────────────────────────┼───────┼────────┼─────────────┤
│ /api/auth/signin                  │ No    │ POST   │ HIGH        │
│ /api/auth/register                │ No    │ POST   │ HIGH        │
│ /api/instructors                  │ No    │ GET    │ LOW         │
│ /api/instructors/[id]             │ No    │ GET    │ MEDIUM      │
│ /api/verifications/otp            │ Partial│ POST  │ HIGH        │
│ /api/stripe/webhook               │ No*   │ POST   │ HIGH        │
│ /api/bookings                     │ Yes   │ POST   │ HIGH        │
│ /api/admin/*                      │ Admin │ *      │ CRITICAL    │
│ /api/instructor/*                 │ Instr.│ *      │ HIGH        │
└───────────────────────────────────┴───────┴────────┴─────────────┘
  * Stripe webhook uses signature verification instead of session auth
```

**How to build this map yourself:**
```bash
# List every API route in the project
dir /s /b "e:\DOC\AI voice assistance - Copy\drivebook\app\api" | findstr "route.ts"

# You will see output like:
# ...\app\api\auth\signin\route.ts
# ...\app\api\bookings\route.ts
# ...\app\api\admin\clients\route.ts
# ... etc.
```

Each file is an endpoint. Each endpoint is a potential attack vector.
Your job is to read each one and ask: "Could someone misuse this?"

### Level 3 — Advanced

**STRIDE threat modelling on the booking flow:**

STRIDE is a framework for systematically identifying threats.
Each letter is a threat category:

```
S — Spoofing (pretending to be someone else)
T — Tampering (modifying data)
R — Repudiation (denying you did something)
I — Information Disclosure (seeing data you shouldn't)
D — Denial of Service (making the service unavailable)
E — Elevation of Privilege (getting more access than you should)

APPLIED TO: POST /api/bookings (create a booking)

S — Spoofing:
   Can someone submit a booking pretending to be a different student?
   Check: does the route use session.user.id or accept studentId in body?
   If body: THREAT. Attacker can spoof as any student.

T — Tampering:
   Can someone modify the price before the booking is confirmed?
   Check: does the route accept price from the request body?
   If yes: THREAT. Attacker can book a 2-hour lesson for $0.

R — Repudiation:
   Can a student deny they made a booking?
   Mitigation: AuditLog entry at booking creation with IP + timestamp.

I — Information Disclosure:
   Does the confirmation response include other students' data?
   Check: what does the JSON response contain?

D — Denial of Service:
   Can someone create 1000 bookings filling all instructor slots?
   Check: is there rate limiting on POST /api/bookings?

E — Elevation of Privilege:
   Can a student call an instructor-only endpoint?
   Check: does the route verify role, not just authentication?
```

---

## PART 4 — VULNERABILITY IDENTIFICATION WITH REAL CODE

### Level 1 — Absolute Beginner

A vulnerability is a weakness in your code that an attacker could use.

The most important thing to understand: **most vulnerabilities are not exotic**.
They are simple mistakes that developers make under time pressure.

The four most common ones you need to check:
```
1. MISSING CHECK: "Did I forget to check if the user is allowed to do this?"
2. TRUSTING INPUT: "Did I use what the user sent without checking it first?"
3. EXPOSING DATA: "Am I sending back more information than the user needs?"
4. WEAK SECRET: "Is my password / session / secret actually hard to guess?"
```

### Level 2 — Real Code Examples from DriveBook

Let's walk through actual files in DriveBook and identify what's good and what to watch for.

---

#### FINDING: Rate Limiting Configuration

**File:** `lib/ratelimit.ts`

```typescript
// What good rate limiting looks like:
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = Redis.fromEnv()

// Auth rate limit: 5 attempts per 15 minutes per IP
export const authRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  analytics: true,
  prefix: "ratelimit:auth"
})

// OTP rate limit: 3 attempts per 10 minutes
export const otpRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "10 m"),
  analytics: true,
  prefix: "ratelimit:otp"
})
```

**Why this is good:**
- Sliding window (not fixed window) — harder to game timing
- Different limits per route type — auth tighter than general API
- Analytics: true — Upstash dashboards show you attack attempts
- Prefix namespaced — can clear one limiter without clearing all

**What to verify in the route that uses this:**
```typescript
// In any auth route, the pattern should be:
const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1'
const { success } = await authRateLimit.limit(ip)

if (!success) {
  return NextResponse.json(
    { error: 'Too many attempts. Please wait 15 minutes.' },
    { status: 429 }
  )
}
```

**Important detail — the split(',')[0] matters:**

The `X-Forwarded-For` header can contain multiple IPs:
```
X-Forwarded-For: 203.206.1.45, 10.0.0.1, 172.16.0.2
                 ↑ real IP    ↑ proxy   ↑ another proxy
```

If you don't take `[0]`, the rate limiter key becomes the whole string.
An attacker could add extra commas to generate unique strings and bypass rate limiting.
Always `.split(',')[0].trim()`.

---

#### FINDING: Session Authentication Pattern

**File:** `lib/auth.ts`

```typescript
// The session object shape that NextAuth provides
// After authentication, every API route can call:
const session = await getServerSession(authOptions)

// session looks like:
{
  user: {
    id: "cmp8bq7s70001qby7fceboaoo",
    email: "debesay@drivebook.com.au",
    role: "INSTRUCTOR",          // ← role comes from the DATABASE, not user input
    instructorId: "clr8x...",    // ← set at login time, verified against DB
    name: "Debesay Birhane"
  },
  expires: "2026-08-07T..."
}
```

**Why role comes from the database matters:**
```
WRONG approach (trusting user input):
  User sends: { "role": "ADMIN" } in the request body
  Server reads req.body.role → "ADMIN"
  Server thinks the user is admin
  
  Attack: any user can become admin by setting role in the request.

CORRECT approach (DriveBook):
  User logs in → NextAuth looks up role FROM DATABASE
  Role is stored in the session token (JWT)
  JWT is signed with NEXTAUTH_SECRET — cannot be tampered with
  Every API route reads role from session, never from request body
```

**Pattern every route should follow:**
```typescript
export async function GET(req: NextRequest) {
  // Step 1: is this user logged in?
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Step 2: does this user have the right role?
  if (session.user.role !== 'INSTRUCTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Step 3: does this user own the resource they're asking for?
  const data = await prisma.booking.findMany({
    where: {
      instructorId: session.user.instructorId  // ← always scope to logged-in user
    }
  })

  return NextResponse.json(data)
}
```

**401 vs 403 — why it matters:**
```
401 Unauthorized = "I don't know who you are. Please log in."
403 Forbidden    = "I know who you are. You don't have permission for this."

Using 401 for role failures leaks information (tells attacker the user exists).
Using 404 instead of 403 for "not found" prevents IDOR confirmation.
```

---

#### FINDING: Input Validation with Zod

**What Zod is (absolute beginner):**
Zod is a library that checks whether data matches the shape you expect.
Without validation, a user could send anything — including data designed to break your system.

```typescript
// WITHOUT validation (dangerous):
export async function POST(req: NextRequest) {
  const body = await req.json()
  // body could be: { "price": -99999, "date": "not-a-date", "html": "<script>..." }
  // or it could crash your server if body is not JSON at all
  await prisma.booking.create({ data: body })  // ← disaster
}

// WITH Zod validation (safe):
import { z } from 'zod'

const CreateBookingSchema = z.object({
  instructorId: z.string().cuid(),           // must be a valid CUID
  date: z.string().datetime(),               // must be a valid ISO datetime
  packageId: z.string().cuid(),              // must be a valid CUID
  pickupAddress: z.string().min(5).max(200), // string, 5-200 chars
  notes: z.string().max(500).optional(),     // optional, max 500 chars
  // NOTICE: price is NOT accepted from user input
  // Price comes from the database based on packageId
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  
  const result = CreateBookingSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: result.error.flatten() },
      { status: 400 }
    )
  }
  
  // result.data is now type-safe and validated
  const { instructorId, date, packageId, pickupAddress, notes } = result.data
  
  // Fetch price from DB — never from user input
  const pkg = await prisma.package.findUnique({ where: { id: packageId } })
  if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 })
  
  await prisma.booking.create({
    data: {
      instructorId,
      date,
      packageId,
      pickupAddress,
      notes,
      price: pkg.price,  // ← price from DB, not user
      status: 'PENDING_PAYMENT'
    }
  })
}
```

**Key security principle shown here: never trust user-supplied prices.**
The client can display "this lesson costs $85" but your server must look that price up
from the database. If an attacker modifies the request, they might try `"price": 0`.
If your server reads from the database, the real price is always used.

---

#### FINDING: Stripe Webhook Integrity

**File:** `app/api/stripe/webhook/route.ts`

**Level 1 explanation:**
When Stripe takes a payment on your behalf, it calls your server to tell you about it.
This is called a webhook. But how do you know the call really came from Stripe and not
from an attacker pretending to be Stripe?

Answer: Stripe signs every webhook request with a secret key you both share.
If the signature doesn't match, the message was tampered with or faked.

```typescript
export async function POST(req: NextRequest) {
  // CRITICAL: read the raw body BEFORE parsing
  // Once you parse JSON, you can't verify the signature (body has changed)
  const body = await req.text()  // ← raw string, not parsed JSON
  const sig = req.headers.get('stripe-signature')
  
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }
  
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    // Signature check failed — body was tampered with or wrong secret
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }
  
  // Only here if Stripe signature is valid
  switch (event.type) {
    case 'payment_intent.succeeded':
      const intent = event.data.object as Stripe.PaymentIntent
      await handlePaymentSuccess(intent)
      break
    case 'payment_intent.payment_failed':
      await handlePaymentFailure(event.data.object as Stripe.PaymentIntent)
      break
    // Always have a default case — unknown events should be logged
    default:
      console.log(`Unhandled Stripe event: ${event.type}`)
  }
  
  // Always return 200 to Stripe — if you return 4xx/5xx, Stripe retries
  return NextResponse.json({ received: true })
}
```

**What happens without signature verification:**
```
Attacker sends to POST /api/stripe/webhook:
{
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_fake123",
      "amount": 50000,
      "metadata": { "bookingId": "booking-abc", "userId": "attacker-user" }
    }
  }
}

Without verification: server credits attacker's wallet $500 for free.
With verification: request rejected before any processing.
```



---

## PART 5 — RISK ASSESSMENT (LIKELIHOOD × IMPACT)

### Level 1 — Absolute Beginner

Not every bug is equally important. Some are annoying but not dangerous.
Others could destroy your business.

Risk rating helps you decide what to fix first.

**The formula:**
```
RISK = LIKELIHOOD × IMPACT

Likelihood = How easy is it for an attacker to exploit this?
Impact = How much damage would it cause if exploited?

Both are rated 1-5, so risk scores range from 1 (lowest) to 25 (highest)
```

**Simple scales:**
```
LIKELIHOOD:
1 = Very unlikely (requires insider access, very hard to find)
2 = Unlikely (requires specific conditions, moderately hard)
3 = Possible (any skilled attacker could do it with effort)
4 = Likely (easy to exploit, common attack technique)
5 = Very likely (automated tools exist, happening constantly)

IMPACT:
1 = Minimal (annoyance, no data exposure)
2 = Low (minor data exposure, no financial loss)
3 = Moderate (some PII exposed, limited financial loss)
4 = High (significant financial loss, regulatory breach)
5 = Critical (business-ending, complete data breach, massive liability)
```

### Level 2 — Risk Register for DriveBook

This is the single most important artifact of your project.
Every finding goes in this table.

| ID | Finding | OWASP | Likelihood | Impact | Risk | Status |
|----|---------|-------|------------|--------|------|--------|
| R01 | No MFA on instructor accounts | A07 | 4 | 5 | 20 | Open |
| R02 | No automated security monitoring | A09 | 3 | 3 | 9 | Open |
| R03 | npm packages with known CVE | A06 | 4 | 4 | 16 | Testing |
| R04 | videoUrl field accepts any domain | A10 | 2 | 2 | 4 | Accepted |
| R05 | No formal incident response plan | Design | 5 | 4 | 20 | Fixed |
| R06 | Error messages expose stack traces (dev) | A05 | 1 | 2 | 2 | Accepted |
| R07 | No Content Security Policy header | A05 | 3 | 3 | 9 | Open |
| R08 | Audit log has no automated review | A09 | 4 | 3 | 12 | Open |

**How to fill in this table yourself:**

```
STEP 1: Identify the finding
  Run npm audit, OWASP ZAP, or manual code review
  Write down what you found in plain language

STEP 2: Map to OWASP Top 10 category
  Ask: which category does this fit?
  Example: "No MFA" = A07 (Authentication Failures)

STEP 3: Rate likelihood
  Ask: how easy is this to exploit?
  Example: Credential stuffing attacks happen constantly → 4 or 5

STEP 4: Rate impact
  Ask: what's the worst that could happen?
  Example: Instructor account controls $10k/month payout → 5 (critical)

STEP 5: Multiply
  Risk = 4 × 5 = 20 (Critical)

STEP 6: Prioritize
  Fix anything scoring 15+ immediately
  Fix 9-14 before production launch
  Accept or defer 1-8 with documented justification
```

### Level 3 — Advanced Risk Rating with CVSS

For professional reports, use CVSS v3.1 scoring instead of simple 1-5 scales.

**CVSS calculator:** [nvd.nist.gov/vuln-metrics/cvss/v3-calculator](https://nvd.nist.gov/vuln-metrics/cvss/v3-calculator)

**Example: Missing MFA on instructor accounts**

```
Base Score Metrics:

Attack Vector (AV): Network
  → Exploitable remotely over the internet = worst case = 0.85

Attack Complexity (AC): Low
  → No special conditions needed, just need a password = 0.77

Privileges Required (PR): None
  → Attacker doesn't need existing account = 0.85

User Interaction (UI): None
  → No clicking on a link required = 0.85

Scope (S): Unchanged
  → Exploit stays within the same security authority

Confidentiality Impact (C): High
  → Bank account details fully exposed = 0.56

Integrity Impact (I): High
  → Bank account details can be changed = 0.56

Availability Impact (A): None
  → System still works, not a DoS = 0.00

CVSS v3.1 Base Score: 9.1 (Critical)
CVSS Vector String: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N
```

**When to use CVSS:**
- You are submitting this project to a client (not just self-assessment)
- You need to justify budget for remediation
- You want the report to look professional

**When simple 1-5 is fine:**
- Internal assessment for your own platform
- Time-limited (CVSS takes 2-3 minutes per finding)
- Assessor only needs relative prioritization

---

## PART 6 — REMEDIATION (FIXING THE GAPS)

This is where you show that you can not only identify problems, but solve them.

### Remediation 1: Add Automated Security Monitoring

**FINDING R02/R08: No automated monitoring of suspicious activity**

**Before state:**
- AuditLog table exists
- Every financial action is logged
- But: no one ever LOOKS at the logs unless there's already a problem

**Problem:**
An attacker could slowly drain wallet credits or redirect payouts, and it would go
unnoticed until an instructor complains days later.

**Solution:** Daily cron job that emails a summary of suspicious patterns.

**Implementation — absolute beginner level:**

Create a new file: `lib/services/security-monitoring.ts`

```typescript
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/services/email'

export async function runSecurityChecks() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  
  // Check 1: Too many failed auth attempts from one IP
  const failedLogins = await prisma.auditLog.groupBy({
    by: ['ipAddress'],
    where: {
      action: 'AUTH_FAILED',
      timestamp: { gte: yesterday }
    },
    _count: { id: true }
  })
  
  const suspiciousIPs = failedLogins.filter(entry => entry._count.id > 20)
  
  // Check 2: Unusual wallet credit patterns
  const walletCredits = await prisma.auditLog.findMany({
    where: {
      action: 'WALLET_CREDIT_ADDED',
      timestamp: { gte: yesterday }
    },
    include: {
      actor: { select: { email: true } }
    }
  })
  
  const highValueCredits = walletCredits.filter(log => {
    const amount = (log.metadata as any)?.amount || 0
    return amount > 500  // flag credits over $500
  })
  
  // Check 3: Bank details changed
  const bankDetailsChanges = await prisma.auditLog.count({
    where: {
      action: 'INSTRUCTOR_PAYOUT_CHANGED',
      timestamp: { gte: yesterday }
    }
  })
  
  // Build report
  const alerts = []
  if (suspiciousIPs.length > 0) {
    alerts.push(`⚠️ ${suspiciousIPs.length} IPs had >20 failed login attempts`)
  }
  if (highValueCredits.length > 0) {
    alerts.push(`💰 ${highValueCredits.length} wallet credits over $500`)
  }
  if (bankDetailsChanges > 0) {
    alerts.push(`🏦 ${bankDetailsChanges} instructor(s) changed bank details`)
  }
  
  if (alerts.length === 0) {
    // All clear — no email needed
    return { status: 'ok', message: 'No suspicious activity detected' }
  }
  
  // Send email alert
  const emailBody = `
    DriveBook Security Alert — ${new Date().toLocaleDateString()}
    
    ${alerts.join('\n')}
    
    Review the audit log at /admin/audit-log
  `
  
  await sendEmail({
    to: 'debesay@drivebook.com.au',
    subject: '🔒 DriveBook Security Alert',
    text: emailBody
  })
  
  return { status: 'alert', alerts }
}
```

**Create the cron endpoint:**

Create: `app/api/cron/security-check/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { runSecurityChecks } from '@/lib/services/security-monitoring'

export async function GET(req: NextRequest) {
  // Verify this request comes from your cron service, not a random attacker
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const result = await runSecurityChecks()
  return NextResponse.json(result)
}
```

**Set up on Vercel Cron (in `vercel.json`):**

```json
{
  "crons": [
    {
      "path": "/api/cron/security-check",
      "schedule": "0 9 * * *"
    }
  ]
}
```

This runs every day at 9am UTC.

**What to add to .env:**
```
CRON_SECRET=generate-a-random-string-here-at-least-32-chars
```

**Testing it:**
```bash
# Call it manually with the secret:
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/security-check
```

**Expected output if suspicious activity found:**
```json
{
  "status": "alert",
  "alerts": [
    "⚠️ 2 IPs had >20 failed login attempts",
    "🏦 1 instructor(s) changed bank details"
  ]
}
```

**Before/After documentation for your report:**

BEFORE:
- Audit logs exist but are only checked manually when an issue is reported
- No proactive detection of attack patterns

AFTER:
- Daily automated review of audit logs
- Email alerts on suspicious patterns (>20 failed logins, high-value wallet credits, bank detail changes)
- Reduces detection time from days to <24 hours

**Risk score impact:**
- R02 risk score: 9 → 3 (still possible, but impact reduced due to faster detection)
- R08 risk score: 12 → 4 (automated review implemented)

---

### Remediation 2: Implement MFA for Instructor Accounts

**FINDING R01: No MFA — instructor accounts control bank account details**

This is the highest-priority finding. Let's implement it step by step.

**Level 1 — What is MFA?**

Multi-Factor Authentication = requiring two different types of proof before logging in.

Three types of proof:
1. Something you KNOW (password)
2. Something you HAVE (phone, hardware key)
3. Something you ARE (fingerprint, face)

MFA requires at least two of these. DriveBook currently only uses #1.

**Level 2 — Which type of MFA to implement?**

| Type | Security | User friction | Cost |
|------|----------|---------------|------|
| SMS codes | Medium (SIM swap risk) | Low | $0.01/SMS (Twilio) |
| Email codes | Low (email often same device) | Low | Free |
| TOTP app | High | Medium | Free |
| Hardware key (YubiKey) | Very high | Medium-high | $25-50/key |

**Recommendation: TOTP (Time-based One-Time Password)**
- Uses Google Authenticator, Authy, or 1Password
- Free for unlimited users
- Industry standard
- No SMS costs

**Level 3 — Implementation**

**Step 1: Install the library**

```bash
npm install otplib qrcode
npm install --save-dev @types/qrcode
```

**Step 2: Add MFA fields to database**

Add to `prisma/schema.prisma`:

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  password      String
  role          Role
  
  // NEW: MFA fields
  mfaEnabled    Boolean  @default(false)
  mfaSecret     String?  // TOTP secret (base32 encoded)
  mfaBackupCodes String[] // Array of one-time backup codes
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

Run migration:
```bash
npx prisma migrate dev --name add_mfa_fields
```

**Step 3: Create MFA setup endpoint**

Create: `app/api/instructor/mfa/setup/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'INSTRUCTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Generate a unique secret for this user
  const secret = authenticator.generateSecret()
  
  // Create the otpauth:// URL that the QR code encodes
  const otpauthUrl = authenticator.keyuri(
    session.user.email,
    'DriveBook',
    secret
  )
  
  // Generate QR code as data URL
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl)
  
  // Generate 10 backup codes (single-use, in case user loses their phone)
  const backupCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  )
  
  // Store secret and backup codes (but don't enable MFA yet)
  // User must confirm they scanned the QR by entering a valid code
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      mfaSecret: secret,
      mfaBackupCodes: backupCodes,
      mfaEnabled: false  // not enabled until confirmed
    }
  })
  
  return NextResponse.json({
    qrCode: qrCodeDataUrl,
    secret,  // show this as text for manual entry
    backupCodes
  })
}
```

**Step 4: Create MFA verification endpoint**

Create: `app/api/instructor/mfa/verify/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authenticator } from 'otplib'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { code } = await req.json()
  
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mfaSecret: true, mfaBackupCodes: true }
  })
  
  if (!user?.mfaSecret) {
    return NextResponse.json({ error: 'MFA not set up' }, { status: 400 })
  }
  
  // Check if code is valid
  const isValid = authenticator.verify({
    token: code,
    secret: user.mfaSecret
  })
  
  // Or check if it's a backup code
  const isBackupCode = user.mfaBackupCodes.includes(code)
  
  if (!isValid && !isBackupCode) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }
  
  // If using backup code, remove it (single use)
  if (isBackupCode) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        mfaBackupCodes: user.mfaBackupCodes.filter(c => c !== code)
      }
    })
  }
  
  // Enable MFA now that user has confirmed they can generate valid codes
  await prisma.user.update({
    where: { id: session.user.id },
    data: { mfaEnabled: true }
  })
  
  return NextResponse.json({ success: true })
}
```

**Step 5: Update login flow to require MFA**

Modify `app/api/auth/[...nextauth]/route.ts`:

```typescript
// In the credentials provider authorize function:
async authorize(credentials) {
  const user = await prisma.user.findUnique({
    where: { email: credentials.email }
  })
  
  if (!user || !await bcrypt.compare(credentials.password, user.password)) {
    return null
  }
  
  // NEW: If user has MFA enabled, require MFA code
  if (user.mfaEnabled) {
    if (!credentials.mfaCode) {
      // Signal that MFA is required
      throw new Error('MFA_REQUIRED')
    }
    
    // Verify the MFA code
    const isValid = authenticator.verify({
      token: credentials.mfaCode,
      secret: user.mfaSecret!
    })
    
    if (!isValid) {
      // Check backup codes
      const isBackupCode = user.mfaBackupCodes.includes(credentials.mfaCode)
      if (!isBackupCode) {
        throw new Error('INVALID_MFA_CODE')
      }
      // Remove used backup code
      await prisma.user.update({
        where: { id: user.id },
        data: {
          mfaBackupCodes: user.mfaBackupCodes.filter(c => c !== credentials.mfaCode)
        }
      })
    }
  }
  
  return {
    id: user.id,
    email: user.email,
    role: user.role
  }
}
```

**Step 6: Frontend MFA setup page**

Create: `app/dashboard/security/page.tsx`

```typescript
'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function SecurityPage() {
  const [qrCode, setQrCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verifyCode, setVerifyCode] = useState('')
  const [step, setStep] = useState<'setup' | 'scan' | 'verify' | 'complete'>('setup')
  
  async function setupMFA() {
    const res = await fetch('/api/instructor/mfa/setup', { method: 'POST' })
    const data = await res.json()
    setQrCode(data.qrCode)
    setBackupCodes(data.backupCodes)
    setStep('scan')
  }
  
  async function confirmMFA() {
    const res = await fetch('/api/instructor/mfa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: verifyCode })
    })
    
    if (res.ok) {
      setStep('complete')
    } else {
      alert('Invalid code. Please try again.')
    }
  }
  
  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Two-Factor Authentication</h1>
      
      {step === 'setup' && (
        <div>
          <p className="mb-4">
            Protect your account with two-factor authentication.
            You'll need an authenticator app like Google Authenticator or Authy.
          </p>
          <button
            onClick={setupMFA}
            className="bg-blue-600 text-white px-6 py-2 rounded"
          >
            Enable 2FA
          </button>
        </div>
      )}
      
      {step === 'scan' && (
        <div>
          <p className="mb-4">Scan this QR code with your authenticator app:</p>
          <Image src={qrCode} alt="QR Code" width={256} height={256} />
          <button
            onClick={() => setStep('verify')}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded"
          >
            I've scanned it
          </button>
        </div>
      )}
      
      {step === 'verify' && (
        <div>
          <p className="mb-4">Enter the 6-digit code from your app:</p>
          <input
            type="text"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            maxLength={6}
            className="border p-2 rounded"
          />
          <button
            onClick={confirmMFA}
            className="ml-2 bg-green-600 text-white px-6 py-2 rounded"
          >
            Verify
          </button>
        </div>
      )}
      
      {step === 'complete' && (
        <div>
          <p className="text-green-600 font-bold mb-4">✓ 2FA Enabled Successfully</p>
          <p className="mb-2">Save these backup codes in a safe place:</p>
          <div className="bg-gray-100 p-4 rounded font-mono text-sm">
            {backupCodes.map(code => (
              <div key={code}>{code}</div>
            ))}
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Each backup code can only be used once. Use them if you lose access to your authenticator app.
          </p>
        </div>
      )}
    </div>
  )
}
```

**Before/After for your report:**

BEFORE:
- Instructor accounts protected by password only
- Risk: Credential stuffing attack could compromise account → attacker changes payout bank details
- CVSS Score: 9.1 (Critical)

AFTER:
- TOTP-based MFA available for all instructor accounts
- Attackers need both password AND physical access to instructor's phone
- 10 backup codes for account recovery
- CVSS Score: 3.9 (Low) — attack complexity significantly increased

**Risk score impact:**
- R01 risk score: 20 → 4 (likelihood drops from 4 to 1 — requires both password and phone)



---

### Remediation 3: Add Content Security Policy Header

**FINDING R07: No Content Security Policy**

**Level 1 — What is a CSP?**

A Content Security Policy is a browser instruction that says:
"Only load scripts/styles/images from these approved locations."

Without a CSP, if an attacker injects a `<script>` tag (via XSS), the browser will run it.
With a CSP, the browser checks: "Is this script from an approved location?" If not, it blocks it.

**Level 2 — Current state in DriveBook**

File: `next.config.js`

```javascript
// Current headers (partial — from existing next.config.js):
{
  key: 'X-Frame-Options',
  value: 'DENY'            // ✓ clickjacking protection
},
{
  key: 'X-Content-Type-Options',
  value: 'nosniff'         // ✓ MIME sniffing protection
}
// Missing:
// Content-Security-Policy  ← XSS protection
// Permissions-Policy       ← camera/microphone/geolocation access
// Strict-Transport-Security ← HTTPS enforcement
```

**Level 3 — Adding CSP to DriveBook**

Open `next.config.js` and update the headers section:

```javascript
// next.config.js
const securityHeaders = [
  // Existing headers — keep these
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  
  // NEW: Strict Transport Security
  // Tells browsers to ONLY use HTTPS for the next year
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains'
  },
  
  // NEW: Content Security Policy
  // This needs to list every external resource DriveBook loads
  {
    key: 'Content-Security-Policy',
    value: [
      // Only allow content from your own domain
      "default-src 'self'",
      
      // Scripts: your own domain + Next.js needs 'unsafe-eval' in dev
      // In production, remove 'unsafe-eval' when possible
      "script-src 'self' 'unsafe-inline' https://js.stripe.com",
      
      // Styles: your own domain + inline styles (Tailwind uses these)
      "style-src 'self' 'unsafe-inline'",
      
      // Images: your own domain + Cloudinary + Next.js image optimization
      "img-src 'self' data: blob: https://res.cloudinary.com https://*.cloudinary.com",
      
      // Fonts: your own domain only
      "font-src 'self'",
      
      // Forms: only submit to your own domain
      "form-action 'self'",
      
      // Frames: Stripe payment elements need to load in iframes
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      
      // Connections (fetch/WebSocket): your own API + external services
      "connect-src 'self' https://api.stripe.com https://*.supabase.co",
      
      // Media: your own domain only
      "media-src 'self'",
      
      // No plugin types (no Flash, no Java applets)
      "object-src 'none'",
      
      // Upgrade HTTP requests to HTTPS
      "upgrade-insecure-requests"
    ].join('; ')
  },
  
  // NEW: Permissions Policy
  // Explicitly deny access to sensitive browser features
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  }
]
```

**How to test your CSP:**

1. Open your app in Chrome
2. Open DevTools → Console
3. Any CSP violations appear as errors like:
   `Refused to load script because it violates Content Security Policy`
4. Fix your CSP to allow legitimate resources that were blocked
5. Use [CSP Evaluator](https://csp-evaluator.withgoogle.com/) to check for weaknesses

---

### Remediation 4: Dependency Vulnerability Scan

**FINDING R03: npm packages with known CVEs**

This remediation you can complete in 15 minutes and document immediately.

**Level 1 — What are dependency vulnerabilities?**

Your application uses hundreds of packages written by other developers.
Sometimes those packages are discovered to have security flaws.
`npm audit` checks your list of packages against a database of known flaws.

**Level 2 — Running the scan**

```bash
cd "e:\DOC\AI voice assistance - Copy\drivebook"
npm audit

# Expected output format:
found 3 vulnerabilities (1 moderate, 2 high)

# For detailed view:
npm audit --json

# To automatically fix non-breaking issues:
npm audit fix

# To see what would be updated without applying:
npm audit fix --dry-run
```

**What to do with the output:**

```
CRITICAL/HIGH findings:
  npm audit fix (if it doesn't break anything)
  OR: manually update to the patched version
  npm update package-name
  
  Document: "Found CVE-XXXX-XXXX in package-name version X.Y.Z.
             Patched by upgrading to version X.Y.Z+1.
             Re-ran npm audit to verify finding resolved."

MODERATE findings:
  Review: does DriveBook actually use the vulnerable feature?
  If yes: patch it
  If no: document as accepted risk with justification

LOW findings:
  Document as accepted risk: "Low severity, functionality not used,
  will patch in next scheduled maintenance window."
```

**For your report — document before and after:**

```
BEFORE:
npm audit output: [paste actual output here]

FIX APPLIED:
npm audit fix
Specific packages updated: [list them]

AFTER:
npm audit output: found 0 vulnerabilities
OR: found X vulnerabilities (documented as accepted risk)
```

---

## PART 7 — VERIFICATION (PROVING YOUR FIXES WORK)

### Level 1 — Absolute Beginner

Verification means: "I fixed the problem. Now I'll prove it's actually fixed."

You test the same thing you tested before, and this time it should fail (for the attacker).

Think of it like:
- BEFORE: Lock was broken → door opened without key ✗
- FIXED:  Lock replaced
- VERIFY: Try door without key → stays locked ✓

### Level 2 — Verification Tests

**Test 1: Rate limiting works**

Before fix:
```bash
# Run 10 login attempts in rapid succession
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3000/api/auth/callback/credentials \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
# Expected: all return 200 or 401 (no rate limiting applied)
```

After fix:
```bash
# Same test — should see 429 after 5 attempts
# Expected output: 401 401 401 401 401 429 429 429 429 429
```

**Test 2: Webhook signature verification**

Before fix (if not present):
```bash
curl -X POST http://localhost:3000/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"payment_intent.succeeded","data":{"object":{"id":"pi_fake"}}}'
# If vulnerable: returns 200 and processes the fake event
```

After fix:
```bash
# Same curl command — should return 400 (missing/invalid signature)
# Expected: {"error":"Missing signature"}
```

**Test 3: Broken Access Control — IDOR**

Create two instructor accounts in your test environment.
Log in as Instructor A. Find Instructor B's booking ID.
Try to access it:

```bash
# Log in and get session cookie first, then:
curl -H "Cookie: [session cookie for Instructor A]" \
  http://localhost:3000/api/bookings/INSTRUCTOR_B_BOOKING_ID

# If vulnerable: returns Instructor B's booking data
# If fixed: returns 404 or 403
```

**Test 4: MFA requirement**

After MFA implementation:

```
1. Enable MFA for a test instructor account
2. Log out
3. Attempt to log in with correct email/password but NO MFA code
4. Expected: login fails with MFA_REQUIRED error
5. Attempt to log in with correct email/password AND valid TOTP code
6. Expected: login succeeds
7. Attempt to log in with correct email/password AND wrong TOTP code
8. Expected: login fails with INVALID_MFA_CODE error
```

### Level 3 — Automated Verification

For a more rigorous assessment, use OWASP ZAP to re-scan after fixes:

```
1. Run ZAP active scan before any fixes → save as baseline report
2. Apply all remediations
3. Run ZAP active scan again → save as post-remediation report
4. Compare: all HIGH findings resolved, MEDIUM reduced

Include both reports in your appendix.
This is the gold standard for demonstrating remediation effectiveness.
```

---

## PART 8 — WRITING THE FORMAL SECURITY REPORT

### Level 1 — Structure Overview

The report has four main parts. Non-technical people read the first part.
Technical people (or your assessor) read all parts.

```
1. EXECUTIVE SUMMARY     ← 1 page, plain English
2. RISK REGISTER         ← table of all findings
3. FINDINGS              ← detailed description of each finding
4. APPENDIX              ← tool outputs, raw evidence
```

### Level 2 — Executive Summary Template

```markdown
# Cyber Security Audit — DriveBook.com.au
**Date:** August 2026
**Prepared by:** Debesay Weldegebriel Birhane
**Classification:** Confidential

## Executive Summary

A security audit of DriveBook.com.au was conducted between [date] and [date].
The scope included the main web application, the hybrid voice service,
the PostgreSQL database, and the associated cloud infrastructure.

**Overall Risk Rating: MEDIUM**

The platform implements strong foundational security controls including:
- Industry-standard password hashing (bcrypt)
- HTTPS enforced across all endpoints
- Rate limiting on authentication and OTP endpoints
- Stripe webhook signature verification
- Role-based access control throughout the API

**Key Findings:**

| Priority | Finding | Status |
|----------|---------|--------|
| Critical | No multi-factor authentication on instructor accounts | Remediated |
| High | npm packages with known vulnerabilities | Remediated |
| Medium | No automated security monitoring | Remediated |
| Medium | Missing Content Security Policy header | Remediated |
| Low | videoUrl field accepts any domain | Accepted risk |

All Critical and High findings have been remediated.
Two Medium findings have been addressed.
One Low finding has been accepted with documented justification.

**Recommendation:** Conduct a follow-up assessment in 6 months.
Priority for next cycle: formal penetration test by an independent assessor.
```

### Level 3 — Full Finding Template

Every finding needs a page like this:

```markdown
## Finding 001 — Missing Multi-Factor Authentication on Instructor Accounts

**Severity:** Critical
**CVSS v3.1 Score:** 9.1
**CVSS Vector:** CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N
**OWASP Category:** A07 — Identification and Authentication Failures
**Status:** Remediated

---

### Description

Instructor accounts on DriveBook.com.au were protected by a single authentication factor
(email address and password). No second factor was required.

Instructor accounts have elevated access compared to student accounts. Specifically,
instructors can view student personal information (phone numbers, pickup addresses),
view their own payout history, and modify their bank account details for payouts.

A successful account compromise would allow an attacker to:
- View personal data of the instructor's students
- Redirect future payouts to an attacker-controlled bank account
- Access the instructor's earnings history

### Evidence

Screenshot 1: Login page with no MFA prompt
Screenshot 2: Successful login with only email/password
Screenshot 3: Payout bank details accessible after login

### Steps to Reproduce

1. Navigate to drivebook.com.au/login
2. Enter valid instructor credentials
3. Observe: login completes without any second factor challenge
4. Navigate to /dashboard/settings/payouts
5. Observe: bank account details are fully visible and editable

### Risk Analysis

**Likelihood:** 4/5 — High
Credential stuffing attacks are automated and constant. Instructor credentials
are likely present in breach databases given that many people reuse passwords.
The HaveIBeenPwned database contains over 12 billion breached credentials.

**Impact:** 5/5 — Critical
Payout redirection would cause direct financial harm. At current scale, the average
instructor earns $500-1500/week. Undetected for one week = $500-1500 loss per
compromised instructor account.

**Risk Score:** 20/25 — Critical

### Remediation

TOTP-based MFA was implemented using the `otplib` library.
Users can now enable 2FA via Settings → Security → Enable Two-Factor Authentication.
Upon enabling, the user scans a QR code with Google Authenticator or a similar app.

From the next login, a 6-digit TOTP code is required in addition to the password.
10 single-use backup codes were generated and presented to the user at setup time.

**Commit reference:** [git commit hash]
**Files changed:**
- `prisma/schema.prisma` — added mfaEnabled, mfaSecret, mfaBackupCodes fields
- `app/api/instructor/mfa/setup/route.ts` — MFA setup endpoint
- `app/api/instructor/mfa/verify/route.ts` — MFA verification endpoint
- `app/dashboard/security/page.tsx` — user interface for MFA setup
- `app/api/auth/[...nextauth]/route.ts` — login flow updated to require MFA

### Verification

Post-remediation test:
1. Enabled MFA on test instructor account ✓
2. Logged out ✓
3. Attempted login with correct password only → rejected with MFA_REQUIRED ✓
4. Attempted login with correct password + wrong TOTP → rejected ✓
5. Attempted login with correct password + valid TOTP → success ✓

**Risk score post-remediation:** 4/25 — Low
```

---

## PART 9 — THE 10-MINUTE PRESENTATION

Your assessor will ask for a 10-minute oral presentation of your findings.

**Structure:**
```
MINUTE 1-2: Context
  "DriveBook is a driving instructor marketplace.
  It handles bookings, payments, and personal data.
  I conducted a security audit to identify and remediate gaps
  before the platform goes live with real customers."

MINUTE 2-3: Methodology
  "I used a structured approach based on the OWASP Top 10.
  I performed static code analysis, ran npm audit,
  manually tested authentication flows, and reviewed
  infrastructure configuration."

MINUTE 3-5: Top Finding
  "The most critical finding was the absence of multi-factor authentication
  on instructor accounts. Instructors control bank account details
  for weekly payouts. A successful credential stuffing attack would allow
  an attacker to redirect those payouts.
  I rated this as Critical — CVSS 9.1 — and remediated it by implementing
  TOTP-based MFA using the otplib library."

MINUTE 5-7: Other Findings
  Walk through your risk register table.
  Two sentences per finding: what it is, what you did about it.

MINUTE 7-9: Verification
  "After applying remediations, I re-tested each finding.
  I will demonstrate the MFA flow now..."
  [DEMO: log in, enter TOTP, succeed]
  [DEMO: log in without TOTP, fail]

MINUTE 9-10: What I'd do next
  "The gaps still remaining are...
  My recommendation for the next security cycle is...
  The most valuable next investment would be..."
```

**Questions your assessor will ask — and how to answer:**

```
Q: Why did you prioritise MFA over CSP?
A: "MFA addresses a Critical CVSS 9.1 finding that directly threatens
   financial integrity. CSP is a defence-in-depth control for XSS,
   which is Medium severity given React's built-in escaping.
   Risk score of 20 vs 9 — MFA was clearly first."

Q: What would you do if you found a breach during the test?
A: "Stop the test. Preserve all logs and evidence.
   Follow the incident response plan:
   contain the breach first (rotate credentials, take service offline if needed),
   then notify the OAIC if personal data was accessed.
   Document everything with timestamps."

Q: Could an attacker bypass your rate limiting?
A: "Theoretically, yes — by rotating IP addresses using residential proxies.
   The rate limit is per IP, so a botnet with thousands of different IPs
   could still attempt many passwords. To fully address this,
   MFA is the more robust control — it makes the password less valuable
   even if guessed."

Q: Is your system compliant with the Privacy Act?
A: "Partially. We collect personal information with consent, protect it
   with HTTPS and bcrypt, and have a privacy policy. The gaps are:
   no self-service data export (APP 12) and no documented data retention
   period (APP 11 and APP 13). These are on my remediation backlog."
```

---

## Summary: Assessment Checklist

Before you submit, verify you have:

```
PROJECT DOCUMENTATION:
□ Scope definition document
□ Risk register (at least 5 findings)
□ Incident response plan

PER FINDING:
□ Description in plain English
□ OWASP category
□ Risk rating (likelihood × impact OR CVSS score)
□ Remediation steps with code changes documented
□ Verification test results

EVIDENCE:
□ npm audit output (before and after)
□ Screenshots of test results
□ Code changes (before and after)
□ Git commit references

REPORT:
□ Executive summary (non-technical)
□ All findings documented
□ Post-remediation risk ratings

PRESENTATION:
□ 10 minutes practised
□ Can answer the 6 expected questions without notes
□ Can live-demonstrate at least one remediation
```
