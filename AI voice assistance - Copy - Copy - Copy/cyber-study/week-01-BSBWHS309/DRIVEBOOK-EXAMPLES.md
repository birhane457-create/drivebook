# BSBWHS309 — DriveBook Real-World Examples

## Your WHS situation as a solo founder

You work alone from home, 3–4 hours/day on the platform plus business operations.
This is relevant WHS territory — the assessor may ask about your own setup.

### Physical hazards you currently face:
- Extended screen time (eye strain, headaches)
- Repetitive keyboard/mouse use (RSI risk)
- Home office setup (chair, desk, lighting)

### Psychological hazards:
- On-call pressure — when a customer reports a payment issue at 2am, you handle it alone
- Incident stress — a Stripe webhook failure means real money is at risk
- Isolation — no team to consult when making high-stakes decisions

### What you already have that counts as WHS controls:

**Automated alerting** reduces on-call stress:
- Cron health monitoring (`lib/services/cron-health.ts`) alerts you when scheduled jobs fail
  rather than you discovering issues manually
- Stripe webhook error logging means failures are captured, not silently lost

**Documented procedures** reduce decision pressure:
- `docs/DOCROLEBASE/00-overview/ADMIN_BUSINESS_RULES.md` — documented business rules
  mean you don't have to make judgment calls under pressure; rules are pre-decided

**This is an administrative WHS control** — documented procedures reduce the cognitive
burden on the worker (you), which reduces psychological hazard.

---

## For your the assessment

If asked to give a real example of WHS in your work:

> "As a solo IT operator managing a live financial platform, I identified on-call response pressure as a psychological WHS hazard. I applied an administrative control by implementing automated monitoring systems that detect and alert on failures (cron health checks, error logging) so I receive structured notifications rather than discovering issues reactively. I also documented all business rules and incident response procedures so high-pressure decisions are made against pre-agreed criteria rather than in the moment."

This maps to:
- Hazard identified: psychological stress from reactive incident management
- Control applied: administrative (automation + documentation)
- Evidence: `lib/services/cron-health.ts`, `docs/DOCROLEBASE/`
