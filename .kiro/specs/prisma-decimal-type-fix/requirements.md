# Requirements Document

## Introduction

The admin instructor detail page (`/admin/instructors/[id]/page.tsx`) displays instructor financial and rating information retrieved from the database via Prisma. The Prisma schema defines the `withholdingTaxRate` field as a `Decimal` type, which Prisma returns as a Decimal object rather than a primitive number. When the page attempts to perform JavaScript operations on this field (such as template string interpolation or arithmetic), a type error occurs because Decimal objects require explicit conversion to numbers before use in JavaScript operations.

This feature addresses the Prisma Decimal type handling issue by implementing proper serialization of Decimal fields in the API response, ensuring that numeric values are converted to primitive JavaScript numbers before being sent to the client.

## Glossary

- **API_Route**: The Next.js API route handler at `/api/admin/instructors/[id]/route.ts` that fetches and returns instructor data
- **Admin_Page**: The client-side page component at `/app/admin/instructors/[id]/page.tsx` that displays instructor details
- **Prisma_Client**: The database client that queries the Provider table and returns records
- **Decimal_Field**: A database field of type `Decimal` in Prisma schema (specifically `withholdingTaxRate`)
- **Float_Field**: A database field of type `Float` in Prisma schema (specifically `hourlyRate` and `averageRating`)
- **Response_Object**: The JSON object returned by the API_Route to the Admin_Page

## Requirements

### Requirement 1

**User Story:** As an administrator, I want to view instructor financial details without encountering type errors, so that I can properly manage instructor information.

#### Acceptance Criteria

1. WHEN THE API_Route retrieves an instructor record from Prisma_Client, THE API_Route SHALL convert all Decimal_Field values to primitive numbers
2. WHEN THE API_Route retrieves an instructor record from Prisma_Client, THE API_Route SHALL preserve Float_Field values as primitive numbers
3. WHEN THE API_Route constructs the Response_Object, THE Response_Object SHALL contain only primitive number types for all numeric fields
4. WHEN THE Admin_Page receives the Response_Object, THE Admin_Page SHALL successfully perform JavaScript operations on all numeric fields without type errors
5. WHEN THE Admin_Page displays the withholdingTaxRate value, THE Admin_Page SHALL render the numeric value correctly in template strings

### Requirement 2

**User Story:** As a developer, I want all numeric database fields to be properly serialized in API responses, so that client-side code can reliably use these values.

#### Acceptance Criteria

1. THE API_Route SHALL convert Decimal objects to numbers using the `.toNumber()` method
2. THE API_Route SHALL handle null values for optional Decimal_Field instances without errors
3. WHEN a Decimal_Field is null, THE API_Route SHALL preserve the null value in the Response_Object
4. THE API_Route SHALL maintain backward compatibility with existing client code that expects numeric types
5. THE Response_Object SHALL be JSON-serializable without custom serialization logic

### Requirement 3

**User Story:** As a system maintainer, I want the fix to be implemented in the API layer, so that all clients automatically benefit from proper data serialization.

#### Acceptance Criteria

1. THE API_Route SHALL perform all Decimal-to-number conversions before sending the Response_Object
2. THE Admin_Page SHALL NOT require modifications to handle Decimal objects
3. WHEN other API endpoints return instructor data with Decimal_Field values, those endpoints SHALL apply the same conversion logic
4. THE conversion logic SHALL be applied consistently across all numeric database fields in the instructor record
5. IF a future Decimal field is added to the Provider model, THE API_Route SHALL convert that field to a number type in responses
