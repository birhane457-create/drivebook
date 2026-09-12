# 10 — Audit, Compliance & KPIs

---

## Audit Requirements

Every action touching money, status, or access is logged to `AuditLog`. Retention: **7 years**.

### Automatically logged:
- Booking payment confirmed / failed
- Booking cancelled / rescheduled
- Payout processed / failed
- Instructor approved / suspended
- Wallet credited / debited
- Refund issued
- Admin AI query (`ADMIN_AI_QUERY`)
- All cron system actions (`actorId: 'SYSTEM_CRON'`)
- Booking auto-expired / auto-no-show / auto-reconciled

### For manual overrides, additionally required:
- Override reason ≥ 20 characters
- SUPER_ADMIN approval reference if amount > $500
- Dual-control confirmation for amounts > $500 (`DUAL_CONTROL_THRESHOLD`)

### Querying the audit log:
- Admin page: `/admin/audit-log`
- Filter by `actorId`, `targetId`, `action`, `targetType`, date range
- Export for evidence when responding to complaints or audits
- **Do not delete or modify** audit records — immutable by policy

---

## Compliance Checklist

### Monthly:
- [ ] Refund rate vs revenue — flag if > 10%
- [ ] Failed payout count and reasons reviewed
- [ ] Open disputes count — all should have response filed with Stripe
- [ ] Instructors with expired documents — follow up on renewals
- [ ] ABN status check for instructors with pending ABN

### Quarterly:
- [ ] Full reconciliation: Stripe balance vs platform ledger
- [ ] Wallet balance audit: sum of all `ClientWallet.balance` vs `WalletTransaction` totals
- [ ] GST calculation review (if gstEnabled = true)
- [ ] Withholding tax summary for non-ABN instructors
- [ ] Review and update `ADMIN_BUSINESS_RULES.md` if policies changed

### Annual:
- [ ] ATO withholding tax reporting (47% on instructors without verified ABN)
- [ ] GST BAS lodgement
- [ ] Privacy Act compliance review
- [ ] Audit log archival verification (7-year retention)
- [ ] Review all `SUPER_ADMIN` accounts — remove any that are no longer active
- [ ] Rotate `NEXTAUTH_SECRET` and `CRON_SECRET` if not rotated in 12 months

---

## KPI Dashboard

### Platform KPIs (check weekly in Copilot or `/admin/revenue`):

| Metric | Target | Alert threshold |
|---|---|---|
| New students (weekly) | Growing | Decline > 20% WoW |
| Active instructors | Growing | < 80% active of approved |
| Revenue (weekly) | Growing | Decline > 20% WoW |
| Lessons completed (weekly) | Growing | — |
| Completion rate | > 90% | < 80% |
| Cancellation rate | < 15% | > 20% |
| Refund rate | < 5% of revenue | > 10% |
| AI bookings (% of total) | Growing | — |
| Conversion rate (visitor → booking) | > 5% | < 3% |

### Business / Instructor KPIs:

| Metric | Where to check |
|---|---|
| New BUSINESS subscribers | `/admin/instructors` filter by tier |
| Churn (cancelled subscriptions) | Stripe dashboard + `/admin/revenue` |
| Voice lines assigned (PRO+) | `/admin/voice-lines` |
| Instructors with expiring documents | `/admin/documents` |
| Instructors with incomplete Stripe onboarding | Copilot: "Who has incomplete Stripe onboarding?" |
| Instructor risk score | Copilot: "Which instructors are highest risk?" |

### Operational KPIs:

| Metric | Where | Alert |
|---|---|---|
| Platform health score | Copilot: `getHealthScore` | < 70 = WATCH, < 50 = CRITICAL |
| Open disputes | `/admin/disputes` | > 3 open at once |
| Stuck payouts | Reconciliation report | Any |
| SLA breaches | `/admin/staff-governance` | Any |
| Failed cron jobs | `/admin/cron-jobs` | Any |

---

## Feature Flags

Unfinished features are controlled via code flags. Do not implement or enable these without full development and testing.

| Feature | Flag / Location | Current State | Notes |
|---|---|---|---|
| BUSINESS tier | `comingSoon: true` in `SubscriptionPlans.tsx` | Disabled | Enable when Stripe products created |
| Multi-instructor management | No code — Phase 2 | Not built | Schema foundation needed first |
| Direct payments (school → own Stripe) | `paymentMode = DIRECT` throws NotImplemented | Blocked | Phase 2 |
| White-label (full DriveBook branding removal) | `whiteLabel` in `getAccountFeatures()` = isBusiness | Defined, not active | Phase 2 |
| AI instructor assistant | Not built | Not started | Future roadmap |
| Referral system | `newStudentBonus` removed May 2026 | Not built | Replaces deprecated bonus |
| Waiting list automation | Data store only — no trigger | Partial | Wire slot-open trigger |
| Affiliate/marketplace | Not built | Not started | Future roadmap |

### Adding a new feature flag:
1. Add `comingSoon: true` or equivalent in the relevant UI component
2. Document here with current state and notes
3. When ready to enable: remove the flag, update this table, add to release checklist

### Enabling a Coming Soon feature:
1. Confirm backend is fully implemented and tested
2. Confirm migration applied to production DB
3. Remove `comingSoon` flag in UI
4. Update this document
5. Follow release procedure in `11-release-management.md`
