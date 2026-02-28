# PLATFORM RULES - MANDATORY REQUIREMENTS

**Status:** ENFORCED  
**Authority:** Platform Owner  
**Compliance:** REQUIRED

---

## ⚠️ CRITICAL NOTICE

You are running a financial marketplace with real money, legal obligations, and operational responsibilities. Everything below is **mandatory** for platform stability and compliance.

**Violation of these rules creates legal and financial liability.**

---

## 1️⃣ Money & Escrow Control

### Escrow Requirements

**All client payments MUST go through escrow.**

- Funds are **liabilities**, not revenue
- Instructor payouts are **conditional**, not automatic
- Platform holds funds until release conditions are met

### Escrow Release Conditions

Funds may only be released when **ALL** conditions are met:

✅ Lesson completed  
✅ No disputes filed within review window  
✅ Compliance checks passed  
✅ Instructor documents valid  
✅ No negative balance  

**NEVER allow instructors to withdraw funds before conditions are met.**

### Escrow Account Rules

- Escrow balance should always be ~$0 (all funds allocated)
- CLIENT_WALLET → PLATFORM_ESCROW → [PLATFORM_REVENUE + INSTRUCTOR_PAYABLE]
- Escrow is temporary holding only
- Daily reconciliation required

---

## 2️⃣ Financial Integrity

### Ledger Rules (Immutable)

**Append-Only Entries**
- No updates allowed
- No deletes allowed
- Corrections via reversal entries only

**Idempotent Transactions**
- Every operation has unique idempotency key
- Duplicate requests return existing entry
- No double-processing possible

**Automatic Balance Verification**
- After every transaction
- Mismatch = immediate alert
- Investigation required before proceeding

**Daily Reconciliation vs Stripe**
- Compare platform balances to Stripe
- Investigate any discrepancies
- Document resolution

**Audit Logging**
- Every financial action logged
- User ID recorded
- Timestamp recorded
- Reason required
- Immutable audit trail

### Absolute Prohibitions

❌ Never delete ledger entries  
❌ Never update ledger entries  
❌ Never skip idempotency keys  
❌ Never bypass balance verification  
❌ Never skip audit logging  

---

## 3️⃣ Payout Rules

### Weekly Payout Cycle

**Period:** Monday 00:00 – Sunday 23:59  
**Review Window:** 48 hours (Monday-Tuesday)  
**Execution:** Tuesday evening via Stripe Connect  

### Eligibility Checks (Before Payout)

Every transaction must pass ALL checks:

✅ Booking status = COMPLETED  
✅ Lesson end time <= now() - 48 hours  
✅ No active disputes  
✅ No compliance holds  
✅ Instructor documents valid  
✅ No negative balance  

**Instructors' money is a liability until the platform confirms it is safe to release.**

### Payout Processing Rules

- Admin must select specific transactions (no "pay all" button)
- Each payout creates 2 ledger entries:
  - INSTRUCTOR_PAYABLE → INSTRUCTOR_PAID
  - STRIPE_EXTERNAL → PLATFORM_BANK
- Stripe payout ID must be recorded
- Failed payouts must have retry logic
- Partial batch success is acceptable

### Negative Balance Handling

- Penalties can create negative INSTRUCTOR_PAYABLE balance
- Negative balance carried forward to next payout
- Next payout: Earnings - Carried Penalty
- Cannot pay out if result would be negative

---

## 4️⃣ Cancellation & Refund Enforcement

### Automated Rules (System Must Enforce)

| Scenario | Refund | Notes |
|----------|--------|-------|
| >48h cancellation | 100% client | Instructor not paid |
| 24-48h cancellation | 50% client / 50% instructor | Split automatically |
| <24h cancellation | No client refund | Full instructor payout |
| Instructor no-show | 100% client + penalty | Deduct from instructor balance |
| Student no-show | No refund | Full instructor payout |

### Refund Processing

**Full Refund (3 ledger entries):**
1. INSTRUCTOR_PAYABLE → PLATFORM_ESCROW
2. PLATFORM_REVENUE → PLATFORM_ESCROW
3. PLATFORM_ESCROW → CLIENT_WALLET

**Partial Refund (3 ledger entries):**
1. INSTRUCTOR_PAYABLE → PLATFORM_ESCROW (proportional)
2. PLATFORM_REVENUE → PLATFORM_ESCROW (proportional)
3. PLATFORM_ESCROW → CLIENT_WALLET (total refund amount)

### Override Rules

- Admin overrides MUST be logged
- Admin ID recorded
- Reason required (minimum 10 characters)
- Audit trail created
- No silent changes allowed

---

## 5️⃣ Instructor Permissions & Compliance

### Cancellation Limits

Instructors may cancel only under safe conditions:
- >24 hours before lesson
- Limited monthly quota (e.g., 3 per month)
- Reason required
- Client notified immediately

### High Cancellation Rate Triggers

If cancellation rate > 10%:
- Commission adjustment (increase platform fee)
- Risk review initiated
- Temporary payout hold
- Warning issued

### Absolute Prohibitions

❌ Instructors cannot cancel completed lessons  
❌ Instructors cannot avoid penalties  
❌ Instructors cannot modify financial records  
❌ Instructors cannot bypass compliance checks  

### Document Verification Required

**Required Documents:**
- Driving instructor license
- Insurance certificate
- Background check
- Vehicle registration

**Enforcement:**
- Expired documents block payouts
- Missing documents block new bookings
- Admin approval required for all documents
- Expiry notifications sent 30 days before

---

## 6️⃣ Risk & Dispute Management

### Dispute Window

**48 hours after lesson completion**

- Client can file dispute
- Escrow frozen immediately
- Admin reviews evidence
- Decision logged with ledger entries

### Dispute Types

- Instructor no-show
- Lesson quality issue
- Safety concern
- Billing error
- Other (requires explanation)

### Chargeback Handling

**Automatic Process:**
1. Chargeback received from Stripe
2. Deduct from instructor balance
3. If already paid out → negative balance
4. Negative balance carried forward
5. Repeated violations → account suspension

**Platform has final financial authority.**

### Risk Indicators

Monitor and alert on:
- Chargeback rate > 1%
- Dispute rate > 5%
- Cancellation rate > 10%
- No-show rate > 2%
- Negative balance > 3 consecutive weeks

---

## 7️⃣ State Machine Enforcement

### Booking States (Strict Order)

```
CREATED → CONFIRMED → IN_PROGRESS → COMPLETED
                ↓
            CANCELLED → REFUNDED
                ↓
            DISPUTED → SETTLED
```

### State Transition Rules

**Money movement depends on state, not API calls.**

- CREATED: No money movement
- CONFIRMED: Payment captured, escrow allocated
- IN_PROGRESS: Lesson started (check-in)
- COMPLETED: Lesson ended (check-out)
- CANCELLED: Refund processed based on timing
- REFUNDED: Money returned to client
- DISPUTED: Escrow frozen
- SETTLED: Dispute resolved

### Illegal Transitions (Blocked)

❌ CREATED → COMPLETED (must go through CONFIRMED)  
❌ COMPLETED → CANCELLED (use refund instead)  
❌ REFUNDED → CONFIRMED (cannot undo refund)  
❌ Any state → CREATED (cannot reset)  

**System must validate and block illegal transitions.**

---

## 8️⃣ Operational Discipline

### Before Production Deployment

**Required Tests:**
- [ ] Payout processing (full cycle)
- [ ] Dispute handling (freeze and release)
- [ ] Chargeback processing (negative balance)
- [ ] Refund calculations (all scenarios)
- [ ] Ledger reconciliation (matches Stripe)
- [ ] State machine enforcement (illegal transitions blocked)

**Required Procedures:**
- [ ] Rollback plan documented
- [ ] Emergency payout freeze procedure
- [ ] Admin override process
- [ ] Incident response plan
- [ ] Data backup strategy

**Required Validation:**
- [ ] Dual-write migration complete
- [ ] All operations use ledger
- [ ] Balance verification passing
- [ ] Reconciliation automated
- [ ] Audit logging complete

---

## 9️⃣ Security & Compliance

### Authentication & Authorization

✅ JWT sessions + bcrypt passwords  
✅ Role-based access control (Admin, Instructor, Client)  
✅ Session expiry (24 hours)  
✅ Password requirements (min 8 chars, complexity)  

### API Security

✅ Rate limiting (100 req/min per IP)  
✅ Input validation (Zod schemas)  
✅ HTTPS mandatory in production  
✅ CORS configured properly  

### Data Protection

✅ PII sanitization in logs  
✅ Financial data encrypted at rest  
✅ Audit trail immutable  
✅ GDPR compliance (data export/delete)  

### Financial Security

✅ Append-only ledger  
✅ Idempotency keys enforced  
✅ Balance verification automatic  
✅ State machine enforced  
✅ Admin actions logged  

**Your legal exposure is reduced by strict adherence to these rules.**

---

## 🔟 Platform Owner Doctrine

### Priority Order (Non-Negotiable)

1. **Money safety** > feature speed
2. **Ledger integrity** > UI convenience
3. **Audit trail** > flexibility
4. **Risk control** > instructor satisfaction
5. **Platform survival** > short-term growth

### Decision Framework

When in doubt, ask:
- Does this protect client funds?
- Does this maintain ledger integrity?
- Does this reduce platform risk?
- Does this create audit trail?
- Does this comply with regulations?

If answer is NO to any → DO NOT PROCEED.

---

## ✅ Immediate Owner Actions

### Critical Path (Next 30 Days)

**Week 1:**
- [ ] Complete dual-write ledger migration
- [ ] Implement state machine enforcement
- [ ] Add payout selector UI for admin

**Week 2:**
- [ ] Set up dispute workflow
- [ ] Implement chargeback handling
- [ ] Add negative balance carry-forward

**Week 3:**
- [ ] Test weekly batch payouts in staging
- [ ] Verify reconciliation automation
- [ ] Document emergency procedures

**Week 4:**
- [ ] Monitor risk metrics dashboard
- [ ] Review audit logs
- [ ] Prepare for production deployment

### Risk Metrics to Monitor

**Daily:**
- Escrow balance (should be ~$0)
- Failed transactions
- Balance mismatches

**Weekly:**
- Cancellation rate by instructor
- No-show rate by instructor
- Dispute rate
- Chargeback rate

**Monthly:**
- Platform revenue vs projections
- Instructor retention
- Client satisfaction
- Compliance violations

---

## 🚨 Emergency Procedures

### Payout Freeze

**Trigger:** Suspected fraud, system error, reconciliation failure

**Action:**
1. Disable payout processing immediately
2. Notify all admins
3. Investigate root cause
4. Document findings
5. Fix issue
6. Verify fix in staging
7. Resume payouts with approval

### Ledger Mismatch

**Trigger:** Balance verification fails

**Action:**
1. Freeze all financial operations
2. Export ledger entries
3. Export Stripe transactions
4. Reconcile manually
5. Identify discrepancy
6. Create correcting entries
7. Document resolution
8. Resume operations

### Chargeback Spike

**Trigger:** >5 chargebacks in 24 hours

**Action:**
1. Identify affected instructors
2. Freeze instructor payouts
3. Review booking patterns
4. Contact Stripe support
5. Gather evidence
6. Submit disputes
7. Implement additional fraud checks

---

## 📋 Compliance Checklist

### Daily
- [ ] Review audit logs
- [ ] Check escrow balance
- [ ] Monitor failed transactions
- [ ] Review dispute queue

### Weekly
- [ ] Process payouts (Tuesday)
- [ ] Reconcile with Stripe
- [ ] Review risk metrics
- [ ] Check document expiries

### Monthly
- [ ] Financial report
- [ ] Instructor performance review
- [ ] Compliance audit
- [ ] Security review

---

## 📖 Related Documentation

- **[docs/financial/FINANCIAL_LEDGER_DESIGN.md](docs/financial/FINANCIAL_LEDGER_DESIGN.md)** - Ledger architecture
- **[docs/financial/MARKETPLACE_PLATFORM_ROADMAP.md](docs/financial/MARKETPLACE_PLATFORM_ROADMAP.md)** - Business rules
- **[docs/operations/ADMIN_QUICK_REFERENCE.md](docs/operations/ADMIN_QUICK_REFERENCE.md)** - Daily operations
- **[SYSTEM_STATUS.md](SYSTEM_STATUS.md)** - Current implementation status

---

## ⚖️ Legal Notice

These rules are designed to:
- Protect client funds
- Ensure instructor fair treatment
- Maintain platform integrity
- Comply with financial regulations
- Reduce legal liability

**Deviation from these rules without documented approval is prohibited.**

---

**Last Updated:** February 24, 2026  
**Authority:** Platform Owner  
**Status:** ENFORCED  
**Review Cycle:** Quarterly

**This document supersedes all previous operational guidelines.**
