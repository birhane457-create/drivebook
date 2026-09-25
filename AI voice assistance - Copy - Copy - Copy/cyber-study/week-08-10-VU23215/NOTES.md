# Weeks 8–10 — VU23215: Test Concepts and Procedures for Cyber Security

## What this unit is about

Practical security testing — the "ethical hacking" unit:
- Vulnerability scanning and assessment
- Penetration testing methodology
- Common web application vulnerabilities (OWASP Top 10)
- Security tools (Nmap, Burp Suite, Nikto, OWASP ZAP)
- Writing a security test report

---

## 1. Penetration Testing Methodology

### Phases of a pen test

```
1. PLANNING & RECONNAISSANCE
   Define scope, get written authorisation, gather intelligence
   
2. SCANNING
   Discover open ports, services, software versions
   
3. GAINING ACCESS (EXPLOITATION)
   Attempt to exploit discovered vulnerabilities
   
4. MAINTAINING ACCESS
   Would an attacker be able to persist? (rootkits, backdoors)
   
5. REPORTING
   Document findings, severity, evidence, and remediation
```

### Critical rule: **Always get written authorisation first**
Testing a system you don't own without permission = computer crime under the Criminal Code Act 1995 (Cth).

### Types of testing

| Type | Knowledge level | Use case |
|------|----------------|---------|
| **Black box** | Zero — like a real attacker | Simulates external attacker |
| **White box** | Full — code + architecture access | Most thorough, developer-assisted |
| **Grey box** | Partial — some credentials, limited docs | Typical for commissioned pen tests |

---

## 2. OWASP Top 10 Web Vulnerabilities

The most common web application vulnerabilities (2021 edition):

### A01: Broken Access Control
Users can access resources they shouldn't.

**Example:** A student changes their booking URL from `/booking/123` to `/booking/124`
and can view another student's private lesson details.

**Defence in DriveBook:**
```typescript
// Always verify ownership before returning data
const booking = await prisma.booking.findUnique({ where: { id } })
if (booking.clientId !== session.user.clientId) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

### A02: Cryptographic Failures
Sensitive data exposed due to weak or missing encryption.

**Examples:** Storing passwords in plaintext, using MD5 for hashing, HTTP instead of HTTPS

**DriveBook:** Uses `bcrypt` (cost factor 10) for passwords. All traffic is HTTPS via Vercel.

### A03: Injection
Attacker injects malicious code into a query or command.

**SQL Injection example:**
```sql
-- Attacker enters this as a username:
' OR '1'='1'; DROP TABLE users; --

-- Vulnerable query becomes:
SELECT * FROM users WHERE username = '' OR '1'='1'; DROP TABLE users; --'
```

**DriveBook defence:** Prisma ORM uses parameterised queries — user input is NEVER
concatenated directly into SQL. Prisma handles escaping automatically.

### A04: Insecure Design
Flaws in the application design itself, not just implementation.

**Example:** Allowing unlimited login attempts with no lockout (no rate limiting on auth).

**DriveBook:** `authRateLimit` — 5 attempts per 15 minutes per IP.

### A05: Security Misconfiguration
Default credentials, unnecessary features enabled, verbose error messages.

**Examples:** 
- `DEBUG=True` in production (exposes stack traces)
- Default admin password unchanged
- Unnecessary HTTP methods enabled (TRACE, PUT on public endpoints)

**DriveBook:** `instrumentation.ts` validates critical env vars at startup — prevents
deploying with missing/placeholder secrets.

### A06: Vulnerable and Outdated Components
Using libraries with known security vulnerabilities.

**Defence:** `npm audit` — run regularly. Dependabot alerts on GitHub.

### A07: Identification and Authentication Failures
Weak passwords, broken session management, missing MFA.

**DriveBook:**
- Sessions use HttpOnly, Secure, SameSite=Lax cookies
- Session max age: 7 days (not 30)
- JWT signed with `NEXTAUTH_SECRET` — can't be forged without the secret

### A08: Software and Data Integrity Failures
Untrusted deserialization, unsigned software updates.

**Example:** Stripe webhook without signature verification — attacker POSTs fake
`payment_intent.succeeded` to trigger wallet credit without actual payment.

**DriveBook defence:**
```typescript
// Verify Stripe signature before processing
const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
```

### A09: Security Logging and Monitoring Failures
No logs = no way to detect a breach in progress.

**DriveBook:** `lib/services/auditLogger.ts` — every financial and admin action logged
with actor, IP, timestamp, and result.

### A10: Server-Side Request Forgery (SSRF)
Attacker tricks the server into making requests to internal resources.

**Example:** If DriveBook had a feature to fetch a URL the user provides, an attacker
could provide `http://169.254.169.254/latest/meta-data/` (AWS metadata service) to
extract cloud credentials.

**Defence:** Never fetch user-provided URLs without validation. Whitelist allowed domains.

---

## 3. Common Security Tools

| Tool | Purpose | Use |
|------|---------|-----|
| **Nmap** | Port scanning | `nmap -sV target.com` — find open ports and service versions |
| **Burp Suite** | HTTP proxy / web app testing | Intercept and modify HTTP requests |
| **OWASP ZAP** | Web app vulnerability scanner | Automated scanning for OWASP Top 10 |
| **Nikto** | Web server scanner | Check for misconfigurations, outdated software |
| **Wireshark** | Packet analyser | Capture and inspect network traffic |
| **Metasploit** | Exploitation framework | Test known vulnerabilities (with authorisation) |
| **John the Ripper / Hashcat** | Password cracking | Test password strength |

---

## 4. Writing a Penetration Test Report

Structure:
```
Executive Summary
  - What was tested (scope)
  - When it was tested
  - Overall risk rating (Critical / High / Medium / Low)
  
Findings
  - For each finding:
    - Vulnerability name
    - Severity (CVSS score)
    - Affected component
    - Description
    - Evidence (screenshot / request/response)
    - Remediation steps
    
Conclusion
  - Overall security posture
  - Priority remediation items
  
Appendix
  - Full scan output
  - Test methodology
```

---

## Practice Task

Perform a self-assessment of DriveBook against OWASP Top 10.
For each item, write:
1. Is the vulnerability present? (Yes / No / Partially)
2. What evidence supports your answer?
3. If present, what's the remediation?

This is exactly the kind of practical task your your assessor will ask for.
Use the DRIVEBOOK-EXAMPLES.md file in this folder for your answers.
