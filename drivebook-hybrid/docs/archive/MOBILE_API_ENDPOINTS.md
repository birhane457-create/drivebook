# Mobile API Endpoints - Implementation Complete

## Overview
All mobile endpoints are now implemented to support JWT token authentication alongside the existing NextAuth session-based authentication. This allows the mobile app to authenticate using Bearer tokens while the web platform continues to use NextAuth sessions.

## New Authentication Utility
**File**: `lib/mobile-auth.ts`

```typescript
export async function validateMobileToken(req: NextRequest)
```
- Extracts JWT token from `Authorization: Bearer <token>` header
- Validates token signature against `NEXTAUTH_SECRET`
- Returns user details (id, email, role)
- Used as first auth check in all mobile endpoints; falls back to NextAuth for web clients

## Implemented Mobile Endpoints

### 1. Dashboard Endpoint
**URL**: `GET /api/client/dashboard/mobile`
**Authentication**: JWT Bearer Token (mobile) or NextAuth Session (web)
**Returns**:
- `upcomingLessons`: Array of next 10 lessons with instructor, time, location
- `currentInstructor`: Most recent instructor data (name, phone, email, rating, reviews)
- `totalBookings`: Total number of client's bookings
- `totalCredits`: Wallet credits remaining
- `averageRating`: Client's average rating from completed bookings

**Key Features**:
- Fetches last booking to determine current instructor
- Calculates average rating from all client reviews
- Returns upcoming lessons sorted by date

---

### 2. Wallet Endpoint
**URL**: `GET /api/client/wallet/mobile`
**Authentication**: JWT Bearer Token (mobile) or NextAuth Session (web)
**Returns**:
- `balance`: Current wallet balance
- `totalPaid`: Total amount paid into wallet
- `totalSpent`: Total amount spent on bookings
- `creditsRemaining`: Balance minus spent amount
- `totalBookedHours`: Total hours booked across all bookings
- `transactions`: Last 10 transaction records

**Key Features**:
- Auto-creates wallet if it doesn't exist
- Calculates spent amount from confirmed/completed bookings
- Tracks total booked hours for package management

---

### 3. Packages Endpoint
**URL**: 
- `GET /api/client/packages/mobile` - List all packages
- `POST /api/client/packages/mobile` - Purchase a package

**Authentication**: JWT Bearer Token (mobile) or NextAuth Session (web)

**GET Response**:
```json
{
  "packages": [
    {
      "id": "booking-id",
      "purchaseDate": "2024-01-15T10:00:00Z",
      "expiryDate": "2024-04-15T10:00:00Z",
      "hoursTotal": 20,
      "hoursUsed": 5,
      "hoursRemaining": 15,
      "status": "active|expired|completed",
      "instructor": { "id", "name" },
      "canScheduleMore": true
    }
  ],
  "summary": {
    "total": 50,     // total hours across all packages
    "used": 15,      // total hours used
    "remaining": 35, // total hours remaining
    "activeCount": 2,
    "expiring_soon": 1 // expiring within 7 days
  }
}
```

**POST Request**:
```json
{
  "packageId": "instructor-id",
  "paymentMethod": "stripe|manual"
}
```

**POST Response**:
```json
{
  "success": true,
  "bookingId": "new-booking-id",
  "message": "Package purchased successfully"
}
```

**Key Features**:
- GET: Calculates hours used from confirmed/completed child bookings
- GET: Determines package status (active/expired/completed)
- POST: Creates package booking with 90-day expiry
- POST: Sets isPaid based on payment method

---

### 4. Instructors Search Endpoint
**URL**: `GET /api/client/instructors/mobile?location=<address>&specialty=<service>&minRating=<rating>&maxDistance=<km>`
**Authentication**: Optional (can search without auth)
**Query Parameters**:
- `location` (required): Address or suburb to search
- `specialty` (optional): Service name to filter by
- `minRating` (optional): Minimum average rating
- `maxDistance` (optional): Max search radius in km (default: 50)

**Returns**:
```json
{
  "instructors": [
    {
      "id": "instructor-id",
      "name": "John Doe",
      "phone": "+61412345678",
      "bio": "Experienced instructor...",
      "profileImage": "url",
      "hourlyRate": 80,
      "baseAddress": "123 Main St",
      "distance": 3.5,
      "isWithinRadius": true,
      "averageRating": 4.8,
      "totalReviews": 45,
      "isFeatured": true
    }
  ],
  "count": 12,
  "searchLocation": {
    "lat": -31.95224,
    "lng": 115.85835,
    "displayName": "Maylands, WA"
  }
}
```

**Key Features**:
- Geocodes address to coordinates
- Filters by distance and service radius
- Sorts by: featured first, then rating, then distance
- Returns distance in km for each instructor

---

### 5. Pending Reviews Endpoint
**URL**: `GET /api/client/pending-reviews`
**Authentication**: JWT Bearer Token (mobile) or NextAuth Session (web)
**Returns**: Array of completed bookings without reviews

```json
[
  {
    "id": "booking-id",
    "bookingId": "booking-id",
    "instructorName": "John Doe",
    "bookingDate": "2024-01-15T10:00:00Z"
  }
]
```

**Key Features**:
- Supports both mobile JWT and web NextAuth
- Updated to fall back to NextAuth for web clients

---

### 6. Reviews Endpoint
**URL**: 
- `GET /api/reviews?instructorId=<id>` - Get instructor's reviews
- `GET /api/reviews` (no params) - Get current user's reviews
- `POST /api/reviews` - Submit a review

**Authentication**: 
- GET with no params: JWT Bearer (mobile) or NextAuth (web)
- GET with instructorId: Optional (public)
- POST: JWT Bearer (mobile) or NextAuth (web)

**GET Response (user's own reviews)**:
```json
[
  {
    "id": "review-id",
    "instructorName": "John Doe",
    "rating": 5,
    "comment": "Excellent instructor!",
    "date": "2024-01-20T10:00:00Z",
    "bookingDate": "2024-01-15T10:00:00Z"
  }
]
```

**POST Request**:
```json
{
  "bookingId": "booking-id",
  "rating": 5,
  "comment": "Great lesson, highly recommended!"
}
```

**Key Features**:
- Validates booking is completed
- Prevents duplicate reviews for same booking
- Sends email notification to instructor
- Dual auth support: mobile JWT + web NextAuth

---

## Authentication Pattern

All endpoints follow this pattern:

```typescript
// Option 1: Try JWT token first (for mobile)
const auth = await validateMobileToken(req);
if (auth.valid) {
  userId = auth.user?.id;
}

// Option 2: Fall back to NextAuth session (for web)
if (!userId) {
  const session = await getServerSession(authOptions);
  userId = session.user?.id;
}

// Option 3: Return 401 if neither auth method works
if (!userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

## Mobile API Service Integration

All endpoints are called through `mobile/services/api.ts` using:

```typescript
const clientAPI = {
  getDashboard: () => api.get('/api/client/dashboard/mobile'),
  getWallet: () => api.get('/api/client/wallet/mobile'),
  getPackages: () => api.get('/api/client/packages/mobile'),
  purchasePackage: (packageId, paymentMethod) => 
    api.post('/api/client/packages/mobile', { packageId, paymentMethod }),
  searchInstructors: (query) => 
    api.get('/api/client/instructors/mobile', { params: query }),
  getPendingReviews: () => api.get('/api/client/pending-reviews'),
  getCompletedReviews: () => api.get('/api/reviews'),
  submitReview: (bookingId, data) => 
    api.post('/api/reviews', { bookingId, ...data }),
  rescheduleBooking: (bookingId, data) => 
    api.post(`/api/bookings/${bookingId}/reschedule`, data),
  cancelBooking: (bookingId) => 
    api.post(`/api/bookings/${bookingId}/cancel`, {}),
};
```

## Connection Flow

1. **Mobile app authenticates** using `/api/auth/mobile-login`
   - Receives JWT token with 30-day expiry
   - Token includes: userId, email, role, instructorId (if instructor)

2. **Mobile app sends token** with every API request
   - Header: `Authorization: Bearer <token>`
   - Interceptor in api.ts adds token automatically

3. **Backend validates token** using `validateMobileToken()`
   - Verifies JWT signature
   - Checks user still exists in database
   - Returns user info or error

4. **Endpoints handle both mobile + web**
   - Try JWT first (mobile)
   - Fall back to NextAuth session (web)
   - Both return same data format

## Status Summary

✅ All 6 mobile endpoints implemented
✅ JWT authentication utility created  
✅ Dual authentication (mobile JWT + web NextAuth) implemented
✅ Mobile API service methods created
✅ Mobile screens connected to API
✅ Fixed TypeScript compilation errors
✅ Ready for testing

## Next Steps

1. Test mobile authentication flow
2. Verify API token refresh logic
3. Test all CRUD operations on mobile screens
4. Verify error handling for auth failures
5. Test with offline token expiry scenarios
