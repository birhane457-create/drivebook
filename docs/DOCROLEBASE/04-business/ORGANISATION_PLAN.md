# Organisation / School Mode  Architecture Plan

**Status:** PLAN ONLY  not implemented  
**Do not implement until explicitly instructed.**  
**Last Updated:** July 12, 2026  
**Informed by:** Full codebase inspection (July 2026), GPT architecture review, product owner clarification

---

## Product Evolution Stages

### Stage 1 — Marketplace (CURRENT ✅)
DriveBook is the platform. Students find instructors, book, pay, and manage lessons.
The AI receptionist answers calls on the shared DriveBook number.

```
Student  DriveBook website / AI phone
          Instructor
          Booking
```

Database: `Booking  Instructor`. No school concept needed.

---

### Stage 2  Instructor Business Pages (CURRENT )
Each instructor operates as their own branded micro-business within DriveBook.

```
debesay.drivebook.com.au         (customSlug)
book.debesaydriving.com.au       (customDomain  STUDIO+)
```

Each instructor gets:
- Personal landing page with bio, FAQ, reviews, contact
- Branded colours and logo (PRO+)
- Booking form with their availability and packages
- Dedicated AI phone number (PRO+  voice line pool)

Database: All branding lives on `Instructor` model. No org needed.

---

### Stage 3  School Mode (FUTURE  plan only)
A driving school joins DriveBook. They manage multiple instructors under one account.

```
ABC Driving School
   John (instructor)
   Sarah (instructor)
   Mike (instructor)
```

The school gets:
- One login to view all instructor dashboards
- School-level branding applied to all instructor pages
- Dedicated AI phone number that says "Thanks for calling ABC Driving School"
- School-level custom domain (`abcdriving.com.au`)
- Consolidated reporting across all instructors

---

## What Is NOT Changing Today

The following are deferred until Stage 3 is actively built:

-  Multi-instructor management dashboard
-  School-level payments or payouts
-  School subscription billing
-  Complex permission roles for school staff
-  Multiple VAPI assistants
-  Organisation table in the database

The current instructor model is **not being restructured**. Everything works as today.

---

## Future Database Changes (reference only  do not implement yet)

### New model: `Organisation`

```prisma
model Organisation {
  id                  String    @id @default(cuid())
  name                String                          // "ABC Driving School"
  slug                String    @unique               // "abcdriving"  abcdriving.drivebook.com.au
  customDomain        String?                         // "book.abcdriving.com.au"
  domainVerified      Boolean   @default(false)
  ownerUserId         String                          // User who manages the school account
  brandLogo           String?                         // Cloudinary URL
  brandColorPrimary   String?                         // Hex  applied to all instructor pages in org
  brandColorSecondary String?                         // Hex
  vapiAssistantId     String?                         // Org-level VAPI assistant ID (optional  can share global)
  welcomeMessage      String?                         // "Thanks for calling ABC Driving School"
  supportPhone        String?                         // Shown in AI fallback script
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  instructors         Instructor[]
  twilioNumbers       TwilioPhoneNumber[]
}
```

### Change: `Instructor`  add optional org link

```prisma
// Add one nullable field  all existing rows remain null. Nothing breaks.
model Instructor {
  // ... all existing fields unchanged ...
  organisationId      String?                         // null = solo instructor (default)
  organisation        Organisation? @relation(fields: [organisationId], references: [id])
}
```

### Change: `TwilioPhoneNumber`  add optional org ownership

```prisma
// Existing field stays: assignedTo (instructorId)
// New field: organisationId (nullable)
// Incoming call routing: check organisationId first, then assignedTo
model TwilioPhoneNumber {
  // ... all existing fields unchanged ...
  organisationId      String?
  organisation        Organisation? @relation(fields: [organisationId], references: [id])
}
```

### Change: `Subscription`  add optional org-level billing (separate from instructor billing)

```prisma
// Instructor subscriptions stay exactly as-is
// New: org-level subscription row for school plan billing
model Subscription {
  // ... all existing fields unchanged ...
  organisationId      String?                         // null = instructor subscription (existing)
}
```

No changes to `Booking`, `Transaction`, `Payout`, `ClientWallet`, or any financial model.
Instructor-level financial flow is unchanged in school mode.

---

## Branding Inheritance Model (when Organisation is added)

All branding currently lives on `Instructor`. This is correct for solo instructors.

When Organisation is introduced, the subdomain booking page will resolve branding using a
fallback chain  instructor overrides org, org overrides DriveBook defaults:

```typescript
// app/subdomain/[slug]/page.tsx  future pattern (2 lines per colour field)
const primary = instructor.brandColorPrimary
  ?? instructor.organisation?.brandColorPrimary
  ?? '#2563eb'                                   // DriveBook blue default

const logo = instructor.brandLogo
  ?? instructor.organisation?.brandLogo
  ?? null                                        // no logo = DriveBook logo shown
```

Solo instructors: `organisation` is null  their own branding applies exactly as today.
School instructors: if they haven't set their own colours, the school colours apply.

**Key rule: instructor branding fields are NOT migrated to Organisation.**  
Organisation gets its own separate fields. This avoids any data migration.

---

## AI Phone Architecture (when Organisation is added)

### Current (Stage 1/2)
All Twilio numbers share one webhook URL. The routing code does not exist yet.
One VAPI assistant handles all calls with hardcoded DriveBook identity.

```
Incoming call (any number)
   Twilio webhook: https://voice.drivebook.com.au/api/voice/incoming   DOES NOT EXIST YET
   Single VAPI assistant 46bbc1fc-...
   "Thanks for calling DriveBook"
```

### Future (Stage 3)
The incoming webhook resolves the call owner and injects tenant context into VAPI
before the conversation starts.

```
Incoming call: To = +61 8 5555 5555
   GET TwilioPhoneNumber WHERE phoneNumber = "+61855555555"
   Found: organisationId = "org_abc123"  (or instructorId = "inst_xyz")
   GET Organisation  name, welcomeMessage, supportPhone
   Respond to VAPI with assistantOverrides:
    {
      assistantId: "46bbc1fc-...",     // same global assistant
      assistantOverrides: {
        variableValues: {
          businessName:    "ABC Driving School",
          welcomeMessage:  "Thanks for calling ABC Driving School",
          serviceArea:     "Perth metro",
          supportNumber:   "0488 123 456",
          orgId:           "org_abc123"   // passed to tool calls for filtering
        }
      }
    }
   AI says: "Thanks for calling ABC Driving School..."
```

One VAPI assistant. Dynamic identity per number. No per-school assistant creation needed.

**The missing file to create when building this:**
`app/api/voice/incoming/route.ts`  Twilio webhook POST handler

---

## Authentication Boundary Changes (when Organisation is added)

### Current ownership model (unchanged in Stage 1/2)
Every protected route uses `session.user.instructorId` as the sole ownership boundary.
The JWT contains one `instructorId`.

### Future ownership model (Stage 3 only)
JWT gains two optional fields  additive, no breaking change to existing routes:

```typescript
// current JWT (unchanged for all solo instructors)
{ id, email, role, instructorId, clientId }

// future JWT additions (null for solo instructors  no code change needed)
{ id, email, role, instructorId, clientId, organisationId?, orgRole? }
// orgRole: "OWNER" | "MANAGER"  only set when user is a school account, not an instructor
```

Routes that need school-owner access use the additive pattern:

```typescript
// Backward compatible  solo instructors hit the `else` branch (current behaviour)
const where = (session.user.organisationId && session.user.orgRole === 'OWNER')
  ? { instructor: { organisationId: session.user.organisationId } }   // school owner sees all
  : { instructorId: session.user.instructorId }                       // solo instructor (today)
```

### Routes that never need to change (instructor-personal data  Group A)
These manage data personal to the individual instructor. School owners should not
access another instructor's personal records through the API.

| Route | Data |
|-------|------|
| `/api/instructor/profile` | Name, phone, bio, car |
| `/api/instructor/branding` | Logo, colours, slug |
| `/api/instructor/documents` | License, insurance, police check |
| `/api/instructor/stripe-connect` | Personal Stripe Connect onboarding |
| `/api/instructor/earnings` | Personal earnings |
| `/api/instructor/expenses` | Personal expenses |
| `/api/instructor/voice-line` | Assigned phone number |
| `/api/instructor/whiteboard` | Whiteboard uploads |
| `/api/instructor/consent` | Calendar sync consent |
| `/api/instructor/domain/verify` | Custom domain verification |
| `/api/instructor/receipts` | Personal receipts |
| `/api/instructor/invoices` | Personal transactions |

### Routes that gain org-scope when school is built (Group B  booking/client management)
These routes need a read-across-all-instructors path for school owners.
The change is additive  the `else` branch is identical to current code.

| Route | School owner use case |
|-------|----------------------|
| `/api/bookings` | See all bookings across school instructors |
| `/api/clients` | See all students across school |
| `/api/pda-tests` | School-level PDA reporting |
| `/api/instructor/lesson-feedback` | School performance metrics |
| `/api/instructor/service-areas` | School may manage centrally |

### Routes that gain org-scope for configuration (Group C  settings)
School owners may want to set rates, packages, and availability centrally.
Build these last  most schools will let instructors self-manage initially.

| Route | School owner use case |
|-------|----------------------|
| `/api/instructor/settings` | Central rate/hours management |
| `/api/instructor/test-package` | School-wide PDA offering |
| `/api/instructor/subscription` | School pays for all instructor seats |

---

## Migration Risk Summary (all low risk, all additive)

| Change | Risk | Reason |
|--------|------|--------|
| Add `Organisation` model | None | New table, no existing data affected |
| Add `Instructor.organisationId` nullable FK | None | All existing rows = null, no existing query filters on it |
| Add `TwilioPhoneNumber.organisationId` nullable FK | None | Routing code doesn't exist yet anyway |
| Add `Subscription.organisationId` nullable FK | None | Existing instructor subscriptions unaffected |
| JWT additions (`organisationId`, `orgRole`) | None | Both nullable  solo instructors never set them |
| Branding fallback chain | None | Additive `??` operator  only fires if instructor has no branding |

No existing feature can break from these additions. All existing code paths remain
identical because every new field is nullable and no existing query filters on it.

---

## Implementation Sequence (when the time comes)

This is the order that minimises risk and delivers value earliest:

```
Sprint 1  Foundation (no user-visible changes)
  1. Add Organisation model + Prisma migration
  2. Add organisationId to Instructor, TwilioPhoneNumber, Subscription
  3. Add admin UI to create organisations and link instructors (admin-only)

Sprint 2  AI phone routing (visible: per-school AI identity)
  4. Create app/api/voice/incoming/route.ts (Twilio webhook handler)
  5. Update VAPI system prompt to use {{businessName}} etc. variables
  6. Update create-vapi-assistant.js to include org variables in tool schemas
  7. Test: call school number  AI says school name

Sprint 3  School branding (visible: school-branded instructor pages)
  8. Add branding fallback chain to app/subdomain/[slug]/page.tsx
  9. Add org-level branding fields to admin Organisation management UI
  10. School instructors inherit school colours/logo on their booking pages

Sprint 4  School owner dashboard (visible: school admin sees all instructors)
  11. Add organisationId + orgRole to JWT
  12. Add school owner dashboard route (/org/[orgId]/dashboard)
  13. Apply additive ownership pattern to Group B routes
  14. School owner can view all bookings, clients, and instructor performance

Sprint 5  School settings and billing (deferred  build when first school signs up)
  15. School subscription billing (org-level Stripe subscription)
  16. Central settings for school (rates, packages)
  17. Group C route updates
```

Sprints 13 have zero impact on solo instructors and can be deployed silently.
Sprints 45 only matter once the first school account is created.

---

## What Already Exists (no work needed)

| Feature | Location | Status |
|---------|----------|--------|
| Subdomain routing middleware | `middleware.ts` |  Working |
| Custom domain routing | `middleware.ts` |  Working (rewrites to `/custom-domain`) |
| `app/custom-domain/page.tsx` | `app/custom-domain/page.tsx` |  Exists (per SUBDOMAIN_SYSTEM.md) |
| Twilio number pool + admin UI | `TwilioPhoneNumber` + `/admin/voice-lines` |  Working |
| `Instructor.voiceLine` + `voiceLineStatus` | `prisma/schema.prisma` |  In schema |
| `Instructor.customDomain` + `domainVerified` | `prisma/schema.prisma` |  In schema |
| `Instructor.brandLogo/Color` | `prisma/schema.prisma` |  In schema |
| `Instructor.maxInstructors` | `prisma/schema.prisma` |  Field exists (not yet enforced) |
| Subscription tier limits config | `lib/config/subscriptions.ts` |  BUSINESS = unlimited instructors |

The platform is approximately 70% structurally ready for school mode.
The missing 30% is: Organisation table, Twilio routing endpoint, and school dashboard.
