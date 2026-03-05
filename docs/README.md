# DriveBook Documentation

**Last Updated**: March 4, 2026  
**Status**: Foundation Complete

---

## 📚 DOCUMENTATION STRUCTURE

### 00-foundation/ (START HERE)
Core principles and rules that govern the entire system.

- **CORE_ESSENCE.md** - What DriveBook is and is not
- **SYSTEM_PRINCIPLES.md** - 5 non-negotiable principles
- **STATE_MACHINE.md** - Booking state transitions
- **FINANCIAL_DOCTRINE.md** - Money flow rules

### 01-architecture/
System design and technical structure.

- DATABASE_SCHEMA.md - Data models and relationships
- API_STRUCTURE.md - API routes and endpoints
- WEBHOOK_FLOW.md - Stripe webhook handling
- CRON_JOBS.md - Scheduled tasks

### 02-finance/
Financial operations and reconciliation.

- LEDGER_RULES.md - Transaction immutability
- RECONCILIATION_PROCESS.md - Daily checks
- PAYOUT_PROCESS.md - Instructor payouts

### 03-operations/
Day-to-day operations and procedures.

- ADMIN_MANUAL.md - Admin dashboard guide
- INCIDENT_RESPONSE.md - Problem-solving
- DAILY_CHECKLIST.md - Operational tasks

### 04-legal/
Legal agreements and policies.

- TERMS_STRUCTURE.md - Platform terms
- CANCELLATION_POLICY.md - Refund policy
- WALLET_TERMS.md - Wallet credit terms
- INSTRUCTOR_AGREEMENT.md - Instructor contract

### archive/
Old documentation (reference only).

---

## 🎯 QUICK START

### For New Team Members
1. Read `00-foundation/CORE_ESSENCE.md`
2. Read `00-foundation/SYSTEM_PRINCIPLES.md`
3. Read `00-foundation/FINANCIAL_DOCTRINE.md`
4. Read `01-architecture/API_STRUCTURE.md`

### For Developers
1. Read all of `00-foundation/`
2. Read `01-architecture/DATABASE_SCHEMA.md`
3. Read `02-finance/LEDGER_RULES.md`
4. Review `03-operations/INCIDENT_RESPONSE.md`

### For Admins
1. Read `00-foundation/CORE_ESSENCE.md`
2. Read `03-operations/ADMIN_MANUAL.md`
3. Read `03-operations/DAILY_CHECKLIST.md`
4. Read `04-legal/CANCELLATION_POLICY.md`

---

## 🔴 CRITICAL DOCUMENTS

Must read before making any changes:

1. **SYSTEM_PRINCIPLES.md** - Non-negotiable rules
2. **FINANCIAL_DOCTRINE.md** - Money flow rules
3. **STATE_MACHINE.md** - Booking states
4. **LEDGER_RULES.md** - Transaction immutability

---

## 📖 DOCUMENT STANDARDS

Every document must have:

```markdown
# DOCUMENT TITLE

**Purpose**: What this document covers  
**Owner**: Who maintains it  
**Last Updated**: Date  
**Scope**: What's included  

---

## NON-NEGOTIABLE RULES

1. Rule 1
2. Rule 2
...

---

## RELATED DOCUMENTS

- Link to related docs
```

---

## 🚨 WHEN THINGS BREAK

1. Check `03-operations/INCIDENT_RESPONSE.md`
2. Review relevant foundation document
3. Check audit logs
4. Follow problem-solving method
5. Document the fix

---

## 📝 UPDATING DOCUMENTATION

### When to Update
- Feature added/changed
- Bug fixed
- Process changed
- Policy updated

### How to Update
1. Update the relevant document
2. Update "Last Updated" date
3. Add entry to CHANGELOG (if major)
4. Notify team

### What NOT to Do
- Don't create new docs without structure
- Don't duplicate information
- Don't leave outdated docs
- Don't skip the archive

---

## 🗂️ ARCHIVE POLICY

Old documentation is moved to `archive/` when:
- Superseded by new docs
- Feature removed
- Process changed
- No longer relevant

**Rule**: Never delete docs, always archive.

---

## 📊 DOCUMENTATION HEALTH

| Category | Status | Last Review |
|----------|--------|-------------|
| Foundation | ✅ Complete | 2026-03-04 |
| Architecture | 🟡 In Progress | - |
| Finance | 🟡 In Progress | - |
| Operations | 🟡 In Progress | - |
| Legal | 🟡 In Progress | - |

---

## 🎯 NEXT STEPS

1. Complete `01-architecture/` documents
2. Complete `02-finance/` documents
3. Complete `03-operations/` documents
4. Complete `04-legal/` documents
5. Move all old docs to `archive/`

---

**This documentation is the single source of truth for DriveBook.**

