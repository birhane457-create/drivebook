# Phase 6 Fix 1 — Instructor → Provider Rename Checklist

## What changed in the schema

| Before | After |
|---|---|
| `model Instructor` | `model Provider` |
| `User.instructorId` | `User.providerId` |
| `User.instructor` relation | `User.provider` relation |
| `User.clients` relation | `User.customers` relation |
| `model InstructorExpense` | `model ProviderExpense` |
| `InstructorExpense.instructorId` | `ProviderExpense.providerId` |
| `SlotReservation.instructorId` | `SlotReservation.providerId` |
| `Subscription.instructorId` | `Subscription.providerId` |
| `CardOrder.instructorId` | `CardOrder.providerId` |
| `PDATestConfig.instructorId` | `PDATestConfig.providerId` |
| `PDATestBooking.instructorId` | `PDATestBooking.providerId` |
| `TwilioPhoneNumber.instructor` relation | `TwilioPhoneNumber.provider` relation |
| `Instructor.voiceLine/Status/Sid` | → moved to `DrivingProviderProfile` |
| `Instructor.lessonPackages` | → moved to `DrivingProviderProfile` |
| `Instructor.carImage` | → moved to `DrivingProviderProfile` |
| `Instructor.vehicleTypes` | → moved to `DrivingProviderProfile` |
| `Instructor.maxInstructors` | `Provider.maxProviders` |

## Fields intentionally kept on Provider

These are generic enough to apply to any business type:
- `approvalStatus` — used when platform vets providers; defaults PENDING
- `documentsVerified` — used by extension-driven compliance; null for non-driving
- `specialties`, `yearsExperience`, `bio` — generic profile data

## Migration steps

1. Run Prisma migration:
   ```
   npx prisma migrate dev --name phase6_provider_rename
   ```
   Prisma will generate the migration SQL. Review it — it may DROP/CREATE
   instead of RENAME. If so, use the manual SQL below instead.

2. Run the manual SQL (recommended for production — preserves data):
   ```
   psql $DATABASE_URL -f scripts/migrate-provider-rename.sql
   ```

3. Regenerate Prisma client:
   ```
   npx prisma generate
   ```

4. Update TypeScript code — find all references:
   ```powershell
   Select-String -Path "**/*.ts","**/*.tsx" -Pattern "prisma\.instructor" -Recurse
   Select-String -Path "**/*.ts","**/*.tsx" -Pattern "instructorId" -Recurse
   Select-String -Path "**/*.ts","**/*.tsx" -Pattern "InstructorExpense" -Recurse
   ```

5. Replace in code:
   - `prisma.instructor.` → `prisma.provider.`
   - `prisma.instructorExpense.` → `prisma.providerExpense.`
   - `session.instructorId` → `session.providerId` (already done in Phase 2)
   - `include: { instructor: true }` → `include: { provider: true }`
   - `.instructor` property access → `.provider`

6. Build check:
   ```
   npm run build
   ```

## Files most likely to need updating

- `app/api/admin/instructors/**` — all instructor admin routes
- `app/api/bookings/**` — booking creation/confirmation
- `app/api/instructor/**` — instructor-facing API routes
- `app/dashboard/**` — instructor dashboard pages
- `lib/services/payment.ts` — uses `prisma.instructor` directly
- `lib/services/availability.ts` — queries instructor working hours
- `lib/services/payout-service.ts` — references instructorId
- `types/next-auth.d.ts` — session type may still have instructorId
