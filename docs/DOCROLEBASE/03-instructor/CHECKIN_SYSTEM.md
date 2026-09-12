# Check-In System

**Status**: ✅ FULLY IMPLEMENTED & INTEGRATED  
**Last Verified**: June 14, 2026  
**Endpoints**: 
- `POST /api/bookings/[id]/check-in` (✅ Fully Implemented)
- `POST /api/bookings/[id]/check-out` (✅ Fully Implemented)  
**Authentication**: NextAuth (web) + JWT (mobile)  
**Rate Limited**: Yes (booking action limits)  
**Frontend**: ✅ Web UI in instructor dashboard + ✅ Mobile app UI (React Native)

---

## AS IS - Current Implementation

### Check-In Flow

| Step | Description | Code Reference |
|------|-------------|-----------------|
| **1. Auth & Rate Limiting** | Accept NextAuth session or JWT bearer token. Validate rate limits for booking actions | `authOptions`, `bookingActionRateLimit` |
| **2. Authorization** | Verify user owns this booking (as instructor or client). Reject if booking belongs to different user | Instructor check: `booking.instructorId !== instructorId` |
| **3. Time Validation** | Compare current time to booking.startTime. Enforce check-in windows | See "Fraud Prevention" below |
| **4. Late Check-In Check** | If > 15 minutes late, require reason + acknowledgment before proceeding | `isLateCheckIn` flag logic |
| **5. Atomic Update** | Update booking with check-in metadata. Use `updateMany` with idempotency guard (`checkInTime: null`) | `prisma.booking.updateMany()` |
| **6. Auto-Complete** | If booking end time has passed, auto-mark as COMPLETED | `bookingEndTime && now >= bookingEndTime` |
| **7. SMS Notification** | Send non-blocking SMS to other party (instructor if client checked in, vice versa) | `smsService.sendSMS()` |

### Check-Out Flow

| Step | Description | Code Reference |
|------|-------------|-----------------|
| **1. Auth & Rate Limiting** | Accept NextAuth session or JWT bearer token. Validate rate limits | `bookingActionRateLimit` |
| **2. Authorization** | Verify user owns this booking (as instructor or client) | Booking ownership check |
| **3. Pre-Check-Out Validation** | Verify booking has been checked in (checkInTime must exist) | `if (!booking.checkInTime)` → 400 |
| **4. Duration Calculation** | Calculate actual lesson duration from checkInTime to now | `(checkOutTime - checkInTime) / 60 / 1000` |
| **5. Atomic Update (Transaction)** | Update booking: set checkOutTime, status=COMPLETED, mark as checked out | `prisma.$transaction()` with `checkOutTime: null` guard |
| **6. Transaction Sync** | Link check-out to financial transaction record (if exists) or create one | Update existing transaction OR create new |
| **7. SMS Notification** | Send non-blocking SMS to other party | `smsService.sendSMS()` |

**Check-Out Specific Features:**
- ✅ **Idempotency Guard**: `updateMany` with `checkOutTime: null` prevents double checkout
- ✅ **Atomic Transaction**: Uses `prisma.$transaction()` to update booking + transaction record simultaneously
- ✅ **Duration Tracking**: Records actual lesson duration (may differ from booked duration if late check-in)
- ✅ **Status Auto-Set**: Sets booking status to COMPLETED on checkout
- ✅ **Financial Integration**: Links to Transaction model for payout processing

### Fraud Prevention Measures

| Case | Time Window | Action | Error Response |
|------|-------------|--------|-----------------|
| **Too Early** | > 15 min before start | Block check-in | "Cannot check in yet. Lesson starts in X minutes" |
| **Normal** | 15 min before to 24 hours after | Allow check-in | Proceed normally |
| **Late (Within 24h)** | 15 min to 24 hours after start | Require reason + acknowledgment | "Late check-in requires acknowledgment + 10+ char reason" |
| **Very Late (> 24h)** | > 24 hours after start | Block check-in | "Cannot check in to bookings older than 24 hours. Contact support." |

**Rationale**: 
- 15-minute early window allows for client/instructor arriving slightly early
- 24-hour cutoff prevents fraud (preventing old bookings from retroactively being marked as attended)
- Late check-in reason audit trail helps identify systemic issues

### Request/Response Structure

**POST Request**:
```json
{
  "location": "string (optional)",
  "photo": "string (optional, base64 or URL)",
  "lateCheckInReason": "string (required if > 15 min late, min 10 chars)",
  "acknowledgeLateCheckIn": "boolean (required if > 15 min late)"
}
```

**Success Response (200)**:
```json
{
  "success": true,
  "checkInTime": "2026-06-14T14:30:00Z",
  "message": "Checked in successfully"
}
```

**Idempotency**:
- If `checkInTime` is already set, reject with "Already checked in" (400)
- Prevents double-check-in under concurrent requests

**Error Responses**:
| Code | Scenario | Message |
|------|----------|---------|
| 401 | Invalid JWT or no session | "Unauthorized" / "Invalid token" |
| 403 | Booking belongs to different instructor/client | "Forbidden - This booking belongs to another X" |
| 404 | Booking doesn't exist | "Booking not found" |
| 400 | Too early, too late, or already checked in | Various (see fraud prevention above) |
| 429 | Rate limit exceeded | "Rate limit exceeded" + retry headers |

### Metadata Recorded

When check-in completes, the booking record is updated with:

| Field | Value | Purpose |
|-------|-------|---------|
| `checkInTime` | `new Date()` | Timestamp of check-in |
| `checkInBy` | "instructor" \| "client" | Who performed check-in |
| `checkInLocation` | string (optional) | Location recorded during check-in |
| `checkInPhoto` | string (optional) | Photo/receipt of check-in |
| `smsCheckInSent` | true | Flag indicating SMS was triggered |
| `notes` | Appended metadata | Late check-in reason logged here if applicable |
| `status` | "COMPLETED" (conditional) | Auto-set if booking end time has passed |

### SMS Notification

- **Recipient**: The other party (if instructor checked in, notify client; vice versa)
- **Message**: `"{checkedInName} has checked in for your lesson. Lesson started at {checkInTime}."`
- **Non-blocking**: SMS failure does not fail the check-in request
- **Logging**: Errors logged to console but not returned to client

### Authentication Methods

1. **Web (NextAuth)**: Session-based, via `getServerSession(authOptions)`
2. **Mobile (JWT)**: Bearer token in `Authorization` header
   - Token structure: `{ userId, role, instructorId }`
   - Verified against `process.env.NEXTAUTH_SECRET`

---

## Frontend Implementation (✅ COMPLETE)

### Web Dashboard (Instructor)

**Location**: `app/dashboard/bookings/page.tsx`

**Features**:
- ✅ "Check In" button for CONFIRMED bookings without checkInTime
- ✅ "Check Out" button for bookings with checkInTime but no checkOutTime
- ✅ Both buttons appear in:
  - Compact view (quick action bar in booking list)
  - Expanded view (full booking details)
- ✅ Confirmation dialog before check-in/check-out
- ✅ Toast notification (success/error)
- ✅ Auto-refresh bookings list after action completes

**Handlers**:
```typescript
const handleCheckIn = async (id: string) => {
  if (!confirm('Start this lesson now?')) return
  
  const res = await fetch(`/api/bookings/${id}/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: 'Web check-in' })
  })
  
  if (res.ok) {
    showToast('success', 'Checked in successfully.')
    fetchBookings() // Refresh
  }
}

const handleCheckOut = async (id: string) => {
  if (!confirm('End this lesson now?')) return
  
  const res = await fetch(`/api/bookings/${id}/check-out`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: 'Web check-out' })
  })
  
  if (res.ok) {
    showToast('success', 'Checked out successfully.')
    fetchBookings()
  }
}
```

### Mobile App (React Native)

**Locations**: 
- `mobile/screens/BookingDetailScreen.tsx` (detailed booking view)
- `mobile/screens/BookingsScreen.tsx` (booking list view)
- `drivebook-hybrid/mobile/screens/BookingDetailScreen.tsx` (hybrid variant)

**Features**:
- ✅ "✓ Check In" button (green) for CONFIRMED bookings
- ✅ "✓ Check Out" button (blue) for checked-in bookings
- ✅ Geolocation capture during check-in/check-out (prompts for location permission)
- ✅ Alert dialog confirmation before action
- ✅ Loading indicator while request in progress
- ✅ Toast notification (success/error)
- ✅ Real-time status display (shows checkInTime, checkOutTime, duration)

**Handlers** (BookingDetailScreen.tsx):
```typescript
const handleCheckIn = async () => {
  Alert.alert('Check In', 'Start this lesson now?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Check In',
      onPress: async () => {
        setActionLoading(true)
        try {
          const location = await getCurrentLocation() // Geolocation capture
          await bookingAPI.checkIn(bookingId, { location })
          Alert.alert('Success', 'Checked in successfully!')
          loadBooking() // Refresh
        } catch (error: any) {
          Alert.alert('Error', error.response?.data?.error || 'Check-in failed')
        } finally {
          setActionLoading(false)
        }
      }
    }
  ])
}

const handleCheckOut = async () => {
  // Similar structure to handleCheckIn
  // Calculates and displays actualDuration after checkout
}
```

**Mobile API Service** (`mobile/services/api.ts`):
```typescript
bookings: {
  checkIn: (id: string, data: { location: string; photo?: string }) =>
    api.post(`/api/bookings/${id}/check-in`, data),
  checkOut: (id: string, data: { location: string; photo?: string }) =>
    api.post(`/api/bookings/${id}/check-out`, data),
}
```

**Status Display on Mobile**:
- If `checkInTime` exists: Shows "Checked In: HH:MM AM/PM"
- If `checkOutTime` exists: Shows "Checked Out: HH:MM AM/PM"
- If both exist: Displays "Actual Duration: X minutes"

---

## API Endpoints (✅ COMPLETE)

### 1. Photo Verification (Optional Biometric)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Capability** | Allow instructor/client to submit photo during check-in | Prevent proxy check-ins (someone checking in on behalf of actual participant) |
| **Validation** | Store photo in Cloudinary. Admin can flag suspicious check-ins for manual review | Biometric verification (face recognition) can be added later |
| **UI Flow** | Optional prompt: "Take a photo to confirm your identity" | Low friction—optional but encouraged |
| **Effort** | Medium (integrate Cloudinary upload, add UI prompt) | ~2-3 hours |

### 2. Geolocation Validation (Optional Location Tracking)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Capability** | Optionally require check-in within X miles of booking location (if location is set) | Ensure instructor/client are physically present |
| **Implementation** | Accept `location` in request body. Compare against booking location using haversine formula | Prevents remote check-ins for in-person lessons |
| **User Consent** | Request location permission from browser/mobile app | Privacy-aware; optional feature |
| **Effort** | Medium (~3-4 hours for geofencing logic + error handling) | Deferred until location field is populated in bookings |

### 3. Dispute Context for Refunds

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current Gap** | Check-in data is recorded but not linked to refund disputes | If a client claims lesson didn't happen, no-show check-in is proof of attendance |
| **Enhancement** | Link check-in metadata to disputes. Auto-close disputes with proof of check-in | Reduces false dispute claims |
| **Effort** | Low (~1 hour: add checkInTime reference in dispute lookup queries) | Requires disputes feature to be complete first |

### 4. Attendance Analytics

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Dashboard** | Add "Attendance Rate" metric: `(checkInCount / totalBookings) * 100` | Help instructors and admin identify patterns |
| **Alert Threshold** | If attendance rate drops below 80% in a week, send email alert | Identify chronic no-shows early |
| **Admin Reporting** | Group by instructor, time of day, day of week | Spot seasonal/systemic issues |
| **Effort** | Low-Medium (~2-3 hours for dashboard widgets + cron job) | Deferred |

### 5. Check-In Integration with Messaging

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current** | One-way SMS notification to other party | Limited engagement |
| **Enhancement** | After check-in, prompt: "How is the lesson going? 😊 (Quick 1-5 star rating)" | Real-time feedback loop |
| **Implementation** | Trigger SMS with opt-in link to quick survey | Inbound SMS responses to be analyzed by admin |
| **Effort** | Medium (~3-4 hours for SMS survey logic) | Deferred |

### 6. Scheduled Auto-Check-In (For Recurring Bookings)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Limitation** | Currently requires manual check-in for every booking | Friction for recurring lessons |
| **Enhancement** | Allow instructor to opt-in: "Auto-check-in for recurring bookings if I'm logged in before start time" | Streamline recurring lesson flow |
| **Safety** | Still requires manual confirmation if > 24 hours late | Prevents fraud |
| **Effort** | Medium (~4-5 hours for cron job + user preference table) | Deferred |

### 7. Late Check-In Penalties (Optional Future)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current** | Late check-ins are logged but have no consequence | No incentive for on-time attendance |
| **Enhancement** | If instructor consistently checks in > 15 min late, trigger warning email after 3 incidents/month | Encourage punctuality |
| **Implementation** | Cron job to flag patterns. Manual review before sending warning | Avoids false positives |
| **Effort** | Medium (~3-4 hours for pattern detection cron + email) | Deferred—requires admin review first |

---

## Implementation Checklist

- [x] Core check-in endpoint with time validation
- [x] Check-out endpoint with duration tracking
- [x] Authorization (instructor/client ownership checks)
- [x] Idempotency guard (prevent double check-in/check-out)
- [x] Fraud prevention (15 min early / 24 hour late blocks)
- [x] Late check-in reason + acknowledgment requirement
- [x] SMS notifications to other party
- [x] Rate limiting for booking actions
- [x] Auto-completion if booking end time passed
- [x] **Web Dashboard UI** (check-in/check-out buttons + confirmation)
- [x] **Mobile App UI** (React Native check-in/check-out with geolocation)
- [x] **Mobile API Integration** (API service calls from both mobile apps)
- [x] **Status Display** (shows check-in time, check-out time, duration)
- [x] **Geolocation Capture** (mobile app prompts for location during check-in/out)
- [x] **Toast Notifications** (success/error feedback to user)
- [ ] Photo verification (optional, Phase 2)
- [ ] Geofencing validation (optional, Phase 2)
- [ ] Dispute context linking (optional, Phase 2)
- [ ] Attendance analytics dashboard (optional, Phase 2)
- [ ] SMS survey integration (optional, Phase 3)
- [ ] Auto-check-in for recurring bookings (optional, Phase 3)
- [ ] Late check-in penalties (optional, Phase 3)

---

## Related Features

- **Booking Cancellation**: `/api/bookings/[id]/cancel` — Check-in prevents refunds (proof of attendance)
- **Disputes**: `DISPUTES_AND_CHARGEBACKS.md` — Check-in proof defends against false claims
- **Notifications**: CRON_JOBS.md — SMS and email sending via notification queue

---

## Database Schema (Fields Used)

```prisma
model Booking {
  // ... existing fields

  checkInTime        DateTime?       // When the check-in was recorded
  checkInBy          String?         // "instructor" | "client"
  checkInLocation    String?         // Location recorded during check-in
  checkInPhoto       String?         // URL to photo uploaded during check-in
  smsCheckInSent     Boolean         @default(false)  // Flag for SMS sent
}
```

---

## Testing Recommendations

### Happy Path
- ✅ Check in 10 minutes before start time → Success
- ✅ Check in at start time → Success
- ✅ Check in 30 minutes after start + reason → Success
- ✅ Second check-in attempt on same booking → 400 (already checked in)

### Fraud Prevention
- ✅ Check in 30 minutes before start → 400 (too early)
- ✅ Check in 48 hours after start → 400 (too late, requires support)
- ✅ Check in 30 minutes late without reason → 400 (requires reason)
- ✅ Check in with short reason (< 10 chars) → 400 (reason too short)

### Authorization
- ✅ Instructor checks in to own booking → Success
- ✅ Instructor checks in to another instructor's booking → 403 (Forbidden)
- ✅ Client checks in to own booking → Success
- ✅ Client checks in to another client's booking → 403 (Forbidden)

### Rate Limiting
- ✅ Multiple check-ins within rate limit window → Success
- ✅ Exceeding rate limit → 429 (Too Many Requests)

---

## Security Considerations

1. **Idempotency**: Use `updateMany` with `checkInTime: null` guard to prevent race conditions
2. **Authorization**: Always verify booking ownership before allowing check-in
3. **Time-based Fraud**: 24-hour cutoff prevents retroactive check-ins
4. **Rate Limiting**: Per-instructor booking action limits prevent abuse
5. **SMS Privacy**: Only send to phone numbers in booking record (no external disclosure)
6. **JWT Validation**: Verify token signature against `NEXTAUTH_SECRET` before accepting mobile requests

---

## Performance Notes

- **Query Optimization**: Single `findUnique` to fetch booking with instructor/client relations
- **Atomic Operation**: Use `$transaction` if adding future features (e.g., instant wallet credit for early check-in bonus)
- **SMS Non-blocking**: Fire-and-forget SMS to avoid latency spike on check-in response
- **Rate Limit Caching**: Rate limit checks are in-memory (Redis or similar) for O(1) lookup

