# Weeks 4–5 — VU23217: Recognise the Need for Cyber Security in an Organisation

## What this unit is about

This is the "why does cyber security matter" unit. It covers:
- Types of cyber threats and attacks
- CIA triad (Confidentiality, Integrity, Availability)
- Organisational assets and what needs protecting
- Risk assessment basics
- Security frameworks (like ISO 27001, NIST)

---

## Key Concepts

### 1. The CIA Triad

Every security decision maps to one or more of these three:

| Principle | Definition | Example in DriveBook |
|-----------|------------|---------------------|
| **Confidentiality** | Only authorised people can read data | Instructor bank details only visible to admin |
| **Integrity** | Data is accurate and hasn't been tampered with | Wallet balance can't be changed except through authorised transactions |
| **Availability** | Systems are accessible when needed | App stays up even during a DB query spike |

### 2. Types of Cyber Threats

| Threat | Definition | Real risk to DriveBook |
|--------|------------|----------------------|
| **Phishing** | Fake emails tricking users into giving credentials | Instructor gets fake "DriveBook reset password" email |
| **SQL Injection** | Malicious SQL in form inputs to extract/modify DB data | Attacker puts `'; DROP TABLE bookings;--` in a form field |
| **DDoS** | Flooding a server with requests to take it down | Competitor floods booking endpoint to make site unavailable |
| **Credential stuffing** | Using leaked username/password combos from other breaches | Someone tries 10,000 email/password combos on /login |
| **Man-in-the-Middle** | Intercepting communication between client and server | Attacker intercepts payment data over HTTP (not HTTPS) |
| **Insider threat** | Authorised user abuses access | Disgruntled admin extracts all instructor payout data |
| **Supply chain attack** | Compromise via a third-party dependency | Malicious npm package in your node_modules |

### 3. Risk Assessment Process

**Risk = Likelihood × Impact**

Steps:
1. **Identify assets** — what needs protecting?
2. **Identify threats** — what could go wrong?
3. **Assess likelihood** — how probable is each threat?
4. **Assess impact** — what's the damage if it happens?
5. **Prioritise** — high likelihood + high impact = fix first
6. **Apply controls** — what do you do about it?
7. **Review** — reassess after controls are applied

### 4. Security Frameworks

**NIST Cybersecurity Framework (CSF):**
Five functions:
- Identify → Protect → Detect → Respond → Recover

**ISO/IEC 27001:**
International standard for Information Security Management Systems (ISMS).
Not required for training provider but good to know the name.

**Australian Cyber Security Centre (ACSC) Essential Eight:**
Eight baseline mitigation strategies for Australian businesses:
1. Application control
2. Patch applications
3. Configure Microsoft Office macro settings
4. User application hardening
5. Restrict admin privileges
6. Patch operating systems
7. Multi-factor authentication
8. Regular backups

---

## Practice Questions

**Q1:** What is the CIA triad and why is it the foundation of cyber security?

**Q2:** A small business stores customer payment details in an unencrypted spreadsheet on a shared drive. Identify the risks using the CIA triad.

**Model answer Q2:**
- Confidentiality: Any staff member with drive access can read payment details — should be restricted to authorised finance staff only
- Integrity: Anyone can edit the spreadsheet, changing payment amounts or adding fraudulent records — no audit trail
- Availability: If the shared drive goes down, the file is inaccessible — no backup

Controls needed: Encrypt the file, restrict access via permissions, maintain an access log, back up regularly.
