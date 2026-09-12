# DOCROLEBASE Documentation System

**Purpose:** Single source of truth for DriveBook system design and implementation  
**Philosophy:** Document WHAT IS (current reality), not what WAS (history)  
**Status:** Live tracking system initialized June 13, 2026  

---

## How DOCROLEBASE Works

### Three-Part System

1. **Permanent Documentation** (📘 in `docs/DOCROLEBASE/**/*.md`)
   - Reflects CURRENT code as-is
   - Describes system behavior, APIs, data models, workflows
   - Updated when code changes
   - Never archived or kept as history

2. **TODO Tracking** (📋 in `docs/DOCROLEBASE/TODO.md`)
   - Lists features PLANNED (code complete, docs missing)
   - Lists FIXES NEEDED (code mismatches to fix)
   - Lists REMOVED features (cleaned up, not in code anymore)
   - Single file, living document

3. **Task Documentation** (📄 in root `TASK_*.md` files)
   - Session-specific work (fixes, implementations)
   - Temporary - can be archived after session
   - Not part of permanent DOCROLEBASE

---

## Documentation Principles

### ✅ DO

- Document code AS IT EXISTS NOW
- Mark uncertain features with `🔄 PLANNED:` prefix
- Update docs when code changes
- Link related features (e.g., booking → payment → payout)
- Include code examples and error codes
- Explain WHY a design choice was made

### ❌ DON'T

- Keep historical change logs (that's git history)
- Document features that were removed
- Include "we tried X but it failed" stories
- Mark items "TODO" in permanent docs (use TODO.md instead)
- Create duplicate documentation

---

## File Structure

```
docs/DOCROLEBASE/
├── 00-overview/                    # System overview & guidance
│   ├── README.md                   # Welcome & quick start
│   ├── SYSTEM_OVERVIEW.md          # Architecture diagram
│   ├── DOCROLEBASE_SYSTEM.md       # (THIS FILE) How to use DOCROLEBASE
│   └── CHANGES.md                  # Recent real implementation updates
│
├── 01-public/                      # Public booking site (no auth)
│   ├── BOOKING_FLOW_COMPLETE.md    # User journey
│   ├── SLOT_PERSISTENCE_FIX.md     # Database slot persistence
│   └── RACE_CONDITION_FIX.md       # Atomic transactions
│
├── 02-student/                     # Student/client features
│   ├── DASHBOARD.md                # Dashboard sections & features
│   ├── BOOKINGS.md                 # Viewing, managing bookings
│   ├── AWAITING_PAYMENT.md         # Pending payment workflow
│   ├── WALLET.md                   # Credit balance system
│   └── ...
│
├── 03-instructor/                  # Instructor dashboard & features
│   ├── DASHBOARD.md
│   ├── BOOKINGS.md
│   ├── AVAILABILITY.md
│   ├── BULK_BOOKING.md             # 🔄 PLANNED in TODO.md
│   └── ...
│
├── 04-business/                    # Business/organization features
│   └── ...
│
├── 05-admin/                       # Admin panel & management
│   ├── ADMIN_API.md                # 🔄 PLANNED in TODO.md
│   ├── SUPPORT_WORKFLOW.md         # 🔄 PLANNED in TODO.md
│   ├── STAFF_ROLES.md              # 🔄 PLANNED in TODO.md
│   └── ...
│
├── 06-payments/                    # Payment processing & payouts
│   ├── WALLET.md
│   ├── LEDGER.md                   # 🔄 PLANNED in TODO.md
│   ├── DISPUTES.md                 # 🔄 PLANNED in TODO.md
│   ├── COMMISSIONS.md
│   └── ...
│
├── 07-subscriptions/               # Subscription tiers & billing
│   └── ...
│
├── 08-technical/                   # Developer documentation
│   ├── API_REFERENCE.md
│   ├── CRON_JOBS.md                # 🔄 PLANNED in TODO.md
│   ├── MOBILE_AUTH.md              # 🔄 PLANNED in TODO.md
│   ├── RATE_LIMITING.md            # 🔄 PLANNED in TODO.md
│   └── ...
│
├── INDEX.md                        # Master index & quick links
└── TODO.md                         # 🔄 PLANNED & 🔧 FIXES tracking
```

---

## When to Update DOCROLEBASE

### Code Changes → Update Docs

When you modify code that changes system behavior:

```
CODE CHANGE                           ACTION
─────────────────────────────────────────────────────────────
Add new API endpoint                  → Document in 08-technical/API_REFERENCE.md
Change booking status values          → Update 02-student/BOOKINGS.md
Modify refund policy                  → Update 06-payments/REFUNDS.md
Fix race condition                    → Document in appropriate section
Add new role/permission               → Update 05-admin/STAFF_ROLES.md
```

### New Feature → Add to TODO First, Then Docs

```
WORKFLOW:
1. Code complete
2. Add entry to TODO.md under "🔄 PLANNED"
3. Write permanent `.md` file(s)
4. Remove from TODO.md
5. (Doc now lives in permanent location)
```

### Feature Removal → Remove, Don't Archive

```
FEATURE REMOVED                       ACTION
─────────────────────────────────────────────────────────────
Delete booking status value           → Remove from docs, DON'T mark as removed
Deprecate API endpoint                → Update docs, show "use X instead"
Remove permission flag                → Delete from docs, DON'T keep as archive
```

---

## TODO.md — Living Tracking File

### Sections

#### 🔄 PLANNED (Code exists → needs docs)
- Feature is fully implemented
- API routes exist, service layer complete
- Documented in code but not in DOCROLEBASE
- Action: Write `.md` file, remove from TODO

#### 🚫 REMOVED (Outdated features)
- Feature deleted from codebase
- No longer relevant to documentation
- Listed for reference only (prevents re-documenting)
- Action: None (ignore)

#### ✅ VERIFIED AS CURRENT (Accurate docs)
- Documentation matches code exactly
- No changes needed
- Listed as confirmation (peace of mind)
- Action: None (monitor for changes)

#### 🔧 FIXES NEEDED (Code mismatches)
- Code exists but is incorrect/incomplete
- Docs either don't exist or contradict code
- Requires developer action (fix code, not docs)
- Action: Fix code first, then update docs

---

## Example: Moving a Feature from TODO to Docs

### Step 1: Feature Complete (Code + TODO)
```
TODO.md:
- Mobile Authentication (JWT)
  Code: ✅ /api/auth/mobile-login
  Docs: ❌ Missing
  Where to add: 08-technical/MOBILE_AUTH.md
```

### Step 2: Write Documentation
```
Create: docs/DOCROLEBASE/08-technical/MOBILE_AUTH.md
Sections:
  - Overview
  - JWT token generation
  - Bearer token usage
  - Session vs JWT differences
  - Token refresh flow
  - Code examples
```

### Step 3: Commit & Remove from TODO
```
BEFORE:
[In TODO.md - Mobile Authentication section]

AFTER:
[Item removed from TODO.md entirely]
[Docs live at: 08-technical/MOBILE_AUTH.md]
```

---

## Index & Cross-References

### Main Index
- **File:** `docs/DOCROLEBASE/INDEX.md`
- **Purpose:** Quick links to everything
- **Usage:** Start here if unsure where to look

### Getting Started
- **Read first:** `00-overview/SYSTEM_OVERVIEW.md`
- **Then check:** `00-overview/README.md`
- **Search:** Use INDEX.md or grep

### Related Documentation
- Links between files use relative paths: `[Link Text](./RELATED.md)`
- Cross-reference sections: `See also: docs/02-student/WALLET.md`

---

## Quality Checklist

Before committing documentation:

- [ ] Code behavior accurately described
- [ ] All API endpoints listed (GET/POST/PUT/DELETE)
- [ ] Request/response formats shown
- [ ] Error codes documented
- [ ] Permission requirements clear
- [ ] Related features cross-referenced
- [ ] No "TODO" or placeholder text
- [ ] No historical narrative (no "we changed X to Y")
- [ ] No duplicated content (exists elsewhere in DOCROLEBASE)
- [ ] Markdown formatting clean
- [ ] Links are relative paths and working

---

## Common Mistakes (Avoid!)

### ❌ Keeping Archives
```
WRONG:
### Previously (Before May 2026)
The system used to calculate bonuses as 8% per tier...

CORRECT:
Remove section entirely. Current docs show what IS.
```

### ❌ Documenting In Code Comments
```
WRONG:
// TODO: We might add this feature next month
// This was changed in April because of X

CORRECT:
Move to TODO.md. Code should be clean, no future plans.
```

### ❌ Using "TODO" in Permanent Docs
```
WRONG:
### Planned Features
- [ ] Rate limiting (coming soon)
- [ ] Email verification (needs design)

CORRECT:
Put in TODO.md under "🔄 PLANNED". Permanent docs describe current state only.
```

### ❌ Outdated Feature Descriptions
```
WRONG:
New students get 8-12% bonus on first booking (Feature removed May 2026).

CORRECT:
Feature removed. Delete entire section. Don't keep as historical note.
```

### ❌ Over-Linking
```
WRONG:
"See section 1.2.3 of BOOKING_FLOW_COMPLETE.md for details about X."

CORRECT:
"See [Booking Flow](./BOOKING_FLOW_COMPLETE.md) for details."
Link to file, not section numbers (sections change).
```

---

## Role Responsibilities

### Developers
- **Update docs when:** Implementing features, fixing bugs, changing APIs
- **Use docs to:** Understand system design before starting work
- **Check TODO.md:** Before documenting new features (avoid duplication)

### Product Managers
- **Check TODO.md:** To see planned features requiring documentation
- **Prioritize:** Which features need docs first
- **Verify:** That feature descriptions match intended design

### Support/Operations
- **Read docs in:** 02-student/, 03-instructor/, 05-admin/ sections
- **Report gaps:** To developers via TODO.md
- **Use INDEX.md:** To find answers to common questions

### Technical Writers
- **Follow:** This system (DOCROLEBASE_SYSTEM.md)
- **Maintain:** Index and cross-references
- **Enforce:** Quality checklist before commits

---

## Questions?

- **"Where should I document X?"** → Check INDEX.md or folder structure
- **"Should I add a TODO?"** → Yes, if code exists but docs missing
- **"Should I keep this outdated section?"** → No, delete it
- **"Can I add a 'planned for next sprint' note?"** → Put in TODO.md, not permanent docs
- **"How do I archive old documentation?"** → Don't. Git has the history.

---

**Last Updated:** June 13, 2026  
**Version:** 1.0 (Established system)  
**Status:** Living document — update as practices evolve
