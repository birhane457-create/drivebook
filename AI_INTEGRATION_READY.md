# AI Voice Integration - Ready for Implementation

## Status: Documentation Complete ✅

All architectural improvements from user feedback have been documented and the OpenAPI spec has been updated for optimal LLM understanding.

---

## What Was Updated

### 1. BACKEND_FEATURES_NEEDED.md - Complete Rewrite ✅

**Old Architecture (Removed):**
- Separate slot reservation table
- Payment links (PaymentIntent)
- Complex 10-minute hold system

**New Architecture (Implemented):**
- Booking status: PENDING_PAYMENT → CONFIRMED → EXPIRED
- Stripe Checkout Session (not payment links)
- Webhook endpoint for payment confirmation
- Booking expiry via cron job
- Slot hold via booking status (no separate table)

**New Implementation Plan:**

**Phase 1 (Critical - 5.5 hours):**
1. Booking status & expiry (30 min)
2. Stripe Checkout Session (1.5h)
3. Payment webhook (1h)
4. SMS & Email notifications (1.5h)
5. Booking expiry cron (1h)

**Phase 2 (Important - 1 hour):**
6. Booking lookup by phone (30 min)
7. Instructor lookup by name/phone (30 min)

**Total: 6.5 hours** (down from 10 hours)

---

### 2. openapi.yaml - Enhanced for LLM Understanding ✅

**Added Endpoints:**
- `/bookings/lookup` - Find bookings by phone number
- `/instructors/lookup` - Find instructor by name/phone (optional)

**Improved Descriptions:**

**Before:**
```yaml
summary: Create booking with package
description: Creates a new booking
```

**After:**
```yaml
summary: Create booking with package (PENDING_PAYMENT status)
description: |
  Creates a new booking with PENDING_PAYMENT status. Booking expires in 10 minutes if payment not completed.
  Backend auto-generates password if not provided and will send via SMS/email.
  Returns bookingId and Stripe Checkout URL. AI should tell user: "I'm holding your time slot for 10 minutes while you complete payment".
  
  BOOKING STATUS FLOW:
  1. Booking created → status: PENDING_PAYMENT, expiresAt: now + 10 minutes
  2. Payment completed → status: CONFIRMED, expiresAt: null
  3. Payment not completed → status: EXPIRED (auto-updated by cron job)
  
  TIME SLOT HOLD:
  - Slot is reserved while booking status is PENDING_PAYMENT or CONFIRMED
  - Expired bookings release the slot automatically
```

**Key Improvements:**
- Explicit status flow documentation
- Natural language examples for AI
- Clear explanation of time slot hold mechanism
- Booking expiry behavior documented
- Response schema includes status and expiresAt fields

---

### 3. packages/route.ts - Added "Most Popular" Badge ✅

**Before:**
```typescript
{
  type: 'PACKAGE_10',
  popular: true,
  description: 'Most popular - best value'
}
```

**After:**
```typescript
{
  type: 'PACKAGE_10',
  popular: true,
  badge: 'Most Popular',  // ← NEW
  description: 'Most popular - best value'
}
```

**OpenAPI Updated:**
```yaml
description: |
  The 10-hour package has badge: "Most Popular" - AI should mention this naturally: 
  "Most students choose the 10-hour package - it saves you $75".
  EXAMPLE: "I recommend the 10-hour package - it's our most popular and saves you $75. Would that work for you?"
```

---

## Architecture Improvements Summary

### Before (Complex)
```
User selects slot
  ↓
Create SlotReservation (separate table)
  ↓
Generate PaymentIntent
  ↓
Send payment link
  ↓
Cron job expires reservations
  ↓
Create Booking after payment
```

### After (Simple)
```
User selects slot
  ↓
Create Booking (status: PENDING_PAYMENT, expiresAt: +10min)
  ↓
Create Stripe Checkout Session (metadata: bookingId)
  ↓
Send checkout URL via SMS/Email
  ↓
Webhook: checkout.session.completed
  ↓
Update Booking (status: CONFIRMED, expiresAt: null)
  ↓
Cron job: Expire unpaid bookings
```

**Benefits:**
- One table instead of two (Booking only, no SlotReservation)
- Cleaner webhook integration (bookingId in metadata)
- Automatic expiry via booking status
- Simpler availability checking (just filter by status)

---

## OpenAPI Spec Improvements for LLM

### 1. Explicit Status Flow
Every endpoint now documents the booking lifecycle clearly.

### 2. Natural Language Examples
```yaml
description: |
  AI should tell user: "I'm holding your time slot for 10 minutes while you complete payment"
  EXAMPLE: "I recommend the 10-hour package - it's our most popular and saves you $75"
```

### 3. Clear Field Descriptions
```yaml
expiresAt:
  type: string
  format: date-time
  description: When the booking will expire if not paid (10 minutes from creation)
```

### 4. Endpoint Purpose
```yaml
/bookings/lookup:
  description: |
    Returns all active bookings for a phone number.
    AI can use this when user says "I need to change my lesson" or "Cancel my booking".
```

### 5. Optional vs Required
```yaml
/instructors/lookup:
  description: |
    This is OPTIONAL - most users won't know instructor name, so use recommendations by default.
```

---

## What's Next

### For Backend Implementation:

1. **Update Prisma Schema:**
```prisma
model Booking {
  status    String   @default("PENDING_PAYMENT")
  expiresAt DateTime?
  // ... rest of fields
}
```

2. **Create Endpoints:**
- `/api/payments/webhook` - Stripe webhook handler
- `/api/cron/expire-bookings` - Booking expiry cron
- `/api/bookings/lookup` - Lookup by phone
- `/api/instructors/lookup` - Lookup by name/phone

3. **Update Existing:**
- `/api/public/bookings/bulk` - Add Stripe Checkout Session
- `/api/availability/slots` - Filter by booking status

4. **Setup Services:**
- Twilio SMS service
- Email templates for password + checkout link
- Vercel cron job configuration

### For AI Agent Configuration:

1. **Import Updated OpenAPI Spec:**
   - Use `drivebook/openapi.yaml`
   - Point to `https://drivebook.com.au/api`

2. **Configure Conversation Flow:**
   - Use `COPILOT_STUDIO_INTEGRATION.md` as guide
   - Flexible approach (not strict form-filling)
   - Top 3 recommendations only
   - Natural upsell with savings
   - 10-minute hold messaging

3. **Test Scenarios:**
   - User with preferred instructor
   - User without instructor preference
   - Package selection with upsell
   - Payment flow with expiry
   - Booking lookup for rescheduling

---

## Files Modified

1. ✅ `drivebook/BACKEND_FEATURES_NEEDED.md` - Complete rewrite with new architecture
2. ✅ `drivebook/openapi.yaml` - Added endpoints, improved descriptions, added status fields
3. ✅ `drivebook/app/api/packages/route.ts` - Added "Most Popular" badge
4. ✅ `drivebook/AI_INTEGRATION_READY.md` - This summary document

---

## Key Architectural Decisions

### 1. Booking Status Instead of Reservation Table
**Reason:** Simpler, fewer tables, easier to maintain
**Impact:** Reduces implementation time from 10h to 6.5h

### 2. Stripe Checkout Session Instead of Payment Links
**Reason:** Better metadata support, cleaner webhook integration
**Impact:** Easier to track bookingId through payment flow

### 3. Cron Job for Expiry
**Reason:** Automatic cleanup, no manual intervention needed
**Impact:** Reliable slot release, prevents double booking

### 4. Status-Based Availability
**Reason:** Single source of truth for slot availability
**Impact:** Simpler queries, no complex joins

---

## Estimated Timeline

### Phase 1 (Production Ready)
- **Time:** 5.5 hours
- **Deliverables:**
  - Booking status & expiry
  - Stripe Checkout integration
  - Payment webhook
  - SMS/Email notifications
  - Booking expiry cron

### Phase 2 (Enhanced Features)
- **Time:** 1 hour
- **Deliverables:**
  - Booking lookup
  - Instructor lookup

### Total: 6.5 hours to production-ready AI booking system

---

## Success Criteria

### Backend
- [ ] Bookings created with PENDING_PAYMENT status
- [ ] Stripe Checkout Session generated
- [ ] SMS/Email sent with password and checkout link
- [ ] Payment webhook updates booking to CONFIRMED
- [ ] Cron job expires unpaid bookings
- [ ] Availability endpoint respects booking status

### AI Agent
- [ ] Can find instructors by location
- [ ] Presents top 3 recommendations with reasons
- [ ] Mentions "Most Popular" for 10-hour package
- [ ] Explains 10-minute hold naturally
- [ ] Handles payment flow smoothly
- [ ] Can lookup bookings by phone

---

## Notes

### Password Handling
- Auto-generated if not provided (for AI bookings)
- Sent via SMS and email
- User should change after first login
- Hashed with bcrypt before storage

### Payment Flow
- 10-minute expiry on Checkout Session
- Booking expires if payment not completed
- Webhook confirms payment automatically
- No manual intervention needed

### Conversation Flow
- Flexible, not strict
- Top 3 recommendations only
- Natural upsell with savings
- Combined questions where possible
- Accept natural language dates/times

---

## Ready for Implementation ✅

All documentation is complete and aligned with the user's architectural feedback. The system is designed to be:

1. **Simple** - One booking table, status-based flow
2. **Reliable** - Automatic expiry, webhook confirmation
3. **User-Friendly** - Natural conversation, clear messaging
4. **Production-Ready** - 6.5 hours to full implementation

Next step: Begin Phase 1 implementation following `BACKEND_FEATURES_NEEDED.md`.
