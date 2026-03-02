# Client Dashboard - Missing Features Analysis

## Overview
Inspection of the client dashboard reveals several features that are partially implemented or not connected properly.

## Issues Found

### 1. Main Dashboard Page (`app/client-dashboard/page.tsx`)

#### ❌ Reschedule Button Not Connected
**Location:** Lines 485-491 (Upcoming Bookings section)
**Issue:** Button exists but doesn't open the RescheduleModal
**Current Code:**
```typescript
<button className="px-3 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition text-sm font-semibold flex items-center gap-1">
  <Edit2 className="w-4 h-4" />
  Reschedule
</button>
```
**Fix Needed:** Add onClick handler to open RescheduleModal with booking details

#### ❌ Cancel Button Not Connected
**Location:** Lines 492-496 (Upcoming Bookings section)
**Issue:** Button exists but doesn't open the CancelDialog
**Current Code:**
```typescript
<button className="px-3 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition text-sm font-semibold">
  Cancel
</button>
```
**Fix Needed:** Add onClick handler to open CancelDialog with booking details

#### ❌ Leave Review Button Not Connected
**Location:** Lines 534-537 (Past Bookings section)
**Issue:** Button exists but doesn't open review form/modal
**Current Code:**
```typescript
<button className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition font-semibold flex items-center gap-1">
  <Star className="w-4 h-4" />
  Leave Review
</button>
```
**Fix Needed:** Create ReviewModal component and connect button

#### ⚠️ Unused State Variables
**Issue:** Several state variables are declared but never used
- `selectedBooking` and `setSelectedBooking`
- `showBookingDetails` and `setShowBookingDetails`
**Fix:** Either use them or remove them

### 2. Separate Bookings Page (`app/client-dashboard/bookings/page.tsx`)

#### ✅ WORKING - Reschedule Button
**Status:** Properly connected to RescheduleModal with all required props

#### ✅ WORKING - Cancel Button
**Status:** Properly connected to CancelDialog with all required props

### 3. Missing Components

#### ❌ ReviewModal Component
**Status:** Does NOT exist in web version
**Location:** Should be at `components/ReviewModal.tsx`
**Note:** Mobile version exists at `mobile/components/ReviewModal.tsx`
**Fix Needed:** Create web version of ReviewModal

### 4. API Endpoints Status

#### ✅ Current Instructor API
**Endpoint:** `/api/client/current-instructor`
**Status:** EXISTS and working
**Location:** `app/api/client/current-instructor/route.ts`

#### ✅ Profile API
**Endpoint:** `/api/client/profile`
**Status:** EXISTS and working

#### ✅ Wallet API
**Endpoint:** `/api/client/wallet`
**Status:** EXISTS and working

#### ✅ Reschedule API
**Endpoint:** `/api/bookings/[id]/reschedule`
**Status:** EXISTS and working (recently fixed)

#### ✅ Cancel API
**Endpoint:** `/api/bookings/[id]/cancel`
**Status:** EXISTS and working (recently fixed)

#### ❌ Reviews API (for clients)
**Endpoint:** `/api/reviews` (POST)
**Status:** EXISTS but may need client-specific logic
**Location:** `app/api/reviews/route.ts`
**Note:** Need to verify it works for client submissions

## Summary of Required Fixes

### Priority 1: Connect Existing Buttons (Main Dashboard)

1. **Import Required Components**
   ```typescript
   import RescheduleModal from '@/components/RescheduleModal';
   import CancelDialog from '@/components/CancelDialog';
   ```

2. **Add State for Modals**
   ```typescript
   const [rescheduleModal, setRescheduleModal] = useState<{
     isOpen: boolean;
     bookingId: string;
     instructorId: string;
     date: string;
     time: string;
     duration: number;
     price: number;
     instructor: string;
     hourlyRate: number;
   } | null>(null);
   
   const [cancelDialog, setCancelDialog] = useState<{
     isOpen: boolean;
     bookingId: string;
     date: string;
     instructor: string;
     price: number;
   } | null>(null);
   ```

3. **Connect Reschedule Button**
   ```typescript
   <button
     onClick={() => setRescheduleModal({
       isOpen: true,
       bookingId: booking.id,
       instructorId: booking.instructor.id, // NEED TO ADD THIS TO BOOKING DATA
       date: booking.date,
       time: booking.time,
       duration: booking.duration * 60, // Convert hours to minutes
       price: booking.price,
       instructor: booking.instructor.name,
       hourlyRate: booking.instructor.hourlyRate // NEED TO ADD THIS TO BOOKING DATA
     })}
     className="..."
   >
     <Edit2 className="w-4 h-4" />
     Reschedule
   </button>
   ```

4. **Connect Cancel Button**
   ```typescript
   <button
     onClick={() => setCancelDialog({
       isOpen: true,
       bookingId: booking.id,
       date: booking.date,
       instructor: booking.instructor.name,
       price: booking.price
     })}
     className="..."
   >
     Cancel
   </button>
   ```

5. **Add Modal Components at Bottom**
   ```typescript
   {/* Reschedule Modal */}
   {rescheduleModal && (
     <RescheduleModal
       isOpen={rescheduleModal.isOpen}
       onClose={() => setRescheduleModal(null)}
       bookingId={rescheduleModal.bookingId}
       instructorId={rescheduleModal.instructorId}
       currentDate={rescheduleModal.date}
       currentTime={rescheduleModal.time}
       currentDuration={rescheduleModal.duration}
       currentPrice={rescheduleModal.price}
       instructorName={rescheduleModal.instructor}
       instructorHourlyRate={rescheduleModal.hourlyRate}
       onSuccess={loadData}
     />
   )}

   {/* Cancel Dialog */}
   {cancelDialog && (
     <CancelDialog
       isOpen={cancelDialog.isOpen}
       onClose={() => setCancelDialog(null)}
       bookingId={cancelDialog.bookingId}
       instructorName={cancelDialog.instructor}
       bookingDate={cancelDialog.date}
       bookingPrice={cancelDialog.price}
       onSuccess={loadData}
     />
   )}
   ```

### Priority 2: Fix Booking Data Structure

**Issue:** The booking data from `/api/client/profile` doesn't include:
- `instructor.id` (needed for RescheduleModal)
- `instructor.hourlyRate` (needed for RescheduleModal)

**Fix:** Update `/api/client/profile/route.ts` to include these fields:
```typescript
instructor: {
  select: {
    id: true,  // ADD THIS
    name: true,
    profileImage: true,
    hourlyRate: true  // ADD THIS
  }
}
```

### Priority 3: Create ReviewModal Component

**File:** `components/ReviewModal.tsx`
**Based on:** `mobile/components/ReviewModal.tsx`

**Features Needed:**
- Rating selector (1-5 stars)
- Comment textarea
- Submit button
- Success/error handling
- Auto-close after success

**API Endpoint:** `POST /api/reviews`
**Required Data:**
```typescript
{
  bookingId: string;
  rating: number;
  comment: string;
}
```

### Priority 4: Connect Review Button

**Location:** Main dashboard page, past bookings section

```typescript
const [reviewModal, setReviewModal] = useState<{
  isOpen: boolean;
  bookingId: string;
  instructorName: string;
} | null>(null);

// Button
<button
  onClick={() => setReviewModal({
    isOpen: true,
    bookingId: booking.id,
    instructorName: booking.instructor.name
  })}
  className="..."
>
  <Star className="w-4 h-4" />
  Leave Review
</button>

// Modal
{reviewModal && (
  <ReviewModal
    isOpen={reviewModal.isOpen}
    onClose={() => setReviewModal(null)}
    bookingId={reviewModal.bookingId}
    instructorName={reviewModal.instructorName}
    onSuccess={loadData}
  />
)}
```

## Files That Need Changes

1. ✏️ `app/client-dashboard/page.tsx` - Connect buttons, add modals
2. ✏️ `app/api/client/profile/route.ts` - Add instructor.id and hourlyRate
3. ➕ `components/ReviewModal.tsx` - Create new component
4. ✅ `components/RescheduleModal.tsx` - Already working
5. ✅ `components/CancelDialog.tsx` - Already working

## Testing Checklist

After fixes:
- [ ] Reschedule button opens modal on main dashboard
- [ ] Cancel button opens dialog on main dashboard
- [ ] Review button opens modal on main dashboard
- [ ] All modals close properly
- [ ] Data refreshes after successful actions
- [ ] No console errors
- [ ] Mobile responsive

## Notes

- The separate bookings page (`/client-dashboard/bookings`) already has working reschedule and cancel functionality
- The main dashboard page is meant to be a quick overview, so it makes sense to have the same functionality there
- Consider whether to keep both pages or consolidate them
- The mobile app has a ReviewModal that can be adapted for web

## Comparison: Main Dashboard vs Bookings Page

### Main Dashboard (`/client-dashboard`)
- ❌ Reschedule button not connected
- ❌ Cancel button not connected
- ❌ Review button not connected
- Shows bookings in tabs (bookings/wallet/history)
- Shows current instructor card
- Shows wallet stats

### Bookings Page (`/client-dashboard/bookings`)
- ✅ Reschedule button fully working
- ✅ Cancel button fully working
- ❌ Review button not present
- Dedicated bookings view with filters
- More detailed booking cards
- Better for managing multiple bookings

### Recommendation
Keep both pages but ensure feature parity:
1. Fix main dashboard buttons (Priority 1)
2. Add review functionality to both pages (Priority 3)
3. Consider making main dashboard a true "overview" with links to detailed pages
