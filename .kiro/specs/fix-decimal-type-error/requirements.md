# Requirements: Fix Prisma Decimal Type Error in Admin Instructor Detail Page

## Problem Statement

The admin instructor detail page (`app/admin/instructors/[id]/page.tsx`) contains type errors when trying to use JavaScript number methods like `.toFixed()` on Prisma Decimal type fields. Prisma returns Decimal fields as Decimal objects, not primitive numbers, which causes runtime errors or type errors when attempting to call number methods directly.

## User Stories

### 1. Display Average Rating

**As an** admin viewing instructor details  
**I want** the average rating to display correctly with one decimal place  
**So that** I can see the instructor's rating without errors

**Acceptance Criteria:**
- 1.1. The `averageRating` field (Prisma Decimal type) is properly converted to a number before calling `.toFixed(1)`
- 1.2. The displayed rating shows one decimal place (e.g., "4.5")
- 1.3. When `averageRating` is null, display "N/A"
- 1.4. No runtime errors occur when rendering the rating

### 2. Display Booking Prices

**As an** admin viewing an instructor's booking history  
**I want** booking prices to display correctly with two decimal places  
**So that** I can see accurate financial information

**Acceptance Criteria:**
- 2.1. The `booking.price` field (Prisma Decimal type) is properly converted to a number before calling `.toFixed(2)`
- 2.2. All booking prices display with two decimal places (e.g., "$85.00")
- 2.3. Handle edge cases where price might be null or undefined
- 2.4. No runtime errors occur in the bookings table

### 3. Display Hourly Rate

**As an** admin viewing instructor financial details  
**I want** the hourly rate to display correctly  
**So that** I can review the instructor's pricing

**Acceptance Criteria:**
- 3.1. The `hourlyRate` field (Float type in schema) displays correctly without errors
- 3.2. The hourly rate shows appropriate precision
- 3.3. No type errors occur when rendering the hourly rate

### 4. Type Safety

**As a** developer  
**I want** proper TypeScript types for Decimal fields  
**So that** type errors are caught at compile time

**Acceptance Criteria:**
- 4.1. The `InstructorData` interface correctly types Decimal fields as `Prisma.Decimal` or number
- 4.2. All Decimal field conversions are type-safe
- 4.3. No TypeScript errors in the file after the fix

## Technical Context

### Affected Fields

From the Prisma schema analysis:

1. **InstructorProvider model:**
   - `averageRating`: `Float?` (nullable)
   - `hourlyRate`: `Float`
   - `withholdingTaxRate`: `Decimal @db.Decimal(5, 2)`

2. **Booking model:**
   - `price`: `Decimal @db.Decimal(12, 2)`
   - `platformFee`: `Decimal @db.Decimal(12, 2)`
   - `providerPayout`: `Decimal @db.Decimal(12, 2)`
   - Other Decimal fields for package-related amounts

### Current Error Pattern

The current code uses pattern like:
```typescript
instructor.averageRating.toFixed(1)  // ❌ Error: Decimal object doesn't have toFixed method
booking.price.toFixed(2)             // ❌ Error: Decimal object doesn't have toFixed method
```

### Solution Approach

Convert Prisma Decimal objects to numbers before using number methods:
```typescript
Number(instructor.averageRating).toFixed(1)  // ✅ Correct
Number(booking.price).toFixed(2)             // ✅ Correct
```

Or check the type and convert conditionally:
```typescript
(typeof booking.price === "number" ? booking.price : Number(booking.price)).toFixed(2)
```

## Non-Functional Requirements

- **Performance**: Conversions should have negligible performance impact
- **Maintainability**: Solution should be clear and follow TypeScript best practices
- **Compatibility**: Fix should work with current Prisma setup without schema changes

## Out of Scope

- Changing Prisma schema types
- Modifying database migrations
- Fixing similar issues in other pages (this is a focused fix for the instructor detail page only)
- Adding global Decimal utility functions (can be done in a separate task if needed)

## Dependencies

- Existing Prisma schema and generated types
- Current TypeScript configuration
- No external package dependencies required
