# Design Document: Prisma Decimal Type Fix

## Overview

This document outlines the design for fixing the Prisma Decimal type error in the admin instructor detail page. The issue occurs because Prisma returns `Decimal` objects for database fields defined as `Decimal` type, but JavaScript code expects primitive numbers. The solution involves serializing Decimal fields to primitive numbers in the API layer before sending responses to the client.

## Architecture

### Current State

```
┌─────────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Database      │      │  API Route   │      │  Admin Page     │
│   (PostgreSQL)  │─────▶│  (Next.js)   │─────▶│  (React)        │
└─────────────────┘      └──────────────┘      └─────────────────┘
     Decimal(5,2)            Decimal Object          TypeError!
     withholdingTaxRate      {toNumber(), ...}      (Operations fail)
```

### Proposed Architecture

```
┌─────────────────┐      ┌──────────────────────────────┐      ┌─────────────────┐
│   Database      │      │      API Route               │      │  Admin Page     │
│   (PostgreSQL)  │─────▶│  1. Fetch from Prisma        │─────▶│  (React)        │
└─────────────────┘      │  2. Convert Decimal→Number   │      └─────────────────┘
     Decimal(5,2)         │  3. Return JSON              │          number (47.00)
     withholdingTaxRate   └──────────────────────────────┘      ✓ Operations work
                                  number (47.00)
```

## Component Design

### 1. API Route Handler

**File:** `/app/api/admin/instructors/[id]/route.ts`

**Responsibility:** Fetch instructor data from database and serialize Decimal fields to primitive numbers before sending response.

**Current Implementation:**
```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const instructor = await prisma.provider.findUnique({
    where: { id: params.id },
    include: { /* ... */ }
  });
  
  // Returns instructor directly - Decimal objects not converted
  return NextResponse.json({
    ...instructor,
    stripeConnectStatus,
  });
}
```

**Proposed Implementation:**
```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const instructor = await prisma.provider.findUnique({
    where: { id: params.id },
    include: { /* ... */ }
  });
  
  if (!instructor) {
    return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
  }

  // Serialize Decimal fields to numbers
  const serializedInstructor = {
    ...instructor,
    withholdingTaxRate: instructor.withholdingTaxRate?.toNumber() ?? null,
    stripeConnectStatus: instructor.stripeAccountId ? 'connected' : 'not_connected',
  };

  return NextResponse.json(serializedInstructor);
}
```

### 2. Serialization Logic

**Approach:** Manual field conversion in API route handler

**Rationale:**
- Simple and explicit
- No changes to client code required
- Centralized at the API boundary
- Easy to maintain and understand
- Type-safe with TypeScript

**Fields Requiring Conversion:**
- `withholdingTaxRate`: `Decimal` → `number | null`

**Fields Already Correct:**
- `hourlyRate`: `Float` (already primitive number)
- `averageRating`: `Float | null` (already primitive number)

**Conversion Method:**
```typescript
decimal?.toNumber() ?? null
```

This approach:
- Safely converts Decimal objects using Prisma's built-in `toNumber()` method
- Handles null/undefined values gracefully
- Preserves null for optional fields
- Returns primitive numbers for all numeric fields

### 3. Client Page

**File:** `/app/admin/instructors/[id]/page.tsx`

**Impact:** No changes required

**Current Usage:**
```typescript
interface InstructorData {
  // ...
  withholdingTaxRate: number;
  hourlyRate: number;
  averageRating: number | null;
  // ...
}

// Template string usage - this currently fails with Decimal objects
<p>Withholding Tax Rate: {instructor.withholdingTaxRate}%</p>
```

**After Fix:**
The same code will work because `withholdingTaxRate` will now be a primitive number instead of a Decimal object.

## Data Model

### Provider Model (Relevant Fields)

```prisma
model Provider {
  // Float fields (already primitive numbers)
  hourlyRate        Float
  averageRating     Float?
  
  // Decimal field (requires conversion)
  withholdingTaxRate Decimal @default(47) @db.Decimal(5, 2)
  
  // Other fields...
}
```

**Type Mappings:**
- `Decimal` in Prisma → `Prisma.Decimal` object in TypeScript → Convert to `number`
- `Float` in Prisma → `number` in TypeScript → No conversion needed

## Error Handling

### Null/Undefined Handling

```typescript
// Safe conversion with null coalescing
withholdingTaxRate: instructor.withholdingTaxRate?.toNumber() ?? null
```

**Behavior:**
- If `withholdingTaxRate` is `null` → returns `null`
- If `withholdingTaxRate` is `undefined` → returns `null`
- If `withholdingTaxRate` is a `Decimal` → returns `number`

### Edge Cases

1. **Zero values:** `Decimal(0)` → `0` (number)
2. **Very small decimals:** `Decimal(0.01)` → `0.01` (number)
3. **Maximum precision:** `Decimal(999.99)` → `999.99` (number)
4. **Default value:** `Decimal(47)` → `47` (number)

## Testing Strategy

### Unit Tests

Test the API route handler with specific examples:
- Standard withholding rate (47.00)
- Zero rate (0.00)
- Null withholding rate
- Maximum precision values (999.99)

### Property-Based Tests

Test universal properties across all possible inputs:
- All Decimal fields are converted to primitive numbers
- JavaScript operations work on all numeric fields
- Null values are preserved
- Response is JSON-serializable

### Integration Tests

- Verify admin page renders without type errors
- Verify backward compatibility with existing client code
- Verify other API endpoints handle Decimals consistently

## Migration Strategy

### Phase 1: Fix Single Endpoint
1. Modify `/app/api/admin/instructors/[id]/route.ts`
2. Add Decimal-to-number conversion
3. Deploy and test

### Phase 2: Audit Other Endpoints (Future Work)
1. Search for other endpoints returning Provider data
2. Apply same conversion pattern
3. Create shared serialization utility if needed

### Rollback Plan

If issues arise:
1. Revert the single file change
2. No database migrations required
3. No client-side changes to roll back

## Performance Considerations

**Conversion Cost:** Negligible
- `toNumber()` is an O(1) operation
- Only one Decimal field to convert
- No database query changes

**Memory Impact:** Positive
- Numbers are more memory-efficient than Decimal objects
- JSON serialization is faster with primitive types

## Security Considerations

**No Security Impact:**
- Conversion happens server-side
- No new data exposure
- No changes to authentication/authorization
- No changes to data validation

## Future Enhancements

### Shared Serialization Utility

If more Decimal fields are added in the future, consider creating a shared utility:

```typescript
// lib/serialization/decimalSerializer.ts
export function serializeProvider(provider: Provider) {
  return {
    ...provider,
    withholdingTaxRate: provider.withholdingTaxRate?.toNumber() ?? null,
    // Add more Decimal fields here as needed
  };
}
```

**Benefits:**
- DRY principle
- Consistent serialization across endpoints
- Easy to extend for new Decimal fields

**When to implement:**
- When 3+ endpoints need the same serialization
- When 3+ Decimal fields need conversion
- When consistency becomes hard to maintain

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Decimal-to-Number Conversion

*For any* instructor record retrieved from the database with a non-null `withholdingTaxRate` field, the API response SHALL contain that field as a primitive JavaScript number type, and *for any* instructor record with a null `withholdingTaxRate` field, the API response SHALL preserve the null value.

**Validates: Requirements 1.1, 1.3, 2.3, 3.4**

### Property 2: JavaScript Operations Compatibility

*For any* instructor record returned by the API, all numeric fields (including `withholdingTaxRate`, `hourlyRate`, and `averageRating`) SHALL support standard JavaScript numeric operations (arithmetic, comparison, template string interpolation) without throwing type errors.

**Validates: Requirements 1.4, 1.5**

### Property 3: JSON Serialization

*For any* instructor record returned by the API, the response object SHALL be JSON-serializable using `JSON.stringify()` without requiring custom serialization logic or throwing errors.

**Validates: Requirements 2.5**

## Implementation Checklist

- [ ] Modify `/app/api/admin/instructors/[id]/route.ts` to convert `withholdingTaxRate` to number
- [ ] Add unit tests for Decimal conversion with various values
- [ ] Add property tests for numeric type consistency
- [ ] Test admin page renders without errors
- [ ] Verify template string interpolation works
- [ ] Test null handling
- [ ] Document the pattern for future Decimal fields

## References

- [Prisma Decimal Documentation](https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields#working-with-decimal)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- Requirements Document: `.kiro/specs/prisma-decimal-type-fix/requirements.md`
