# Phase 6 Fix 3 — Booking.instructorId → providerId Checklist

## What changed in the schema

| Before | After |
|---|---|
| `Booking.instructorId String` | `Booking.providerId String` |
| `Booking.instructorPayout Float` | `Booking.providerPayout Float` |
| `Booking.instructor` relation → `Instructor` | `Booking.provider` relation → `Provider` |
| `@@index([instructorId, customerRating])` | `@@index([providerId, customerRating])` |
| `PlatformSettings.drivingTestPackagePrice` | Removed — moved to `DrivingProviderProfile.testPackageDefaultPrice` |

## Migration steps

1. Run Prisma migration:
   ```
   npx prisma migrate dev --name phase6_booking_provider
   ```

2. Run the manual SQL:
   ```
   psql $DATABASE_URL -f scripts/migrate-booking-provider.sql
   ```

3. Migrate drivingTestPackagePrice data:
   ```sql
   -- Copy the platform default into each existing DrivingProviderProfile
   UPDATE "DrivingProviderProfile"
   SET "testPackageDefaultPrice" = (
     SELECT "drivingTestPackagePrice" FROM "PlatformSettings" LIMIT 1
   )
   WHERE "testPackageDefaultPrice" IS NULL;
   ```
   Then drop the column from PlatformSettings via migration.

4. Regenerate Prisma client:
   ```
   npx prisma generate
   ```

5. Find all TypeScript references to update:
   ```powershell
   Select-String -Path "**/*.ts","**/*.tsx" -Pattern "instructorId" -Recurse
   Select-String -Path "**/*.ts","**/*.tsx" -Pattern "instructorPayout" -Recurse
   Select-String -Path "**/*.ts","**/*.tsx" -Pattern "drivingTestPackagePrice" -Recurse
   ```

6. Replace in code:
   - `booking.instructorId` → `booking.providerId`
   - `booking.instructorPayout` → `booking.providerPayout`
   - `{ instructorId: x }` in booking where/create → `{ providerId: x }`
   - `include: { instructor: true }` on booking queries → `include: { provider: true }`
   - `platformSettings.drivingTestPackagePrice` → driving extension config

7. Build check:
   ```
   npm run build
   ```

## Files most likely to need updating

- `app/api/bookings/**` — all booking create/read/update routes
- `app/api/public/bookings/**` — public booking creation
- `app/api/admin/bookings/**` — admin booking management
- `app/api/client/bookings/**` — client-facing booking routes
- `app/api/payments/**` — payment routes reference instructorId
- `app/api/stripe/webhook/**` — webhook uses instructorId to find booking
- `lib/services/payment.ts` — instructorPayout used in commission calc
- `lib/services/payout-service.ts` — queries bookings by instructorId
- `lib/services/ledger-service.ts` — references instructorPayout in entries
- `app/api/admin/settings/**` — remove drivingTestPackagePrice references

---

# Phase 6 Full Migration Run Order

Run all three Fix migrations in sequence:

```powershell
# 1. Apply schema (Prisma generates SQL from the updated schema.prisma)
npx prisma migrate dev --name phase6_provider_rename
npx prisma migrate dev --name phase6_customer_rename
npx prisma migrate dev --name phase6_booking_provider

# 2. If Prisma generates DROP/CREATE instead of RENAME, run manual SQL instead:
psql $DATABASE_URL -f scripts/migrate-provider-rename.sql
psql $DATABASE_URL -f scripts/migrate-customer-rename.sql
psql $DATABASE_URL -f scripts/migrate-booking-provider.sql

# 3. Regenerate client
npx prisma generate

# 4. Verify schema is clean
npx prisma validate

# 5. Build check
npm run build
```
