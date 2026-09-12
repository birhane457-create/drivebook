# Implementation Plan: Fix Prisma Decimal Type Error in Admin Instructor Detail Page

## Overview

Fix type errors when using JavaScript number methods on Prisma Decimal fields in the admin instructor detail page. The implementation adds a safe conversion helper and updates all Decimal field usage to convert to primitive numbers before calling methods like `.toFixed()`.

## Tasks

- [ ] 1. Add Prisma import and create conversion helper
  - Add `import { Prisma } from '@prisma/client'` at the top of the file
  - Create `toNumber()` helper function that safely converts Prisma.Decimal to number
  - Add JSDoc comment explaining the helper's purpose
  - Place helper after interface definitions, before main component
  - _Requirements: 4.1, 4.2_

- [ ] 2. Update TypeScript interface for Decimal fields
  - Update `InstructorData` interface to type Decimal fields correctly
  - Change `withholdingTaxRate` to `Prisma.Decimal | number`
  - Update booking price fields to `Prisma.Decimal | number` in nested booking type
  - Ensure `averageRating` and `hourlyRate` remain as `number` (they're Float in schema)
  - _Requirements: 4.1, 4.2_

- [ ] 3. Fix average rating display in stats cards
  - Locate the average rating display in the stats cards section (~line 693)
  - Update to use `toNumber(instructor.averageRating).toFixed(1)` with null check
  - Ensure "N/A" displays when rating is null
  - Test null handling
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 4. Fix booking price display in bookings table
  - Locate the booking price display in the bookings tab (~line 1092)
  - Replace existing complex type check with `toNumber(booking.price).toFixed(2)`
  - Ensure $ prefix is preserved in the display
  - Handle edge cases (null, undefined, zero)
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 5. Review and fix other Decimal fields if present
  - Search for other uses of `hourlyRate`, `withholdingTaxRate` in the file
  - Check if any other booking Decimal fields are displayed (platformFee, providerPayout, etc.)
  - Apply `toNumber()` conversion if needed
  - Verify `hourlyRate` displays correctly (already a Float/number, may not need conversion)
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 6. Checkpoint - Ensure all tests pass
  - Run TypeScript type checking: `npm run type-check` or `tsc --noEmit`
  - Run ESLint if configured: `npm run lint`
  - Manually test the page in browser
  - Check browser console for any runtime errors
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks are designed to be implemented sequentially for safe incremental progress
- Each task builds on the previous one
- The helper function (task 1) is used by all subsequent tasks
- No test tasks are marked optional as this is a bug fix requiring verification
- No property-based tests needed as this is a focused bug fix, not a feature with universal properties

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1", "4.1"] },
    { "id": 3, "tasks": ["5.1"] }
  ]
}
```
