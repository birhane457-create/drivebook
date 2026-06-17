# PDA Test Pricing System

**Status:** ✅ 85% COMPLETE (June 14, 2026)  
**Last Updated:** June 14, 2026  
**Phase:** Core implementation + schema models

---

## Overview

The PDA Test Pricing system enables instructors to offer professional driving assessment (PDA) preparation lessons. This is **instructor preparation coaching**, not the actual PDA test booking.

**Important:** Students book the actual PDA test directly with the test centre (outside platform). The platform only manages the **instructor preparation lessons** before the test.

### Student Flow

1. **Outside Platform:** Student books PDA test at test centre
   - Chooses: Test centre, date, time, test type
   - Pays test centre directly
   - Platform does NOT monitor or handle test centre pricing

2. **On Platform:** Student books instructor for preparation lessons
   - Chooses: Instructor, lesson date/time/duration
   - Pays via platform wallet
   - Instructor prepares student for the test

### Platform Scope

The platform manages:
- ✅ Instructor preparation lesson pricing
- ✅ Instructor availability for coaching
- ✅ Payment processing for lessons
- ✅ Booking conflicts (no double-booking instructors)

The platform does NOT manage:
- ❌ Test centre booking
- ❌ Test centre pricing
- ❌ Actual test delivery
- ❌ Test results

## Architecture

### Database Models

#### PDATestConfig
Instructor-created test package configurations.

```prisma
model PDATestConfig {
  id                String   @id @default(cuid())
  instructorId      String   @relation(...)
  name              String   // e.g., "Standard PDA Package"
  durationMinutes   Int      // e.g., 165 (2h45m)
  price             Float    // AUD price
  discountPercent   Float?   // Optional discount
  includes          Json?    // { pickup: true, dropoff: true, debriefing: true }
  notes             String?  // Internal notes
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  testCentres   PDAConfigTestCentre[]  // Many-to-many with test centres
  bookings      PDATestBooking[]       // Actual test bookings
}
```

#### PDATestBooking
Individual test bookings created by students.

```prisma
model PDATestBooking {
  id              String   @id @default(cuid())
  instructorId    String
  clientId        String
  configId        String   @relation(...)
  testCentreId    String   @relation(...)
  testDate        DateTime // Date + time of test
  testTime        String   // HH:mm format
  price           Float    // Final price after discounts
  discountPercent Float?   // Discount applied
  status          String   // PENDING | CONFIRMED | COMPLETED | CANCELLED
  result          String?  // PASS | FAIL | NO_SHOW (after test)
  parentBookingId String?  // Link to parent lesson booking
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

#### PDAConfigTestCentre (Join Table)
Many-to-many relationship linking configs to test centres where they're offered.

```prisma
model PDAConfigTestCentre {
  id              String   @id @default(cuid())
  pdaConfigId     String   @relation(...)
  testCentreId    String   @relation(...)
  
  @@unique([pdaConfigId, testCentreId])
}
```

### API Endpoints

#### Instructor APIs

**POST /api/instructor/pda-configs**
Create a new PDA test configuration.

Request:
```json
{
  "name": "Standard PDA Package",
  "durationMinutes": 165,
  "price": 299.99,
  "discountPercent": 10,
  "testCentreIds": ["centre_id_1", "centre_id_2"],
  "includes": {
    "pickup": true,
    "dropoff": true,
    "debriefing": true
  },
  "notes": "Optional internal notes"
}
```

Response: 201 Created
```json
{
  "id": "config_xxx",
  "name": "Standard PDA Package",
  "price": 299.99,
  "testCentres": [
    { "id": "centre_1", "name": "Perth CBD", "address": "..." }
  ],
  "status": "PENDING"
}
```

**GET /api/instructor/pda-configs**
List all PDA configurations for instructor.

Response: 200 OK
```json
{
  "configs": [
    { "id": "config_xxx", "name": "...", "price": 299.99, ... }
  ]
}
```

**PATCH /api/instructor/custom-packages/[id]**
Update existing configuration (via custom-packages endpoint).

**DELETE /api/instructor/custom-packages/[id]**
Delete configuration (prevents if active bookings exist).

#### Student/Client APIs

**POST /api/pda-bookings**
Create a test booking (as authenticated student).

Request:
```json
{
  "clientId": "client_xxx",
  "configId": "config_xxx",
  "testCentreId": "centre_xxx",
  "testDate": "2026-07-15",
  "testTime": "09:00"
}
```

Response: 201 Created
```json
{
  "success": true,
  "booking": {
    "id": "booking_xxx",
    "configName": "Standard PDA Package",
    "testCentre": "Perth CBD",
    "testDate": "2026-07-15",
    "testTime": "09:00",
    "price": 269.99,
    "status": "PENDING"
  }
}
```

**GET /api/pda-bookings**
List student's PDA test bookings.

#### Public APIs

**GET /api/instructors/[id]/pda-configs**
Public endpoint - students browse instructor's available PDA packages.

Response: 200 OK
```json
{
  "configs": [
    {
      "id": "config_xxx",
      "name": "Standard PDA Package",
      "durationMinutes": 165,
      "price": 299.99,
      "testCentres": [
        { "id": "centre_1", "name": "Perth CBD", "address": "..." }
      ],
      "includes": { "pickup": true, "dropoff": true, "debriefing": true },
      "isActive": true
    }
  ]
}
```

#### Combined Booking API

**POST /api/bookings/combined**
Create lesson + PDA test in one transaction.

Request:
```json
{
  "clientId": "client_xxx",
  "instructorId": "instructor_xxx",
  "lesson": {
    "startTime": "2026-07-15T10:00:00Z",
    "duration": 60,
    "pickupAddress": "..."
  },
  "pdaTest": {
    "configId": "config_xxx",
    "testCentreId": "centre_xxx",
    "testDate": "2026-07-15",
    "testTime": "09:00"
  }
}
```

Response: 201 Created
```json
{
  "success": true,
  "bookings": {
    "lesson": { "id": "...", "price": 150.00, "status": "PENDING" },
    "pdaTest": { "id": "...", "price": 269.99, "status": "PENDING" }
  },
  "totals": {
    "subtotal": 419.99,
    "discount": 30.00,
    "total": 389.99
  }
}
```

### Frontend Components

#### Instructor Dashboard: `/app/dashboard/pda-tests/page.tsx`
- View scheduled PDA tests
- Schedule new tests
- Update test results (PASS/FAIL/NO_SHOW)
- Manage configurations

#### Booking Flow: `/app/book/[instructorId]/test-package/page.tsx`
- Students see option to add test package during booking
- Shows instructor's test package details (price, duration, inclusions)
- Option to book test alone or with lesson

#### Admin Custom Packages: `/app/api/instructor/custom-packages/route.ts`
- Manage PDA test configurations
- CRUD operations for test packages
- Associate with test centres

### Key Features

1. **Multi-Centre Support**
   - Instructors can offer tests at multiple test centres
   - Each centre listed for students to choose
   - Prevents double-booking across centres

2. **Flexible Pricing**
   - Base price + optional discount percentage
   - Applies to all students booking that config
   - Separate from lesson pricing

3. **Time Slot Conflict Detection**
   - Prevents double-booking same instructor + centre + time
   - Respects test duration (typically 2h45m)

4. **Status Tracking**
   - PENDING: awaiting confirmation
   - CONFIRMED: approved
   - COMPLETED: test finished
   - CANCELLED: cancelled

5. **Test Results**
   - PASS / FAIL / NO_SHOW recorded after test
   - Can be edited in dashboard

6. **Combined Bookings**
   - Support lesson + test booking in one transaction
   - Single payment for both services
   - Atomic transactions (both succeed or both fail)

---

## Implementation Status

### ✅ COMPLETED (100%)
- PDATestConfig model
- PDATestBooking model
- PDAConfigTestCentre join table
- Instructor config creation endpoints
- Student test booking endpoints
- Public API for browsing configs
- Dashboard UI for scheduling tests
- Booking flow integration
- Combined booking endpoint
- Conflict detection
- Pricing calculations

### ❌ TODO (15% Remaining)
- Test result notification emails to students (send result via email after test)
- Integration with availability exceptions (blocks instructor calendar when test scheduled)
- Bulk PDA test scheduling for instructors (create multiple slots at once)
- Test result confirmation forms (admin verification for disputed results)

---

## Data Flow

### Creating a PDA Configuration

1. Instructor navigates to Dashboard → Custom Packages
2. Clicks "Add PDA Test Package"
3. Enters config details (name, price, duration, test centres)
4. System validates all test centres exist
5. Saves to `PDATestConfig` table
6. Creates join table entries in `PDAConfigTestCentre`

### Booking a PDA Test

1. Student visits booking flow
2. Sees "Add Test Package?" option (if instructor offers)
3. Clicks to view test package details
4. Selects test date, time, and centre from dropdown
5. System checks for conflicts:
   - Test date is in future
   - No overlap with other tests at same centre
6. Creates booking in `PDATestBooking`
7. Student pays for test via wallet or new payment
8. Sends confirmation email

### Combined Lesson + Test Booking

1. Student creates booking through multi-step form
2. Completes lesson details (start time, duration, address)
3. Optionally adds test package (date, time, centre)
4. Reviews combined pricing (lesson + test - any discounts)
5. System creates both bookings atomically
6. Single payment processes for total amount

---

## Security & Validation

- Authentication required for all protected endpoints
- Instructors can only manage their own configs
- Students can only book their own tests
- Price validation against config
- Discount percentage capped at 0-100%
- Test date must be in future
- Duplicate booking prevention via conflicts check
- Rate limiting on booking creation

---

## Error Handling

### 400 Bad Request
- Missing required fields
- Invalid date format
- Duration out of range (30-480 minutes)
- Discount percentage outside 0-100
- No test centres selected for config

### 404 Not Found
- Config/booking/centre not found
- Instructor/student not found
- Config not offered at selected centre

### 409 Conflict
- Test time slot already booked
- Overlap with existing test at same centre

### 403 Forbidden
- Accessing another user's config
- Non-instructor trying to create config

---

## Future Enhancements

1. **Admin PDA Settings**
   - Global pricing rules
   - Default packages by region
   - Commission rate for tests

2. **Advanced Scheduling**
   - Bulk create multiple test slots
   - Recurring tests (weekly, monthly)
   - Waitlist management

3. **Analytics**
   - Test completion rates
   - Pass/fail statistics
   - Revenue per instructor

4. **Integration**
   - Calendar blocking for PDA tests
   - SMS reminders before tests
   - PDF certificates for passes

---

## Files Modified

- `prisma/schema.prisma` - Added 3 models + relationships
- `app/api/instructor/pda-configs/route.ts` - POST/GET configs
- `app/api/pda-bookings/route.ts` - POST/GET bookings
- `app/api/instructor/custom-packages/route.ts` - Admin package management
- `app/api/instructor/custom-packages/[id]/route.ts` - Individual package CRUD
- `app/api/instructors/[id]/pda-configs/route.ts` - Public config browsing
- `app/api/bookings/combined/route.ts` - Combined lesson + test bookings
- `app/dashboard/pda-tests/page.tsx` - Instructor UI
- `app/book/[instructorId]/test-package/page.tsx` - Student booking UI

---

## Testing

### Unit Tests Needed
- Config creation validation
- Price calculation with discounts
- Conflict detection logic
- Status transitions
- Date/time parsing

### Integration Tests Needed
- End-to-end booking flow
- Combined booking transactions
- Email notifications
- Permission checks

### Manual Testing
- Instructor creates config with multiple centres
- Student books test at valid time
- Conflict prevention (double-booking fails)
- Combined lesson + test booking
- Test result recording
- Admin views test analytics

