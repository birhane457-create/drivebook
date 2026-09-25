# VU23217 — Deep Dive: Cyber Security Fundamentals with Real Examples

## TERM: Threat Actor

**What it is:** Any person or group that poses a threat to a system.

**Why you need it:** Different actors have different motivations, capabilities, and techniques. Knowing the actor changes your defence strategy.

**Categories:**

```
NATION-STATE ACTOR
  Who: Government-sponsored hackers (Russia's FSB, China's APT41, North Korea's Lazarus)
  Motivation: Espionage, disruption, financial theft for sanctions evasion
  Capability: Very high — zero-day exploits, custom malware, years of persistence
  Target: Critical infrastructure, government, large financial institutions
  DriveBook risk: Very low — too small a target

ORGANISED CRIME
  Who: Cybercriminal syndicates (REvil ransomware, FIN7 financial fraud groups)
  Motivation: Money
  Capability: High — ransomware, credential theft, card fraud
  Target: Businesses handling money — payment processors, banks, SaaS platforms
  DriveBook risk: Medium — you handle real money via Stripe

SCRIPT KIDDIES
  Who: Unskilled individuals using downloaded tools
  Motivation: Fun, reputation, curiosity
  Capability: Low — using Metasploit, SQLmap, automated scanners
  Target: Anything they can find — opportunistic
  DriveBook risk: Medium — automated scans happen constantly

INSIDER THREAT
  Who: Current or former employee/contractor with access
  Motivation: Financial gain, revenge, curiosity
  Capability: High — knows the system, has legitimate credentials
  Target: Sensitive data they can access
  DriveBook risk: Low currently (solo) but grows with team

HACKTIVIST
  Who: Politically motivated hackers (Anonymous, etc.)
  Motivation: Ideology, making a statement
  Capability: Medium — DDoS, defacement, data dumps
  Target: Companies they disagree with politically
  DriveBook risk: Very low
```

---

## TERM: Attack Surface

**What it is:** The total set of points where an attacker could enter your system.

**Why it matters:** To reduce risk, reduce your attack surface. Every endpoint, port, and service you expose is a potential entry point.

**DriveBook attack surface analysis:**

```
EXTERNAL ATTACK SURFACE (internet-facing):
┌─────────────────────────────────────────────────────────────┐
│ ENDPOINT                     │ RISK             │ PROTECTED? │
├──────────────────────────────┼──────────────────┼────────────┤
│ GET /api/instructors/*       │ Info disclosure  │ Partial    │
│ POST /api/auth/*             │ Credential theft │ Rate limit │
│ POST /api/register           │ Spam, enumeration│ Rate limit │
│ POST /api/public/bookings/*  │ Spam, fraud      │ Rate limit │
│ POST /api/stripe/webhook     │ Fake events      │ Signature  │
│ POST /api/verifications/otp  │ Brute force OTP  │ Rate limit │
│ GET /.env                    │ Secret exposure  │ Vercel 404 │
│ GET /api/admin/*             │ Privilege escal. │ Role check │
└──────────────────────────────┴──────────────────┴────────────┘

INTERNAL ATTACK SURFACE (only from within Vercel/Railway):
- PostgreSQL :5432  → Only Vercel internal network
- Redis :6379      → Only via Upstash REST API over HTTPS
- Railway :3001    → Only VAPI with secret header
```

**How to reduce attack surface:**
```
1. Disable unused endpoints → return 404 or 405
2. Remove debug endpoints in production → /api/debug, /api/test
3. Restrict allowed HTTP methods → OPTIONS, TRACE should return 405
4. Remove default framework files → readme, license, changelog files
5. Close unused ports → only 80 and 443 should be open externally
```

---

## TERM: Social Engineering

**What it is:** Manipulating people rather than systems to gain access.

**Why it matters:** The most secure technical system can be bypassed by tricking a human. 85% of successful breaches start with social engineering (phishing).

**Types with real examples:**

**Phishing — email:**
```
From: security@drivebook-accounts.com  ← FAKE domain (drivebook-accounts, not drivebook)
Subject: Urgent: Your instructor account has been suspended

Dear Debesay,

We detected suspicious activity on your DriveBook instructor account.
Your account has been temporarily suspended pending verification.

To restore access, please verify your identity here:
https://drivebook-accounts.com/verify   ← FAKE SITE

You have 24 hours before your account is permanently deleted.

[VERIFY NOW]
```

**Spear Phishing (targeted):**
Unlike generic phishing, attacker researches the target first:
```
From: support@drivebook-au.com
Subject: Your payout for week ending 21 July has been delayed

Hi Debesay,

Your payout of $790.20 for the week ending 21 July has been delayed
due to a bank verification requirement.

Please update your bank details here to receive your payment:
[LINK]

This is specific to you — attacker found your instructor profile,
saw you're based in Maylands, estimated your weekly earnings.
```

**Vishing (voice phishing):**
```
Caller: "Hi, this is Debesay? I'm calling from Stripe's fraud team.
         We've detected unusual activity on your account.
         To prevent your account being frozen, I need to verify
         your secret key. Can you read me the sk_live_... value?"

NEVER give API keys, passwords, or 2FA codes over the phone.
Legitimate companies never ask for these.
```

**Pretexting:**
```
Attacker: poses as a new instructor who needs help with their account
          contacts your support email
          claims they can't log in
          asks for their account to be reset to a new email address they control
          
PROTECTION: Identity verification before account changes
          Verify via registered phone number, not just email
```

---

## TERM: Malware Types

**What they are:** Malicious software designed to harm, disrupt, or gain unauthorised access.

**Types and how they work:**

```
VIRUS
  Attaches to a legitimate file
  Spreads when infected file is shared
  Activates when file is opened
  Example: Infected Word document macro

WORM
  Self-replicating without user interaction
  Spreads across networks automatically
  Example: WannaCry ransomware spread via MS17-010 SMB vulnerability

TROJAN
  Disguised as legitimate software
  "Gift" that contains a payload
  Example: Fake VPN app that installs keylogger

RANSOMWARE
  Encrypts all files on the system
  Demands payment for decryption key
  Example: REvil, LockBit — targeted businesses, demanded $50k–$5M
  DriveBook risk: If your laptop is infected and has GitHub credentials,
  attacker could push malicious code or access your database credentials

KEYLOGGER
  Records every keystroke
  Captures passwords, API keys, credit card numbers
  Often installed via trojan

ROOTKIT
  Hides itself from the OS and security software
  Achieves persistence — survives reboots
  Extremely difficult to detect and remove

SPYWARE
  Monitors activity without user knowledge
  Sends data to attacker
  Often bundled with "free" software

ADWARE
  Displays unwanted advertisements
  Lower severity but often bundles spyware
```

**How malware gets in:**
```
1. Email attachment (.doc, .pdf, .exe, .zip with .exe inside)
2. Malicious download (pirated software, fake updates)
3. Drive-by download (visiting infected website — no click required)
4. USB drive (dropped in car park, plugged by curious employee)
5. Supply chain (malicious code in a software update or npm package)
6. Exploitation of unpatched vulnerability (WannaCry spread this way)
```

---

## TERM: Defence in Depth

**What it is:** Multiple independent layers of security so that if one layer fails, others still protect the system.

**Why it matters:** No single control is perfect. Layer them so attackers must bypass multiple defences.

**DriveBook defence in depth — illustrated:**

```
ATTACKER tries to get instructor bank details

LAYER 1: Network (Vercel DDoS)
  Attacker must reach the server without being blocked by volumetric protection
  ↓ passed

LAYER 2: HTTPS / TLS
  Attacker must be able to decrypt traffic (they can't without private key)
  ↓ passed (they're sending requests, not intercepting)

LAYER 3: Rate Limiting
  Attacker tries many login combinations
  After 5 failed attempts in 15 min → blocked (429)
  ↓ needs to rotate IPs or be patient

LAYER 4: Authentication (NextAuth)
  Attacker must know a valid email + password
  ↓ needs credential from breach dump (bcrypt slows cracking)

LAYER 5: Session Cookie Security
  Session stored in HttpOnly cookie — can't be stolen via XSS
  ↓ needs to physically compromise device or use MITM (blocked by TLS)

LAYER 6: Authorisation (Role checks)
  Even logged in, instructor can only see their own data
  Bank details route checks: session.user.instructorId === payout.instructorId
  ↓ can only access their OWN bank details

LAYER 7: Audit Logging
  Every access to bank details is logged
  Even if attacker succeeds, forensic trail exists
  ↓ evidence preserved

LAYER 8: Alert Monitoring (GAP — not yet implemented)
  Unusual access patterns would trigger alerts
```

---

## TERM: Security Frameworks

### NIST Cybersecurity Framework (CSF)

**What it is:** A voluntary framework of best practices published by the US National Institute of Standards and Technology.

**The 5 functions — with DriveBook examples:**

```
1. IDENTIFY
   Know what you're protecting.
   
   DriveBook application:
   - Asset inventory: database (PII), payment data, source code, credentials
   - Risk assessment: which assets have the highest impact if compromised?
   - Governance: who is responsible for security? (You, as founder)

2. PROTECT
   Put controls in place to prevent incidents.
   
   DriveBook application:
   - Access controls: role-based auth, session cookies
   - Data security: bcrypt passwords, HTTPS, Cloudinary signed URLs
   - Protective technology: rate limiting, Zod validation, Prisma parameterised queries

3. DETECT
   Identify when a security event has occurred.
   
   DriveBook application:
   - Audit logging: auditLogger.ts records all financial actions
   - Anomaly detection: (GAP — not yet alerting on suspicious patterns)
   - Stripe webhook events: payment failures, dispute notifications

4. RESPOND
   Take action when an incident is detected.
   
   DriveBook application:
   - Incident response plan: (created in Week 12-14 study notes)
   - Stripe fraud team contact
   - OAIC notification process for data breaches

5. RECOVER
   Restore normal operations after an incident.
   
   DriveBook application:
   - Database backups: Supabase daily automated backups
   - Infrastructure-as-code: Vercel/Railway can be redeployed
   - Session revocation: invalidate all sessions if compromise detected
```

### ACSC Essential Eight

**What it is:** Eight mitigation strategies recommended by the Australian Cyber Security Centre as a baseline for Australian businesses.

**All eight with DriveBook status:**

```
1. APPLICATION CONTROL
   Only allow approved applications to execute.
   DriveBook status: N/A (server-side, Vercel controls runtime)
   For your laptop: Use App Locker or Gatekeeper

2. PATCH APPLICATIONS
   Keep all software up to date.
   DriveBook status: PARTIAL
   - npm audit run occasionally
   - Next.js updated to 14.x
   - GAP: no automated Dependabot alerts configured

3. CONFIGURE MICROSOFT OFFICE MACRO SETTINGS
   Disable macros or only allow signed macros.
   DriveBook status: N/A (no Office environment)
   For your business: disable macros in any Office documents received by email

4. USER APPLICATION HARDENING
   Configure browsers and applications securely.
   DriveBook status: PARTIAL
   - Content Security Policy: not yet fully configured
   - Subresource Integrity: CDN scripts (marked.js, highlight.js) should have SRI hashes

5. RESTRICT ADMINISTRATIVE PRIVILEGES
   Minimum necessary access for each account.
   DriveBook status: IMPLEMENTED
   - Admin routes check session.user.role === 'ADMIN'
   - Instructors cannot access admin endpoints
   - No shared admin accounts

6. PATCH OPERATING SYSTEMS
   Keep OS patched and updated.
   DriveBook status: N/A (serverless — Vercel/Railway patch the runtime)
   For your laptop: Windows Update enabled, auto-apply

7. MULTI-FACTOR AUTHENTICATION
   Require MFA for privileged accounts and sensitive systems.
   DriveBook status: NOT IMPLEMENTED — known gap
   Priority: Add TOTP MFA for:
   - Admin accounts (controls all data)
   - Instructor accounts (controls bank details)
   
8. REGULAR BACKUPS
   Regular, tested, offline backups.
   DriveBook status: PARTIAL
   - Supabase: daily automated backups (7-day retention on free tier)
   - GAP: backups not tested (can you actually restore?)
   - GAP: no offline/offsite copy
```

---

## TERM: Zero-Day Vulnerability

**What it is:** A vulnerability that is unknown to the software vendor and has no patch available. "Zero days" refers to the zero days the vendor has had to fix it.

**Timeline:**
```
Day 0:    Vulnerability discovered (by researcher, security company, or attacker)
Day 1–X:  If discovered by attacker: actively exploited while vendor is unaware
          If discovered by researcher: responsible disclosure process begins
Day X+90: Patch released (90 days is standard disclosure deadline)
After:    Becomes a "known" CVE, no longer zero-day
```

**Why it matters for DriveBook:**
You can't patch what doesn't exist yet. Defence:
1. Defence in depth — even if one layer is bypassed, others catch it
2. Minimise attack surface — less code exposed = fewer possible zero-days
3. Monitor for anomalies — even an unknown exploit leaves traces
4. Keep software updated — zero-days become known CVEs; patch fast

---

## Summary: Expected Knowledge for the Assessment

The assessor expects you to:

1. **Define and explain the CIA triad with examples from YOUR system**
   Not just "Confidentiality means data is private" — but specifically what data in DriveBook is confidential, how it's protected, and what would happen if it were breached.

2. **Identify threat actors relevant to your platform**
   "The most relevant threat actors for DriveBook are organised crime (financial motivation, credential stuffing for payout redirection) and script kiddies (automated scans, SQLmap on public endpoints). Nation-state actors are not relevant given the platform's current size."

3. **Perform a risk assessment**
   Use the risk register format from Week 12-14. Rate at least 5 findings.

4. **Map controls to the CIA triad and NIST functions**
   "Rate limiting (Protect function) preserves Availability by preventing DoS. Audit logging (Detect function) supports Integrity by creating an evidence trail for forensic investigation."

5. **Name the ACSC Essential Eight and rate your compliance**
   Know which ones apply to your platform and which are gaps.
