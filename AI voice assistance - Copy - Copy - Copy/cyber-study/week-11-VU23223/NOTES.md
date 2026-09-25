# Week 11 — VU23223: Cyber Security Legislation, Privacy and Ethical Practices

## What this unit is about

Australian law and ethics as they apply to cyber security:
- Privacy Act 1988 (Cth) and Australian Privacy Principles (APPs)
- Notifiable Data Breaches scheme
- Criminal Code Act 1995 — computer crimes
- Ethical obligations of security professionals
- Codes of conduct (ACS, ISACA)

---

## 1. Privacy Act 1988 (Cth)

### Who it applies to
- Australian Government agencies
- Businesses with annual turnover > $3 million
- Health service providers (any size)
- **Businesses that opt in**
- **Note:** Small businesses under $3M can still be caught if they handle sensitive information or operate online platforms collecting personal data

### Australian Privacy Principles (APPs) — 13 principles

The ones most relevant to DriveBook:

| APP | Principle | DriveBook relevance |
|-----|-----------|---------------------|
| APP 1 | Open and transparent management | Published privacy policy required |
| APP 3 | Collection of solicited personal information | Only collect what's necessary — don't collect data you don't need |
| APP 5 | Notification of collection | Tell users what you're collecting and why at the point of collection |
| APP 6 | Use or disclosure | Only use data for the purpose it was collected |
| APP 7 | Direct marketing | Can't use personal info for marketing without consent |
| APP 11 | Security | Must take reasonable steps to protect personal information |
| APP 12 | Access | Individuals can request access to their own data |
| APP 13 | Correction | Individuals can request correction of inaccurate data |

### Sensitive information (higher protection)
Racial or ethnic origin, political opinions, religious beliefs, sexual orientation,
health information, biometric data, criminal record.

DriveBook doesn't collect most of these — but instructor police check documents
(uploaded for verification) could be considered sensitive health/criminal record data.

---

## 2. Notifiable Data Breaches (NDB) Scheme

Part of the Privacy Act. If you suffer an "eligible data breach" you must:

1. **Notify the OAIC** (Office of the Australian Information Commissioner) within 30 days
2. **Notify affected individuals** directly if at serious risk of harm

### What is an eligible data breach?
- Unauthorised access, disclosure, or loss of personal information
- **AND** likely to result in serious harm to affected individuals

### Harm factors:
- Financial harm (bank account details exposed)
- Physical harm (home address of domestic violence survivor)
- Reputational damage
- Identity theft risk

### DriveBook breach scenario:
If your database is compromised and instructor bank details + student personal info
is exposed, you have an **eligible data breach**. You must notify OAIC within 30 days
and notify affected instructors and students.

**Your current gap:** No formal Incident Response Plan exists. This is your training provider
assessor's Week 12-14 project topic. Start thinking about it now.

---

## 3. Criminal Code Act 1995 (Cth) — Computer Crimes

| Section | Offence | Maximum penalty |
|---------|---------|----------------|
| 477.1 | Unauthorised access/modification with intent to commit serious offence | 10 years |
| 477.2 | Unauthorised modification of data | 10 years |
| 477.3 | Unauthorised impairment of electronic communications | 10 years |
| 478.1 | Unauthorised access or modification | 2 years |

**Key point:** "Unauthorised" means without permission of the owner.
Pen testing your own system = authorised = legal.
Pen testing someone else's system without written permission = criminal.

---

## 4. Other Relevant Legislation

### Spam Act 2003
- Cannot send commercial electronic messages without consent
- Must include a working unsubscribe mechanism
- Applies to your marketing emails and SMS

### Telecommunications (Interception and Access) Act 1979
- Prohibits intercepting private communications
- Relevant if you log or store message content (not just metadata)

### Consumer Data Right (CDR)
- Gives consumers the right to access and share their own data
- Currently applies to banking and energy sectors — watch for future extension to tech platforms

---

## 5. Ethical Obligations

### ACS (Australian Computer Society) Code of Ethics
Core values:
- Primacy of the Public Interest
- Enhancement of Quality of Life
- Honesty
- Competence
- Professional Development
- Professionalism

### Responsible Disclosure
If you discover a vulnerability in another organisation's system:
1. Do NOT exploit it
2. Do NOT publicise it
3. Contact the organisation privately with details
4. Give them reasonable time to fix it (typically 90 days)
5. Only publish after they've fixed it (or after the deadline)

---

## Practice Questions

**Q1:** A small driving instruction business processes student personal data online but has annual revenue under $3 million. Is it covered by the Privacy Act?

**Model answer:** Possibly yes. The Privacy Act's $3M threshold has exceptions. If the business collects sensitive information (health data, biometrics) or trades in personal information, it may be covered regardless of turnover. The business should review the OAIC guidance or seek legal advice. If voluntarily registered with the Privacy Act, full obligations apply.

**Q2:** You are a security researcher and discover that a competitor's website has a SQL injection vulnerability exposing all their customer data. What are your ethical and legal obligations?

**Model answer:** Do not exploit the vulnerability. Do not access the data. Contact the organisation privately through their security contact or general inquiry channel. Document your discovery without accessing protected data. Give them 90 days to fix the issue. If they don't respond or fix it, you may consider reporting to the ACSC or OAIC. Exploiting the vulnerability or downloading data would constitute an offence under the Criminal Code Act 1995 (s478.1 or s477.2) even if discovered accidentally.
