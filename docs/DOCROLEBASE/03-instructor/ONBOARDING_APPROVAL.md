# Instructor Onboarding & Approval Process

**Status:** Documents approval workflow to prevent unvetted instructors from appearing in search or receiving bookings

---

## Registration → Approval Pipeline

### Step 1: Instructor Registration (`/register`)

**What happens:**
1. Instructor fills registration form with:
   - Name, email, password, phone
   - Base address (location for service area)
   - Hourly rate
   - Vehicle type
   - Service radius

2. System creates:
   - `User` (role: `INSTRUCTOR`)
   - `Instructor` record with `approvalStatus: PENDING` and `isActive: false`

3. Emails sent:
   - ✅ Instructor welcome email: "Your account is under review (24-48 hours)"
   - ✅ Admin notification: "New instructor registration pending approval"

**Code gate:** `approvalStatus: PENDING` / `isActive: false`

---

### Step 2: Complete Profile (`/setup/complete-profile`)

After registration, instructor redirected to profile completion form to upload documents:
- Driver's license
- Insurance certificate
- Certifications (optional)
- Working hours
- Service areas
- Car details
- Languages

**No gate** at this step — instructor can add documents while `PENDING`

---

### Step 3: Admin Review (`/admin/instructors`)

Admin dashboard shows pending instructors with document review interface.

Admin can:
- ✅ View all documents
- ✅ Verify document authenticity
- ✅ Check expiry dates (license, insurance, WWC check, etc.)
- ✅ Approve instructor
- ❌ Reject instructor (with reason)

---

### Step 4: Admin Approves Instructor

**Endpoint:** `PATCH /api/admin/instructors/[id]/approve`

**What happens:**
```
approvalStatus: PENDING  →  approvalStatus: APPROVED
isActive: false          →  isActive: true
documentsVerified: true
```

**After approval:**
1. Instructor appears in public search
2. Instructor can accept public bookings
3. Instructor can accept bookings from dashboard
4. Student can book from instructor profile

---

## Access Gates (Before Approval)

### ❌ Instructor CANNOT do (while `PENDING`)

| Action | Gate | Error |
|--------|------|-------|
| Appear in `/book` search | `approvalStatus: APPROVED` | Not listed |
| Receive public bookings | `approvalStatus: APPROVED` | Error 403: "Instructor not available" |
| Create bookings (dashboard) | `approvalStatus: APPROVED` | Error 403: "Account pending approval" |
| Create offline bookings | `approvalStatus: APPROVED` | Error 403: "Account pending approval" |
| Schedule PDA tests | `approvalStatus: APPROVED` | Error 403: "Pending approval" |

### ✅ Instructor CAN do (while `PENDING`)

| Action | Status |
|--------|--------|
| Login to dashboard | ✅ Can access |
| Complete profile | ✅ Can upload documents |
| Edit personal info | ✅ Can update |
| Set availability | ✅ Can configure |
| View dashboard (empty) | ✅ Can see "pending approval" state |

---

## Public Search & Booking Prevention

### Public Search API: `GET /api/instructors/search`

**Filter applied:**
```typescript
where: {
  approvalStatus: 'APPROVED',  // ← Only approved instructors
  isActive: true,
}
```

**Result:** Pending instructors never appear in student search

### Public Booking API: `POST /api/public/bookings/bulk`

**Filter applied:**
```typescript
if ((instructor as any).approvalStatus !== 'APPROVED') {
  return { error: 'Instructor is not available for bookings' }
}
```

**Result:** Even if student has direct link, cannot book from pending instructor

### Instructor Create Booking: `POST /api/bookings`

**Filter applied:**
```typescript
if (approvalStatus !== 'APPROVED') {
  return { 
    error: 'Your account is pending approval. You can create bookings once an admin approves your application.',
    requiresApproval: true
  }
}
```

**Result:** Instructor cannot create bookings for their own students

---

## Document Verification Checklist

Admin verifies:

1. **Driver's License**
   - [ ] Valid format
   - [ ] Not expired
   - [ ] Clear copy
   - [ ] Name matches registration

2. **Insurance Certificate**
   - [ ] Valid date range
   - [ ] Covers driving instruction
   - [ ] Not expired
   - [ ] Proper coverage amount

3. **Working With Children (WWC) Check** (if applicable)
   - [ ] Valid (not expired)
   - [ ] Approved status
   - [ ] Name matches

4. **Vehicle Registration**
   - [ ] Valid
   - [ ] Matches service area
   - [ ] Insurance verification

5. **Personal Details**
   - [ ] Accurate location info
   - [ ] Service radius reasonable
   - [ ] Hourly rate set
   - [ ] Vehicle types listed

---

## Timeline

```
Day 0: Instructor registers
       → Sent welcome email
       → Admin notified

Day 1: Instructor completes profile
       → Admin reviews documents
       → Admin approves/rejects

Day 1 (approved): Instructor appears in search
                  → Can accept bookings
                  → Can create dashboard bookings

Day 1 (rejected): Instructor notified of rejection
                  → Can re-apply or contact support
```

---

## States & Transitions

### Instructor Status States

```
┌─────────────────────────────────────────────┐
│                                             │
│  PENDING (awaiting admin review)            │
│  - isActive: false                          │
│  - Cannot receive bookings                  │
│  - Cannot appear in search                  │
│  - CAN: login, upload docs                  │
│         ↓                                   │
│     APPROVED (admin approved)               │
│     - isActive: true                        │
│     - Can receive bookings                  │
│     - Appears in search                     │
│         ↓                                   │
│  ┌─────────────────────────────────┐        │
│  │ ACTIVE/TRIAL (subscription)     │        │
│  │ - isActive: true                │        │
│  │ - Can accept new bookings       │        │
│  │ - Can book (dashboard)          │        │
│  │     ↓                           │        │
│  │ INACTIVE (subscription expired) │        │
│  │ - isActive: false               │        │
│  │ - Cannot accept new bookings    │        │
│  └─────────────────────────────────┘        │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Related

- `ADMIN_DASHBOARD.md` — Admin approval interface
- `PROFILE.md` — Instructor profile completion
- `SETTINGS.md` — Document upload & verification
- `BOOKINGS.md` — Booking acceptance (requires approval)

---

**Last Updated:** June 11, 2026  
**Status:** Documents current approval gates  
**Objective:** Ensure unvetted instructors cannot appear in search or receive bookings
