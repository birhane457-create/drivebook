# Phase 6 Fix 2 — Client → Customer Rename Checklist

## What changed in the schema

| Before | After |
|---|---|
| `model Client` | `model Customer` |
| `Client.instructorId String` (hard FK) | Removed — customer is no longer owned by one provider |
| `Client.preferredInstructorId String?` | `Customer.preferredProviderId String?` |
| *(new)* | `Customer.businessId String?` — customer belongs to a business |
| `Booking.clientId` | `Booking.customerId` |
| `Booking.clientName` | `Booking.customerName` |
| `Booking.clientPhone` | `Booking.customerPhone` |
| `Booking.clientEmail` | `Booking.customerEmail` |
| `Booking.clientRating` | `Booking.customerRating` |
| `Booking.clientReview` | `Booking.customerReview` |
| `Booking.client` relation | `Booking.customer` relation |
| `PDATestBooking.clientId` | `PDATestBooking.customerId` |
| `PDATestBooking.client` relation | `PDATestBooking.customer` relation |
| `Task.clientId` | `Task.customerId` |
| `User.clients` relation | `User.customers` relation |

## Why businessId is nullable

During the transition, existing Customer records will have `businessId = null`.
The data migration script should back-fill businessId from the existing
instructorId relationship: a customer's instructorId maps to a Provider, and
that Provider belongs to a Business. The back-fill query is:

```sql
UPDATE "Customer" c
SET "businessId" = (
  SELECT b.id FROM "Business" b
  JOIN "Provider" p ON p."businessId" = b.id  -- once Provider has businessId
  WHERE p.id = c."providerId_old"              -- from the dropped instructorId
  LIMIT 1
)
WHERE c."businessId" IS NULL;
```

Note: Provider does not yet have a `businessId` column — that's added in a
later phase when the Business ↔ Provider relationship is formalised.
For now, businessId on Customer can remain null and be populated when that
relationship is established.

## Migration steps

1. Run Prisma migration:
   ```
   npx prisma migrate dev --name phase6_customer_rename
   ```

2. Run the manual SQL:
   ```
   psql $DATABASE_URL -f scripts/migrate-customer-rename.sql
   ```

3. Regenerate Prisma client:
   ```
   npx prisma generate
   ```

4. Find all TypeScript references to update:
   ```powershell
   Select-String -Path "**/*.ts","**/*.tsx" -Pattern "prisma\.client\b" -Recurse
   Select-String -Path "**/*.ts","**/*.tsx" -Pattern "\.clientId\b" -Recurse
   Select-String -Path "**/*.ts","**/*.tsx" -Pattern "clientName|clientPhone|clientEmail|clientRating|clientReview" -Recurse
   Select-String -Path "**/*.ts","**/*.tsx" -Pattern "instructorId.*client|client.*instructorId" -Recurse
   ```

5. Replace in code:
   - `prisma.client.` → `prisma.customer.`
   - `.clientId` → `.customerId`
   - `.clientName` → `.customerName`
   - `.clientPhone` → `.customerPhone`
   - `.clientEmail` → `.customerEmail`
   - `.clientRating` → `.customerRating`
   - `.clientReview` → `.customerReview`
   - `include: { client: true }` → `include: { customer: true }`
   - `instructor: { include: { clients: true } }` → `provider: { include: { customers: true } }`
   - When creating a Customer, remove the `instructorId` field

6. Build check:
   ```
   npm run build
   ```

## Files most likely to need updating

- `app/api/clients/**` — all client CRUD routes (rename to customers/)
- `app/api/admin/clients/**` — admin client management
- `app/api/bookings/**` — booking creation uses clientId/clientName
- `app/dashboard/clients/**` — instructor client list pages
- `app/client-dashboard/**` — student-facing dashboard (irony: client-dashboard uses Client model)
- `lib/services/payment.ts` — references clientId for wallet lookups
- `lib/services/notifications.ts` — passes clientName to notification helpers
- `components/InstructorCard.tsx` — may reference client count
