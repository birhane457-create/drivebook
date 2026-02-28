# Complete Booking Flow Specification

## Overview
A smooth, step-by-step booking flow with consistent button placement under summary sections.

## Complete Flow Structure

### Flow A: Book Now (with scheduling)
1. **Select Instructor** → 2. **Select Package** → 3. **PDA Test (Optional)** → 4. **Book Now/Later** → 5. **Schedule Lessons** → 6. **Register Account** → 7. **Payment** → 8. **Confirmation**

### Flow B: Book Later (no scheduling)
1. **Select Instructor** → 2. **Select Package** → 3. **PDA Test (Optional)** → 4. **Book Now/Later** → 5. **Register Account** → 6. **Payment** → 7. **Confirmation**

---

## Step-by-Step Flow Details

### Step 1: Select Instructor
**Page**: `/book` → `/book/[instructorId]`
**Content**:
- Search by location
- List of available instructors
- Instructor cards with ratings, distance, hourly rate

**Action**: Click "Book Now" on instructor card

---

### Step 2: Select Package
**Page**: `/book/[instructorId]/package`
**Content**:
- Package options (6, 10, 15 hours or custom)
- Pricing with discounts
- Summary showing:
  - Selected instructor
  - Package hours
  - Subtotal
  - Discount
  - Total

**Buttons** (under summary):
- ← Back
- Continue →

**Action**: Select package, click Continue

---

### Step 3: PDA Test Package (Optional)
**Page**: `/book/[instructorId]/test-package`
**Condition**: Only shown if `instructor.offersTestPackage === true`

**Content**:
- PDA test package details
- What's included
- Price
- Summary showing:
  - Instructor
  - Package hours
  - PDA test package (if added)
  - Updated total

**Options**:
- Add PDA Test Package (adds to total)
- Skip (continues without test package)

**Buttons** (under summary):
- ← Back
- Add PDA Test Package →
- Skip →

**Action**: Add or skip, then continue

---

### Step 4: Book Now or Later
**Page**: `/book/[instructorId]/book-type`
**Content**:
- Two options:
  1. **Book Now**: Schedule lessons immediately
  2. **Book Later**: Schedule from dashboard after payment

**Summary shows**:
- Instructor
- Package hours
- PDA test (if added)
- Total price

**Buttons** (under summary):
- ← Back
- Book Now →
- Book Later →

**Action**: Choose booking type

---

### Step 5A: Schedule Lessons (if Book Now)
**Page**: `/book/[instructorId]/booking-details`
**Content**:
- Title: "Schedule Your Lessons"
- Calendar date picker
- Time slot selector (shows available times)
- Duration selector
- Pickup location input
- Notes textarea
- List of scheduled lessons
- Remaining hours counter

**Summary shows**:
- Instructor
- Package details
- Scheduled lessons (count)
- Remaining hours
- Total price

**Buttons** (under summary):
- ← Back
- Continue to Registration →

**Validation**: Must schedule at least 1 lesson

---

### Step 5B: Skip to Registration (if Book Later)
Goes directly to Step 6

---

### Step 6: Create Account / Register
**Page**: `/book/[instructorId]/registration`
**Content**:
- Title: "Create Your Account"
- Subtitle: "Register to manage your bookings and track your progress"

**Form Fields**:
- Registration type: Myself / Someone Else
- Account holder name
- Email
- Phone
- Password
- Confirm password
- (If someone else) Learner name, phone, relationship

**Summary shows**:
- Instructor
- Package hours
- PDA test (if added)
- Scheduled lessons (if Book Now)
- Total price

**Buttons** (under summary):
- ← Back
- Continue to Payment →

**Validation**: All required fields, password match, valid email

---

### Step 7: Payment
**Page**: `/book/[instructorId]/payment`
**Content**:
- Title: "Complete Payment"
- Subtitle: "Secure payment to confirm your booking"

**Summary shows**:
- Instructor details
- Package hours
- PDA test (if added)
- Discount breakdown
- Scheduled lessons (if Book Now)
- Registration details
- Price breakdown:
  - Subtotal
  - Discount
  - PDA test package
  - Platform fee
  - **Total**

**Payment Form**:
- Card details (Stripe Elements)
- Billing information

**Buttons** (under summary):
- Pay $XXX.XX

**Back button** (separate, below):
- ← Back to Registration

**States**:
- Loading: "Processing Payment..."
- Success: "Payment Successful! Redirecting..."
- Error: Shows error message, stays on page

---

### Step 8: Confirmation
**Page**: `/booking/[id]/confirmation`
**Content**:
- Success icon
- "Booking Confirmed!"
- Booking reference ID
- What's next:
  1. Check email
  2. Access dashboard
  3. Contact instructor

**Buttons**:
- Go to Dashboard
- Back to Home

---

## PDA Test Package Integration

### When to Show
- Only if `instructor.offersTestPackage === true`
- Shown after package selection (Step 3)

### What It Includes
- Test package price from `instructor.testPackagePrice`
- Duration from `instructor.testPackageDuration`
- Includes list from `instructor.testPackageIncludes`

### Pricing Calculation
```typescript
// If PDA test added
pricing.testPackage = instructor.testPackagePrice || 0;
pricing.total = pricing.subtotal - pricing.discount + pricing.testPackage + pricing.platformFee;

// If PDA test skipped
pricing.testPackage = 0;
pricing.total = pricing.subtotal - pricing.discount + pricing.platformFee;
```

### In Booking Context
```typescript
interface BookingState {
  includeTestPackage: boolean;  // true if added, false if skipped
  pricing: {
    testPackage: number;  // 0 if skipped, price if added
    // ... other pricing fields
  }
}
```

### Display in Summary
```tsx
{bookingState.includeTestPackage && (
  <div className="flex justify-between text-sm">
    <span className="text-gray-600">PDA Test Package</span>
    <span>${bookingState.pricing.testPackage.toFixed(2)}</span>
  </div>
)}
```

---

## Button Placement Standard

### All Pages Follow This Pattern:
```tsx
<div className="max-w-3xl mx-auto">
  {/* Page Content */}
  <div className="bg-white rounded-lg shadow-md p-6">
    {/* Form or selection content */}
  </div>

  {/* Summary Section */}
  <div className="bg-white rounded-lg shadow-md p-6 mt-6">
    <h3>Booking Summary</h3>
    {/* Summary details */}
    
    {/* Buttons ALWAYS at bottom of summary */}
    <BookingFlowButtons
      onBack={() => router.back()}
      onContinue={handleContinue}
      continueLabel="Continue →"
    />
  </div>
</div>
```

---

## Step Numbers

### Book Now Flow:
1. Instructor
2. Package
3. PDA Test (if offered)
4. Book Now/Later
5. Schedule Lessons
6. Registration
7. Payment
8. Confirmation

### Book Later Flow:
1. Instructor
2. Package
3. PDA Test (if offered)
4. Book Now/Later
5. Registration
6. Payment
7. Confirmation

---

## Data Flow

### BookingContext State:
```typescript
{
  instructor: Instructor | null,
  packageType: PackageType,
  hours: number,
  includeTestPackage: boolean,  // ✅ PDA test flag
  bookingType: 'now' | 'later',
  scheduledBookings: ScheduledBooking[],
  remainingHours: number,
  registrationType: 'myself' | 'someone-else',
  accountHolderName: string,
  accountHolderEmail: string,
  accountHolderPhone: string,
  accountHolderPassword: string,
  learnerName?: string,
  learnerPhone?: string,
  learnerRelationship?: string,
  pricing: {
    subtotal: number,
    discount: number,
    discountPercentage: number,
    testPackage: number,  // ✅ PDA test price
    platformFee: number,
    total: number
  }
}
```

---

## Email Notifications

### After Payment Success (via Webhook):
1. **Client Email**:
   - Booking confirmed
   - Package details
   - PDA test (if included)
   - Scheduled lessons (if Book Now)
   - Instructor contact
   - Dashboard link

2. **Instructor Email**:
   - New booking notification
   - Client details
   - Package details
   - PDA test (if included)
   - Revenue breakdown
   - Dashboard link

---

## Validation Rules

### Package Selection:
- Must select a package type
- Hours must be > 0

### PDA Test:
- Optional (can skip)
- If added, price must be valid

### Book Now:
- Must schedule at least 1 lesson
- All lessons must have valid date, time, location

### Registration:
- All fields required
- Email must be valid format
- Password min 6 characters
- Passwords must match
- If someone-else: learner name and relationship required

### Payment:
- Card details required
- Must pass Stripe validation

---

## Success Criteria

✅ Smooth flow from start to finish
✅ All buttons under summary sections
✅ PDA test optional and properly calculated
✅ Clear step progression
✅ Consistent styling
✅ Proper validation at each step
✅ Success/error messages
✅ Email notifications after payment
✅ Booking confirmation with reference ID

---

## Current Status

✅ Payment flow working
✅ Button styling consistent
✅ Redirect issues fixed
✅ Email timing correct (after payment)

**Next**: Verify PDA test package flow is complete and properly integrated
