# START HERE - DriveBook Documentation

**Welcome to DriveBook!**

This is your entry point to understanding the entire system.

---

## 🎯 WHAT IS DRIVEBOOK?

DriveBook is a **controlled booking marketplace with a protected financial ledger** connecting learners and driving instructors.

**Not** a social app. **Not** a messaging platform. **Not** flexible.

It's a **rules-based marketplace** where everything obeys strict principles.

---

## 📚 READ THESE FIRST (In Order)

### 1. CORE_ESSENCE.md (10 minutes)
**What you'll learn**:
- What DriveBook is and is not
- Why it exists
- The 8 core entities
- System boundaries
- The 8 non-negotiables

**Read this**: `00-foundation/CORE_ESSENCE.md`

---

### 2. SYSTEM_PRINCIPLES.md (15 minutes)
**What you'll learn**:
- The 5 non-negotiable principles
- Financial immutability
- Money conservation
- State machine control
- Freeze-after-start rule
- Audit logging requirements

**Read this**: `00-foundation/SYSTEM_PRINCIPLES.md`

---

### 3. FINANCIAL_DOCTRINE.md (20 minutes)
**What you'll learn**:
- How money flows
- Transaction types
- Wallet system
- Commission structure
- Refund policy
- Payout process
- Reconciliation method

**Read this**: `00-foundation/FINANCIAL_DOCTRINE.md`

---

### 4. STATE_MACHINE.md (15 minutes)
**What you'll learn**:
- 7 booking states
- Valid transitions
- Invalid transitions
- Freeze rules
- Auto-transitions
- Consistency checks

**Read this**: `00-foundation/STATE_MACHINE.md`

---

## ⏱️ TOTAL TIME: 60 minutes

After reading these 4 documents, you'll understand:
- What DriveBook is
- How it works
- Why it works this way
- What rules govern it
- How money flows
- How bookings progress

---

## 🎓 LEARNING PATHS

### For Developers
1. Read all 4 foundation docs (60 min)
2. Read `01-architecture/DATABASE_SCHEMA.md`
3. Read `01-architecture/API_STRUCTURE.md`
4. Read `02-finance/LEDGER_RULES.md`
5. Review code with foundation in mind

### For Admins
1. Read `00-foundation/CORE_ESSENCE.md` (10 min)
2. Read `00-foundation/FINANCIAL_DOCTRINE.md` (20 min)
3. Read `03-operations/ADMIN_MANUAL.md`
4. Read `03-operations/DAILY_CHECKLIST.md`
5. Read `04-legal/CANCELLATION_POLICY.md`

### For Product/Business
1. Read `00-foundation/CORE_ESSENCE.md` (10 min)
2. Read `00-foundation/SYSTEM_PRINCIPLES.md` (15 min)
3. Understand the constraints
4. Make decisions within boundaries

---

## 🔴 THE 8 NON-NEGOTIABLES

These rules can NEVER be violated:

1. No transaction is ever updated
2. No booking skips state progression
3. No payout without COMPLETED booking
4. Audit log always written for money movements
5. Only authorized roles can act
6. Wallet balance must reconcile daily
7. Refund after payout blocked (except admin override)
8. Financial operations are atomic

**Memorize these.**

---

## 💡 THE 5 PRINCIPLES

These govern all system behavior:

1. **Financial History Is Immutable**
2. **Money Cannot Be Created or Destroyed**
3. **State Machine Control**
4. **After Start Time = Frozen**
5. **Every Financial Action Must Be Logged**

**Understand these deeply.**

---

## 🗺️ DOCUMENTATION MAP

```
docs/
├── START_HERE.md ← You are here
├── README.md (Full navigation)
├── FOUNDATION_COMPLETE.md (What we built)
│
├── 00-foundation/ ← READ FIRST
│   ├── CORE_ESSENCE.md
│   ├── SYSTEM_PRINCIPLES.md
│   ├── STATE_MACHINE.md
│   └── FINANCIAL_DOCTRINE.md
│
├── 01-architecture/ (System design)
├── 02-finance/ (Financial operations)
├── 03-operations/ (Daily procedures)
├── 04-legal/ (Policies & agreements)
└── archive/ (Old docs)
```

---

## 🚀 QUICK REFERENCE

### When Adding a Feature
1. Does it map to the 8 core entities?
2. Does it violate any of the 8 non-negotiables?
3. Does it follow the 5 principles?
4. Does it respect the state machine?

If any answer is NO → Don't build it.

### When Fixing a Bug
1. Check `03-operations/INCIDENT_RESPONSE.md`
2. Review relevant foundation doc
3. Check audit logs
4. Follow problem-solving method
5. Document the fix

### When Money Doesn't Balance
1. Reconstruct ledger (FINANCIAL_DOCTRINE.md)
2. Check wallet transactions
3. Verify state machine
4. Run reconciliation
5. Alert if discrepancy

---

## 📖 DOCUMENT STANDARDS

Every doc has:
- **Purpose**: What it covers
- **Owner**: Who maintains it
- **Last Updated**: Date
- **Scope**: What's included
- **Non-Negotiable Rules**: Critical rules

---

## 🎯 YOUR GOAL

**Not**: Learn everything immediately

**But**: Understand the foundation

Once you understand:
- System identity
- Core principles
- Money flow
- State machine

You can make **aligned decisions** without asking.

---

## 💬 KEY QUOTES

> "DriveBook is a controlled booking marketplace with a protected financial ledger."

> "Everything must obey the rules engine."

> "Once a transaction is created, it can NEVER be modified."

> "No state skipping. No silent transitions."

> "Every dollar must be traceable."

---

## ✅ CHECKLIST

After reading foundation docs, you should be able to answer:

- [ ] What is DriveBook?
- [ ] What are the 8 core entities?
- [ ] What are the 8 non-negotiables?
- [ ] What are the 5 principles?
- [ ] How does money flow?
- [ ] What are the booking states?
- [ ] When is a booking frozen?
- [ ] How do refunds work?
- [ ] When can instructors be paid?
- [ ] What must be logged?

If you can answer all these → You understand the foundation.

---

## 🆘 NEED HELP?

1. Re-read the relevant foundation doc
2. Check `03-operations/INCIDENT_RESPONSE.md`
3. Review audit logs
4. Ask with context (what you tried, what failed)

---

## 🎓 REMEMBER

**From Builder to System Architect**

You're not just writing code.

You're maintaining a **financial system** that people trust with their money.

Every decision must align with the foundation.

---

**Now go read `00-foundation/CORE_ESSENCE.md` →**

