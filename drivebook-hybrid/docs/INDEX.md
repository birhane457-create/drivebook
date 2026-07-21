# DriveBook Hybrid — Documentation Index

**Last Updated:** July 2026  
**Purpose:** Current reference docs for the voice AI service and platform operations. No history.

---

## AI Voice Receptionist

| File | What it covers |
|------|---------------|
| `AI_SYSTEM.md` | VAPI assistant design, conversation flow, tool contracts |
| `AI_VOICE_RECEPTIONIST_GUIDE.md` | Operator guide — provisioning lines, testing, troubleshooting |
| `ARCHITECTURE.md` | Hybrid service architecture — how drivebook-hybrid talks to main app |
| `INTEGRATION.md` | Integration guide — API contracts, environment variables |
| `DEPLOYMENT.md` | Deployment to Railway, env var reference, health checks |

## Operations

| File | What it covers |
|------|---------------|
| `operations/ADMIN_QUICK_REFERENCE.md` | Daily admin tasks — payouts, approvals, disputes |
| `operations/PLATFORM_OWNER_GUIDE.md` | Platform management — escalation paths, KPIs |
| `STAFF_MANAGEMENT_SYSTEM.md` | Staff roles, task governance, SLA targets |
| `WEEKLY_RECONCILIATION_TEMPLATE.md` | Weekly financial review agenda |
| `incidents/INCIDENT_TEMPLATE.md` | Post-mortem template for production incidents |

## Financial System

| File | What it covers |
|------|---------------|
| `financial/FINANCIAL_LEDGER_DESIGN.md` | Double-entry ledger architecture, reconciliation |
| `financial/LEDGER_QUICK_REFERENCE.md` | Developer quick reference for ledger operations |
| `financial/MARKETPLACE_PLATFORM_ROADMAP.md` | Business rules — commissions, refunds, payouts |
| `financial/PRODUCTION_GRADE_ARCHITECTURE.md` | Financial safety requirements, payout protection |

## Systems

| File | What it covers |
|------|---------------|
| `systems/COMPLETE_BOOKING_FLOW_SPECIFICATION.md` | Booking flow — voice → DB → confirmation |
| `systems/COMPLIANCE_SYSTEM.md` | Document compliance, instructor verification |
| `systems/PAYMENT_SYSTEM_GUIDE.md` | Stripe, wallet, payout flow |

---

## What is NOT here

- Session summaries and fix reports → deleted (history is in git)
- Audit reports from past issues → deleted
- "Complete" status documents → deleted
- Implementation history → deleted

The code reflects current state. These docs reflect what to follow.
