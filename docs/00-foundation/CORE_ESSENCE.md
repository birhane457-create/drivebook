# DRIVEBOOK CORE ESSENCE

**Purpose**: Define what DriveBook fundamentally is  
**Owner**: Founder  
**Last Updated**: March 4, 2026  
**Scope**: System identity and boundaries  

---

## WHAT DRIVEBOOK IS

DriveBook is a **controlled booking marketplace with a protected financial ledger** connecting learners and driving instructors.

---

## WHY IT EXISTS

**Mission**: Enable learners to book driving lessons efficiently while ensuring instructors are paid fairly and the platform operates transparently.

**Problem Solved**: 
- Learners struggle to find and book reliable instructors
- Instructors lose time on manual scheduling and payment collection
- Both parties lack trust in payment handling

**Solution**: 
- Automated booking with instant confirmation
- Protected wallet system with clear refund policies
- Transparent financial ledger with audit trail

---

## KEY SUCCESS METRICS

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Booking Completion Rate | >95% | Measures reliability |
| Wallet Reconciliation Accuracy | 100% | Financial integrity |
| Payout Timeliness | <48h after completion | Instructor trust |
| Booking State Consistency | 100% | System predictability |
| Refund Processing Time | <5 minutes | Client satisfaction |

---

## WHAT DRIVEBOOK IS NOT

- ❌ A social app  
- ❌ A messaging app  
- ❌ A flexible platform  
- ❌ A general-purpose booking system  

It is a **rules-based marketplace**. Everything must obey the rules engine.

---

## CORE ENTITIES

| Entity | Owner/Responsible | Purpose |
|--------|------------------|---------|
| **User** | Admin (create), Client/Instructor (manage own) | Identity and authentication |
| **Booking** | Client (request), Instructor (confirm), Admin (override) | Time slot reservation |
| **Transaction** | System (immutable), Admin (audit) | Financial ledger record |
| **Wallet** | Client (fund), System (credit/debit) | Credit balance management |
| **Payout** | Admin (approve), System (execute) | Instructor earnings distribution |
| **Package** | System/Admin (create/manage) | Multi-lesson bundles |
| **WebhookEvent** | System (log), Admin (monitor) | Payment confirmation tracking |
| **AuditLog** | System (write), Admin (view) | Immutable action history |

### 1. User
- CLIENT (learner)  
- INSTRUCTOR (teacher)  
- ADMIN (platform operator)

### 2. Booking
- Time slot reservation  
- Links client to instructor  
- Has price and duration  
- Follows state machine

### 3. Transaction (Immutable Ledger)
- Records all money movement  
- NEVER modified after creation  
- Linked via `parentTransactionId`  
- Grouped via `ledgerGroupId`

### 4. Wallet
- Client's credit balance  
- All changes create transactions  
- Must reconcile daily

### 5. Payout
- Instructor earnings distribution  
- Only from COMPLETED bookings  
- 24-hour buffer required  
- Admin approval required

### 6. Package
- Multi-lesson bundles  
- Pre-paid hours  
- Expiry tracking

### 7. WebhookEvent
- Stripe payment confirmations  
- Logged for debugging  
- Idempotent processing

### 8. AuditLog
- All financial actions  
- Who, what, when, why  
- Immutable record

---

## HIGH-LEVEL FLOW

### Booking Flow

Client books lesson
→ Booking created (PENDING/CONFIRMED)
→ Transaction created
→ Wallet updated (if wallet payment)
→ Confirmation sent

Lesson completed
→ Booking marked COMPLETED
→ Transaction status updated
→ Instructor payout queued

Cancellation
→ Refund calculated (policy-based)
→ Transaction REFUND created
→ Wallet updated
→ Audit logged


### Money Flow

Client → Wallet (CREDIT transaction)
Wallet → Booking (DEBIT transaction)
Booking → Platform Fee (15%)
Booking → Instructor Payout (85%)
Cancellation → Wallet Refund (policy-based)


---

## SYSTEM BOUNDARIES

### Belongs in DriveBook
- Booking management  
- Payment processing  
- Wallet operations  
- Instructor payouts  
- Client reviews  
- Schedule management  
- Document verification  

### Does NOT Belong
- Social features (likes, follows)  
- Chat/messaging (use SMS/email)  
- Content management  
- Marketing automation  
- CRM features  

**Rule**: If a feature doesn't map to the 8 core entities, it doesn't belong.

---

## NON-NEGOTIABLES

1. **No transaction is ever updated** – Only adjustment transactions created  
2. **No booking skips state progression** – Must follow state machine  
3. **No payout without COMPLETED booking** – Admin approval required  
4. **Audit log always written** – For every money movement  
5. **Only authorized roles can act** – On bookings or transactions  
6. **Wallet balance must reconcile** – Daily verification required  
7. **Refund after payout blocked** – Except admin override with reason  
8. **Financial operations are atomic** – All-or-nothing updates  

---

## FUNDAMENTAL CONSTRAINTS

1. **Financial Integrity** – Money flow must be traceable from client → platform → instructor  
2. **State Machine Control** – Every booking follows a strict state progression  
3. **Immutable History** – Financial records can never be modified, only adjusted with new records  
4. **Role-Based Access** – Users can only access data appropriate to their role  
5. **Audit Trail** – Every financial action must be logged with actor, timestamp, and reason  

---

## SYSTEM IDENTITY

**DriveBook is**:
- A marketplace (connects two parties)  
- A ledger (tracks money accurately)  
- A rules engine (enforces policies)  
- A booking system (manages time slots)  

**DriveBook operates on**:
- Predictability (no surprises)  
- Transparency (clear audit trail)  
- Control (strict validation)  
- Safety (financial protection)  

---

## RELATED POLICY DOCUMENTS

- `SYSTEM_PRINCIPLES.md` – Non-negotiable platform principles  
- `STATE_MACHINE.md` – Booking state transitions  
- `FINANCIAL_DOCTRINE.md` – Money flow rules  
- `LEDGER_RULES.md` – Transaction immutability  
- `CANCELLATION_POLICY.md` – Refund policy  
- `INSTRUCTOR_AGREEMENT.md` – Instructor terms  

---

**This document defines the immutable identity of DriveBook. All features must align with this essence.**