# VU23223 — Deep Dive: Privacy Law and Ethics with Real Steps

## Why law matters for cyber security practitioners

Security people often focus on technical controls and ignore legal obligations. That's dangerous. As a security professional (and as the operator of a platform handling personal data), you have legal duties. Violating them costs money and reputation.

---

## TERM: Personal Information

**Legal definition (Privacy Act 1988):**
"Information or an opinion about an identified individual, or an individual who is reasonably identifiable."

**Key phrase: "reasonably identifiable"**
This is broader than most people think. You don't need a name.

**Examples — is it personal information?**

```
"John Smith, 0412 345 678, john@example.com"
→ YES — clearly identified

"Instructor at 14 Stirling Hwy, Claremont, automatic only"
→ POSSIBLY — might identify the only instructor in that area

IP address: 203.206.1.45
→ POSSIBLY — ISP can map it to a subscriber account
→ In the context of other data (login time + IP) → YES

De-identified data: "Instructor ID cmp8bq7s70001qby7fceboaoo earned $790 this week"
→ NO (if truly de-identified) → YES (if the ID can be linked back to a person)
```

**Why this matters for DriveBook:**
Your audit logs contain: `ipAddress`, `actorId`, `timestamp`, `action`. This is personal information. You must protect it and retain it only as long as necessary.

---

## TERM: Sensitive Information

**Legal definition:** A subcategory of personal information with higher protection requirements.

**Categories under the Privacy Act:**
```
1. Racial or ethnic origin
2. Political opinions
3. Membership of political associations
4. Religious beliefs or affiliations
5. Philosophical beliefs
6. Membership of professional or trade associations
7. Membership of trade unions
8. Sexual orientation or practices
9. Criminal record
10. Health information
11. Genetic information
12. Biometric information / biometric templates
13. Government identifiers (e.g., Tax File Number)
```

**DriveBook sensitive information:**
- Instructor police checks (uploaded documents) → Category 9: Criminal record
- Instructor WWC checks → Category 9 (relates to child protection history)
- Any health information in lesson notes → Category 10

**What "higher protection" means in practice:**
- Cannot collect without explicit consent (not implied consent)
- Cannot disclose to third parties without consent
- Must be encrypted in transit AND at rest
- Retention: delete when no longer needed
- Access: even more restricted than general personal information

---

## TERM: Australian Privacy Principles (APPs) — Full Walkthrough

### APP 1: Open and Transparent Management

**What it requires:**
Implement practices, procedures and systems that ensure you comply with the APPs.
Have a clearly expressed and up-to-date privacy policy that is freely available.

**Your obligation:**
Privacy policy must explain:
- What personal information you collect
- Why you collect it (purpose)
- How you collect it (e.g., forms, cookies, third parties)
- How you store and protect it
- Who you disclose it to (e.g., Stripe, Twilio, Cloudinary)
- How people can access or correct their information
- How to complain about a privacy breach

**DriveBook implementation:**
`app/privacy/page.tsx` — publicly accessible
Covers the required elements including:
> "Process bookings and payments, share booking details between matched Learners and Instructors"

**Gap:** Does not mention data retention periods or deletion policy.

---

### APP 3: Collection of Solicited Personal Information

**What it requires:**
Only collect personal information that is reasonably necessary for your functions or activities. Collect directly from the individual where reasonably practicable.

**Practical test: "Do I actually need this?"**

```
COLLECTING: Instructor date of birth
QUESTION:   Do you need it?
ANSWER:     Not for booking management. Possibly for identity verification.
DECISION:   Don't collect unless you have a clear, documented reason.
PRINCIPLE:  Data minimisation — collect only what you need.

COLLECTING: Student pickup address
QUESTION:   Do you need it?
ANSWER:     YES — instructor needs to know where to go.
DECISION:   Collect and retain until booking is completed + dispute period.
```

**Code example — implementing data minimisation:**
```typescript
// BAD: Collecting everything because it might be useful later
const user = await prisma.user.create({
  data: {
    email, password, phone,
    dateOfBirth,    // ← don't collect unless you use it
    homeAddress,    // ← not needed for instructors
    driversLicence, // ← not needed in the database
    emergencyContact, // ← not needed for the booking system
  }
})

// GOOD: Collect only what is necessary for the function
const user = await prisma.user.create({
  data: {
    email,    // ← needed for login and notifications
    password, // ← needed for authentication
    // phone collected on instructor profile, not user account
    // dateOfBirth not collected — not needed
  }
})
```

---

### APP 5: Notification of Collection

**What it requires:**
At or before collection, notify the individual of certain matters including the purpose, any third-party disclosure, and how to access their information.

**Implementation — at the point of collection:**
```tsx
// Registration form — add a collection notice
<form onSubmit={handleSubmit}>
  <input type="email" placeholder="Email" required />
  <input type="password" placeholder="Password" required />
  
  {/* APP 5 notice — must appear near the submit button */}
  <p className="text-xs text-slate-500 mt-2">
    By registering, your name, contact details, and driving credentials
    will be used to create your instructor profile, process bookings,
    and facilitate payouts. Read our{' '}
    <a href="/privacy">Privacy Policy</a> to learn more.
  </p>
  
  <button type="submit">Create Account</button>
</form>
```

---

### APP 11: Security of Personal Information

**What it requires:**
Take reasonable steps to protect personal information from misuse, interference, loss, and from unauthorised access, modification, or disclosure.

**"Reasonable steps" is contextual:**
- Small business with less sensitive data = less is expected
- Platform handling financial data + sensitive documents = more is expected

**What "reasonable steps" look like for DriveBook:**

```
MINIMUM (must have):
✓ HTTPS (all traffic encrypted in transit)
✓ Password hashing (bcrypt)
✓ Role-based access control
✓ Input validation
✓ Database encryption at rest (Supabase handles this)

EXPECTED AT YOUR SCALE:
✓ Rate limiting on sensitive endpoints
✓ Audit logging of access to personal data
✓ Signed URLs for document access (not public URLs)
⚠ Automated alerts on suspicious access patterns (gap)
⚠ MFA for accounts that access sensitive data (gap)
⚠ Regular security testing (partially done via OWASP assessment)
⚠ Documented incident response plan (created in Week 12-14)

BEST PRACTICE (for future):
○ Penetration test by independent assessor annually
○ Security awareness training for any staff
○ Data loss prevention (DLP) controls
○ Encryption key management system
```

---

### APP 12: Access to Personal Information

**What it requires:**
Give individuals access to their own personal information on request.

**What this means in practice:**
If an instructor requests "what data do you hold about me?", you must:
1. Provide access within 30 days
2. Not charge more than a reasonable fee
3. Tell them why if you can't provide some information (e.g., legal obligation to retain)

**DriveBook implementation gap:**
No self-service data export exists. Currently, this would require a manual database query.

**Recommended fix:**
```typescript
// Add to instructor settings:
// GET /api/instructor/data-export
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.instructorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const [profile, bookings, transactions, auditLog] = await Promise.all([
    prisma.instructor.findUnique({ where: { id: session.user.instructorId } }),
    prisma.booking.findMany({ where: { instructorId: session.user.instructorId } }),
    prisma.transaction.findMany({ where: { instructorId: session.user.instructorId } }),
    prisma.auditLog.findMany({ where: { actorId: session.user.id } }),
  ])
  
  // Return as downloadable JSON
  return new NextResponse(JSON.stringify({ profile, bookings, transactions, auditLog }, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="my-data.json"'
    }
  })
}
```

---

## TERM: Notifiable Data Breach — Full Decision Tree

**Step-by-step process when you suspect a breach:**

```
STEP 1: Detect (within hours)
  ├── Source: user complaint, automated alert, manual discovery, third-party notification
  ├── Record: time of detection, initial symptoms
  └── Question: "Has personal information been accessed or disclosed without authorisation?"
      ├── NO → Not a data breach (document and monitor)
      └── YES/UNSURE → Continue to Step 2

STEP 2: Contain (within 24 hours for serious incidents)
  ├── Stop the breach if possible (patch vulnerability, revoke credentials)
  ├── Preserve evidence (DO NOT delete logs, emails, or affected files)
  ├── Document everything with timestamps
  └── Question: "Is there a real risk of serious harm to affected individuals?"
      Factors:
        - Bank details exposed → HIGH HARM RISK (financial loss)
        - Email addresses only → LOWER HARM RISK
        - Anonymous usage data → VERY LOW HARM RISK

STEP 3: Assess (within 30 days)
  ├── Identify: what data was affected? how many people?
  ├── Assess: what harm could they suffer?
  ├── Document: timeline, scope, root cause
  └── Decision: "Is this an eligible data breach?"
      Eligible = accessed/disclosed WITHOUT AUTHORISATION + REAL RISK OF SERIOUS HARM
      
STEP 4: Notify (if eligible breach)
  ├── OAIC: oaic.gov.au/privacy/notifiable-data-breaches
  │   - Mandatory notification form
  │   - Complete within 30 days of becoming aware
  │   - Describe: what happened, type of information, steps taken
  │
  └── AFFECTED INDIVIDUALS: direct notification required if serious harm risk
      - Email/SMS: "We have detected a security incident..."
      - Must include: what happened, what information involved, what you're doing
      - Cannot hide behind generic "security update" notices

STEP 5: Remediate
  ├── Fix the root cause
  ├── Review all related controls
  ├── Update incident response plan
  └── Consider offering credit monitoring if financial data exposed
```

**Worked example — the GitHub credential exposure scenario:**

```
Situation: STRIPE_SECRET_KEY found in a GitHub commit for 3 hours

STEP 1 — Detect
Time: Tuesday 2am, GitHub security alert email
Initial symptoms: API key visible in commit history

STEP 2 — Contain
Immediately: Rotate the Stripe secret key in Stripe dashboard
             Update STRIPE_SECRET_KEY in Vercel environment variables
Preserve: Screenshot of the GitHub commit before force-pushing
          Note exact time the commit was public

STEP 3 — Assess
What was exposed: Stripe secret key
What an attacker with this key can do:
  - List all transactions (sees customer payment data)
  - Issue refunds (financial harm to DriveBook)
  - Create test charges
  - Read customer emails from Stripe
Personal information at risk: customer names, email addresses from Stripe
Harm assessment: MEDIUM — financial data in Stripe accessible

STEP 4 — Notify
Check Stripe access logs: were any unusual API calls made during the 3 hours?
If NO unusual calls: may argue no actual breach occurred (but document everything)
If YES unusual calls: eligible data breach — notify OAIC within 30 days
Affected individuals (if breach occurred): notify customers whose payment data was accessed

STEP 5 — Remediate
Root cause: .env file accidentally committed; .gitignore not configured correctly
Fix: audit all commits, add pre-commit hook to prevent credential commits
     git-secrets or similar tool
```

---

## TERM: Criminal Code Act 1995 — What you can and can't do

**The key sections:**

```
s477.1 — Unauthorised modification of data
Intent: commit or facilitate a serious offence
Penalty: Up to 10 years

s477.2 — Unauthorised modification (general)
Includes: deleting, encrypting, corrupting data
Penalty: Up to 10 years

s477.3 — Unauthorised impairment of electronic communications
Includes: blocking network traffic, DDoS attacks
Penalty: Up to 10 years

s478.1 — Unauthorised access to or modification of restricted data
The "everyday hacking" section
Penalty: Up to 2 years

KEY WORD: "Unauthorised"
You cannot commit these offences against your OWN systems.
Testing drivebook.com.au that you own → authorised → not a crime.
Testing competitor's site without permission → unauthorised → crime.
```

**Pen tester's legal checklist:**
```
Before any test:
□ Written authorisation from system owner (not just verbal)
□ Scope defined (what systems, what time window, what methods allowed)
□ Rules of engagement documented (can you test production? what to do if you find PII?)
□ Out-of-scope systems clearly listed
□ Contact details for system owner in case of incident

During test:
□ Stay within defined scope
□ Don't access, copy, or exfiltrate actual user data
□ Stop immediately if you find evidence of existing compromise by others
□ Document everything with timestamps

After test:
□ Provide report within agreed timeframe
□ Allow client reasonable time to fix before disclosing publicly
```

---

## TERM: Ethical Hacking vs Malicious Hacking

**Same technical skills, completely different legal and ethical standing:**

```
MALICIOUS HACKER (Black Hat):
- No permission
- Motivation: financial gain, disruption, malice
- Keeps vulnerabilities secret for personal use
- Criminal under Criminal Code Act

ETHICAL HACKER / PENETRATION TESTER (White Hat):
- Written permission from owner
- Motivation: improve security, earn a fee
- Discloses all findings to the owner
- Protected by written authorisation

GREY HAT:
- No permission, but no malicious intent
- "I found a bug in your site, please pay me to not disclose it"
- Still unauthorised access → still potentially criminal
- Even if well-intentioned, legally risky
```

**Responsible Disclosure Policy — what you should add to DriveBook:**

```markdown
<!-- Add to drivebook.com.au/security or footer link -->

# Responsible Disclosure Policy

DriveBook takes security seriously. If you discover a security vulnerability,
we appreciate your help in disclosing it responsibly.

## What to report
- SQL injection, XSS, or other code injection vulnerabilities
- Authentication or authorisation bypasses
- Exposure of personal or financial data
- Vulnerabilities in our API

## How to report
Email: security@drivebook.com.au
Include: description, steps to reproduce, evidence (screenshots, logs)
Do NOT include actual user data in your report.

## Our commitment
- We will acknowledge your report within 5 business days
- We will keep you informed of our progress
- We will not pursue legal action against researchers acting in good faith
- We will credit you in our security acknowledgements if you wish

## Out of scope
- Social engineering attacks against our staff or customers
- Physical attacks
- Denial of service attacks
- Automated scanning without prior approval
```

This policy costs nothing and actively invites security researchers to help you for free.
