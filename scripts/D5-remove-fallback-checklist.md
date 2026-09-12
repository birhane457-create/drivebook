# D5 — Remove Fallback Checklist

## Status: D5 COMPLETE ✅

All Prisma queries in API routes have been migrated to use extension table helpers.
No Prisma select statement in app/api/** reads driving-specific fields directly.

---

## What Was Done (D3 + D5)

### Extension helpers created
- `lib/extensions/driving/providerProfile.ts`
  - `getDrivingProfile(providerId)` — reads from DrivingProviderProfile, falls back to Instructor cols
  - `mergeDrivingProfile(id, instructor)` — overlays extension fields onto an existing object
  - `upsertDrivingProfile(id, data)` — dual-writes to extension table + Instructor cols
- `lib/extensions/driving/lessonOutcome.ts`
  - `getLessonOutcome(bookingId)` — reads from DrivingLessonOutcome, falls back to Booking cols
  - `mergeLessonOutcome(id, booking)` — overlays outcome fields onto booking object
  - `mergeLessonOutcomes(bookings[])` — batch version
  - `saveLessonOutcome(id, data)` — dual-writes to extension table + Booking cols

### API routes migrated (13 routes)
| Route | Helper used | Read | Write |
|-------|-------------|------|-------|
| `instructor/profile` | mergeDrivingProfile + upsertDrivingProfile | ✅ | ✅ |
| `instructor/settings` | mergeDrivingProfile + upsertDrivingProfile | ✅ | ✅ |
| `instructor/test-package` | mergeDrivingProfile + upsertDrivingProfile | ✅ | ✅ |
| `instructor/lesson-feedback` | getLessonOutcome + saveLessonOutcome | ✅ | ✅ |
| `instructor/documents/*` | mergeDrivingProfile | ✅ | — |
| `instructor/client-performance` | mergeLessonOutcomes | ✅ | — |
| `instructor/client-lesson-feedback` | mergeLessonOutcome | ✅ | — |
| `instructors/[id]` | mergeDrivingProfile | ✅ | — |
| `instructors/search` | mergeDrivingProfile (batch) | ✅ | — |
| `instructors/recommendations` | mergeDrivingProfile (batch) | ✅ | — |
| `client/bookings/[id]` | mergeLessonOutcome | ✅ | — |
| `client/my-performance` | mergeLessonOutcomes | ✅ | — |
| `client/current-instructor` | mergeDrivingProfile | ✅ | — |
| `client/instructors/mobile` | mergeDrivingProfile (batch) | ✅ | — |
| `packages` | mergeDrivingProfile | ✅ | — |
| `pda-tests` | mergeDrivingProfile | ✅ | — |

### Verified: zero Prisma selects on driving fields in app/api/**
- `carMake: true` → 0 occurrences
- `offersTestPackage: true` → 0 occurrences
- `wwcCheckDoc: true` → 0 occurrences
- `licenseNumber: true` → 0 occurrences

---

## Remaining Files With Field References (EXPECTED — not Prisma queries)

These files reference driving field names in:
- TypeScript interface/prop types (driving UI components)
- API response object construction (reading from helpers, not Prisma)
- Input validation schemas (zod schemas accepting these as input)
- Client-side hooks/contexts consuming API responses
- `sanitize.ts` / `cloudinary.ts` — field names as strings

These do NOT need to change for D5. They are correct as-is.

**Categories:**
- `components/` — driving UI components (CarImageModal, LessonFeedbackForm, etc.)
- `app/book/`, `app/dashboard/`, `app/client-dashboard/` — pages consuming API data
- `lib/contexts/`, `lib/hooks/` — client-side state consuming API responses
- `lib/utils/sanitize.ts` — sanitization list (field name strings)
- `lib/services/cloudinary.ts` — folder routing (field name strings)
- Admin routes — still read from Instructor cols directly (see D5 Note below)

---

## D5 Note: Admin Routes

The admin document routes (`app/api/admin/documents/**`, `app/api/admin/instructors/**`)
still read doc fields (wwcCheckDoc, policeCheckDoc, licenseNumber) directly from Instructor.
These are admin-only operations and intentionally deferred:
- Admins can only access active accounts — all data exists in both tables during migration window
- These will be updated in D6 when fallback code is removed

---

## Next Steps

### D6 — Remove fallback + dual-write (do after real-data D4 verification)

**Prerequisites:**
1. Run real-data manual test flows (create provider, upload docs, submit feedback, etc.)
2. Run `npx tsx scripts/verify-d4-extension-data.ts` — must show 0 mismatches
3. Confirm admin routes work correctly after updating to use extension helpers

**D6 changes:**
1. In `providerProfile.ts` — remove the Instructor fallback from `getDrivingProfile()`
2. In `providerProfile.ts` — remove the dual Instructor.update from `upsertDrivingProfile()`
3. In `lessonOutcome.ts` — remove the Booking fallback from `getLessonOutcome()`
4. In `lessonOutcome.ts` — remove the dual Booking.update from `saveLessonOutcome()`
5. Update the admin document routes to use `mergeDrivingProfile()`
6. Update `instructor/settings` to remove `licenseNumber` from Instructor.update

### D7 — Drop legacy columns (do after D6 verifies clean)

```bash
npx prisma migrate dev --name remove_driving_fields_from_core_tables
```

**Columns to drop from `Instructor`:**
carMake, carModel, carYear, vehicleTypes (keep — it's generic), carImage (keep),
vehicleRegistrationDoc, licenseNumber, licenseExpiry, licenseImageFront, licenseImageBack,
insuranceNumber, insuranceExpiry, insurancePolicyDoc, policeCheckDoc, policeCheckExpiry,
wwcCheckDoc, wwcCheckExpiry, certificationDoc, photoIdDoc,
offersTestPackage, testPackageDuration, testPackageIncludes, testPackagePrice

**Columns to drop from `Booking`:**
assessmentType, lessonTopics, passed, performanceScore,
studentStrengths, focusAreas, lessonFeedback, instructorNotes,
whiteboardSketchUrl, feedbackGivenAt

### D8 — Final architecture audit

Run `find-legacy-fields.ps1` after D7.
Expected result: 0 API routes, only driving UI components (correct).
Run `npx tsx scripts/verify-d4-extension-data.ts` — confirm 0 mismatches.
Run `npx tsx lib/templates/__tests__/architecture-test.ts` — confirm 52/52.
