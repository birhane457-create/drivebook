# Weeks 12–14 — VU23220: Develop and Carry Out a Cyber Security Industry Project

## What this unit is about

This is your capstone project. You design and execute a real security project for an organisation.

Since you own DriveBook, **your project IS DriveBook**.
This is a significant advantage — most students have to arrange access to a client.
You have full access to the codebase, infrastructure, and business context.

The assessor needs to see you complete a structured project with:
- A defined scope and objectives
- Risk assessment
- Implementation of security controls
- Testing and verification
- A formal written report

---

## Recommended Project: DriveBook Security Hardening Plan

### Project Title
**Cyber Security Hardening for DriveBook.com.au — A Financial SaaS Platform**

### Objective
Identify, prioritise, and remediate the top security gaps in DriveBook's web application
and infrastructure, with a focus on protecting financial data and user privacy.

---

## Project Plan (3 weeks)

### Week 12 — Discovery and Risk Assessment

**Tasks:**
1. Document current architecture (use the tech stack table from README.md)
2. Run `npm audit` on the main app — record all findings
3. Run OWASP ZAP or a manual walkthrough against `localhost:3000`
4. Review the OWASP self-assessment from Week 8–10
5. Create a formal Risk Register (template below)

**Deliverable:** Risk Register with all identified findings rated by likelihood and impact

### Week 13 — Implementation

**Tasks:**
1. Fix at least 3 findings from the risk register
2. Document each fix with: before/after code, how it addresses the vulnerability
3. Add the X-Forwarded-For single IP extraction (`rawIp.split(',')[0].trim()`)
4. Implement automated audit log review (cron that emails suspicious activity)
5. Write the Incident Response Plan (template in DRIVEBOOK-EXAMPLES.md)

**Deliverable:** Code changes committed, Incident Response Plan document

### Week 14 — Testing and Reporting

**Tasks:**
1. Retest each fixed finding — verify the vulnerability is no longer present
2. Write the final security report (use the pen test report structure from Week 8–10)
3. Prepare a 10-minute presentation of your findings

**Deliverable:** Final security report + presentation

---

## Risk Register Template

| ID | Finding | Category | Likelihood | Impact | Risk Score | Control | Status |
|----|---------|----------|------------|--------|------------|---------|--------|
| R01 | No MFA on instructor accounts | A07 | Medium | High | High | Add TOTP MFA option | Open |
| R02 | No automated security alert on failed auth | A09 | Low | Medium | Medium | Daily AuditLog cron | Open |
| R03 | npm audit high severity packages | A06 | Unknown | High | High | Run audit, patch | Open |
| R04 | No formal Incident Response Plan | Design | High | High | Critical | Create IRP document | Open |
| R05 | videoUrl accepts any domain | A10 | Low | Low | Low | Whitelist YT/Vimeo | Open |

**Risk Score = Likelihood × Impact (1–5 scale, score = product)**

---

## Incident Response Plan Template

File this as: `cyber-study/week-12-14-VU23220/INCIDENT-RESPONSE-PLAN.md`

```markdown
# DriveBook Incident Response Plan
Version: 1.0
Date: [date]
Owner: Debesay Weldegebriel Birhane

## 1. Purpose
This plan defines the steps to be taken when a security incident is detected affecting
DriveBook's systems, data, or users.

## 2. Scope
Applies to all DriveBook systems: main app (Vercel), hybrid service (Railway),
database (Supabase), file storage (Cloudinary), payment processing (Stripe).

## 3. Incident Classification
| Severity | Definition | Example |
|----------|------------|---------|
| Critical | Active breach, data exposed, financial fraud in progress | DB dump in the wild |
| High | Suspected breach, service down, financial anomaly | Unexpected 500 errors + unusual DB queries |
| Medium | Vulnerability discovered, no active exploitation | npm audit critical finding |
| Low | Policy violation, minor misconfiguration | Log entry anomaly |

## 4. Response Phases

### Phase 1 — Detect (within 1 hour)
- Source: automated alerts, user report, manual discovery
- Log detection time and initial symptoms
- Assign severity level

### Phase 2 — Contain (within 2 hours for Critical/High)
- Critical: take system offline or block affected component
- Revoke compromised credentials immediately
- Preserve logs — do NOT delete anything
- For Stripe: contact Stripe fraud team if payment fraud suspected

### Phase 3 — Investigate (within 24 hours)
- Query AuditLog table for suspicious activity
- Check Vercel/Railway access logs
- Determine: what was accessed, by whom, for how long
- Establish timeline of events

### Phase 4 — Notify (within 30 days under NDB scheme)
- If personal data was exposed: notify OAIC
- Notify affected individuals directly if serious harm risk
- Draft customer notification email

### Phase 5 — Remediate
- Apply fix for root cause
- Test fix before redeployment
- Update security controls to prevent recurrence

### Phase 6 — Review
- Write incident report (what happened, impact, what was fixed)
- Update risk register
- Update this IRP if gaps identified

## 5. Contacts
- OAIC (data breach notification): oaic.gov.au/privacy/notifiable-data-breaches
- ACSC (report a cyber attack): cyber.gov.au/report
- Stripe security: security@stripe.com
- Supabase support: supabase.com/support
```
