# DriveBook — Documentation Entry Point

> **Start here every session.** This file tells you what exists, where it lives, and what to open depending on what you need to do.

---

## "What should I work on next?"

Open this file:

```
docs/audit/AUDIT-MASTER-TRACKER.md
```

It contains the complete priority queue (P0 → P1 → P2), the status of every finding, and a quick-reference summary at the bottom showing exactly what is done and what is next.

---

## "I want to understand the current state of a specific finding"

| You want to know about… | Open this file |
|---|---|
| Overall audit status, all findings, priority queue | `audit/AUDIT-MASTER-TRACKER.md` |
| Phase 1 original 56-finding register (frozen baseline) | `audit/PHASE1_REMEDIATION_REGISTER.md` |
| Phase 1 verification outcomes per finding | `audit/VERIFICATION_OUTCOMES.md` |
| PAY-01 payout destination ownership (CLOSED) | `audit/phase2/PAY-01-INVESTIGATION-STATUS.md` |
| PAY-01-C reproduction test (CLOSED) | `audit/phase2/PAY-01-C-REPRODUCTION-TEST.md` |
| PAY-01 Stripe metadata binding audit | `audit/phase2/PAY-01-STRIPE-RELATIONSHIP-AUDIT.md` |
| MM-10 SaaS payment + MM-05 refund idempotency deep investigation | `audit/phase2/MM10-MM05-INVESTIGATION.md` |
| Full money-movement inventory (17 paths) | `audit/MONEY-MOVEMENT-INVENTORY.md` |
| Phase 1 area-by-area audit detail (AREA4/5/6, F-series, SUB, P0) | `audit/phase1/` — pick by finding ID prefix |

---

## "I want to read the detailed evidence for a closed finding"

```
audit/phase1/    ← P0-01, SUB-*, C-1, F-*, AREA* findings
audit/phase2/    ← PAY-01, MM-10, MM-05 findings
audit/archive/   ← old session logs, superseded reports (read-only history)
```

---

## "I'm setting up the project / onboarding"

| Task | File |
|---|---|
| Project setup and dev environment | `README.md` |
| Stripe account setup | `STRIPE_SETUP_GUIDE.md` |
| Twilio SMS setup | `TWILIO_SETUP_GUIDE.md` |
| Test user credentials | `TEST_USERS.md` |
| Subdomain and custom domain system | `SUBDOMAIN_SYSTEM.md` |
| Subscription system overview | `SUBSCRIPTION_SYSTEM.md` |
| Design system / component guide | `DESIGN_SYSTEM.md` |

---

## "I want to understand the product / business domain"

```
DOCROLEBASE/     ← role-based feature documentation (payments, bookings, etc.)
00-foundation/   ← platform vision and core concepts
01-architecture/ ← system architecture
02-finance/      ← financial model
03-operations/   ← operational runbooks
04-legal/        ← compliance and legal
05-integrations/ ← third-party integration guides
newplan/         ← future product direction
```

---

## Audit Structure at a Glance

```
docs/
├── START_HERE.md                        ← you are here
│
├── audit/
│   ├── AUDIT-MASTER-TRACKER.md          ← ★ SINGLE SOURCE OF TRUTH for all findings
│   ├── MONEY-MOVEMENT-INVENTORY.md      ← all 17 money-movement paths
│   ├── PHASE1_REMEDIATION_REGISTER.md   ← frozen 56-finding Phase 1 baseline
│   ├── PHASE1_COVERAGE_MAP.md           ← 20-area coverage reconciliation
│   ├── PHASE2_SECURITY_AUDIT.md         ← Phase 2 scope definition
│   ├── COMPLETE_AUDIT_VERIFICATION.md   ← source-level verification for all findings
│   ├── SECURITY_FINDINGS_TRACKER.md     ← per-finding verification status
│   ├── VERIFICATION_FRAMEWORK.md        ← verification methodology
│   ├── VERIFICATION_OUTCOMES.md         ← outcomes per finding
│   ├── EXECUTIVE_SUMMARY.md             ← high-level summary for stakeholders
│   │
│   ├── phase1/                          ← evidence for Phase 1 closed findings
│   │   ├── P0-01_VERIFICATION.md
│   │   ├── P0-01B_FIX_IMPLEMENTATION.md
│   │   ├── SUB-22_VERIFICATION.md       (and all other SUB-* files)
│   │   ├── C-1_VERIFICATION.md
│   │   ├── F-08_VERIFICATION.md         (and other F-series)
│   │   └── AREA4/5/6 findings and attack surfaces
│   │
│   ├── phase2/                          ← evidence for Phase 2 / PAY-01 / MM work
│   │   ├── PAY-01-INVESTIGATION-STATUS.md
│   │   ├── PAY-01-C-REPRODUCTION-TEST.md
│   │   ├── PAY-01-STRIPE-RELATIONSHIP-AUDIT.md
│   │   ├── MM10-MM05-INVESTIGATION.md   ← ★ deep investigation report
│   │   └── PAYMENT_* and PHASE_2_* files
│   │
│   └── archive/                         ← old session logs, superseded reports
│       └── (read-only — do not edit)
│
├── DOCROLEBASE/                         ← role-based feature docs
├── 00-foundation/ … 05-integrations/    ← product/domain docs
└── [setup guides, system docs]
```

---

## Current Work Status (as of 2026-09-16)

| Phase | Status |
|---|---|
| Phase 1 — 56 findings | ~12 closed, remainder open (see tracker) |
| PAY-01 — Payout destination ownership | ✅ **CLOSED** — 28/28 tests, exit 0 |
| Money-movement inventory | ✅ **COMPLETE** — 17 paths catalogued |
| MM-10 investigation | ✅ **COMPLETE** — split into MM-10-A (routing absent), MM-10-B (session race), MM-10-C (fee bug); PAY-01 parallel classification rejected |
| MM-05 investigation | ✅ **COMPLETE** — split into MM-05-A/B/C (confirmed) + MM-05-D/E (lower risk) |
| MM-07 investigation | ✅ **COMPLETE** — confirmed ledger reconciliation defect |
| MM-07 + MM-05-A/B/C fix | ⚠️ **NEXT** — P0 priority |

**Next action:** Open `audit/AUDIT-MASTER-TRACKER.md` → "Current Priority Queue" → start with MM-07 + MM-05-A.
