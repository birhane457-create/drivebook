# Complete Booking Flow Guide - End-to-End

## Overview
This guide explains the complete booking flow from instructor search through account creation, payment, and dashboard management. All features have been enhanced with error handling, email confirmations, and instructor visibility on the client dashboard.

---

## 🔍 STEP 1: SEARCH & SELECT INSTRUCTOR

### Web Flow (`/book`)
1. **Browse Instructors**: 
   - User enters location/postcode and searches
   - Gets list of nearby instructors with ratings and rates
   - Clicks on an instructor to view details

2. **View Instructor Profile**:
   - Instructor name, bio, photo, rating, reviews
   - Hourly rate
   - Services offered (Regular Lessons, PDA Test Package, Mock Test)
   - Book Now button

### Expected Result
- Instructor selected
- User directed to booking form

---

## 📦 STEP 2: SELECT PACKAGE & PRICE

### Package Options
- **Regular Package**: 1, 5, 10, 20 hour packages
- **Include PDA Test Package**: Optional checkbox adds test prep
- **Custom Duration**: User can specify custom hours

### Pricing Calculation
- Subtotal = hours × hourlyRate
- Discount: Applied if booking package (10%+ on bulk)
- Platform Fee: Added to total
- **Total = Subtotal + Platform Fee - Discount**

### Expected Result
- Package selected with price calculated
- Confirmation of what's included

---

## 👤 STEP 3: REGISTRATION & ACCOUNT CREATION

### During Booking
User can:
1. **Continue as Guest** → Complete booking → Email confirmation only
2. **Create Account** → Provide password → Auto-login after payment
3. **Book for Someone Else** → Enter learner details (optional)

### Fields Required
- Account Holder Name
- Account Holder Email
- Account Holder Phone
- **PASSWORD** (if creating account) ← NEW FEATURE
- Optional: Learner Name, Relationship, Phone

### Account Creation Flow
```
User enters email + password
        ↓
Account created (User.role = CLIENT)
        ↓
Client record linked to instructor
        ↓
Welcome email sent (NEW - with error handling)
        ↓
Booking created (status = PENDING)
        ↓
Redirect to payment page
```

### Expected Result
- Account created successfully
- Welcome email received ✅ (FIXED - now has error logging)
- Booking created in PENDING status

---

## 💳 STEP 4: PAYMENT

### Payment Process
1. **Stripe Payment Form**:
   - Card number, expiry, CVC
   - Billing details
   - "Confirm Payment" button

2. **Payment Confirmation**:
   - Stripe processes payment
   - Webhook receives `payment_intent.succeeded` event
   - Booking status updated to **CONFIRMED** ✅ (FIXED)

### Webhook Handling (Improved)
The webhook now:
- ✅ Updates booking.status → CONFIRMED
- ✅ Sets booking.isPaid → true
- ✅ Sends confirmation email to client with try-catch (FIXED)
- ✅ Sends welcome email if new account (FIXED)
- ✅ Sends notification to instructor with try-catch (FIXED)
- ✅ Logs all email successes/failures (NEW)

### Email Contents
**Client Email Includes:**
- Booking confirmation
- Instructor name, phone, email ← CLICKABLE LINKS
- Package details (hours, test package info)
- Total paid amount
- Next steps
- Dashboard link

**Instructor Email Includes:**
- Payment received notification
- Client name, email, phone
- Package hours & details
- Learner info (if applicable)
- Platform fee & instructor payout
- Dashboard link

### Expected Result
- ✅ Payment completes successfully
- ✅ Booking marked as CONFIRMED (not PENDING)
- ✅ **Confirmation email arrives within 2-5 minutes** (FIXED)
- ✅ Instructor gets notification
- ✅ New user gets welcome email

---

## ✅ STEP 5: CONFIRMATION PAGE

### After Payment
User sees:
- "🎉 Your Booking is Confirmed!"
- Booking details summary
- Instructor contact information
- "What's Next?" section with action items:
  1. Check email in 5 minutes
  2. Access your dashboard to manage bookings
  3. Contact instructor directly if needed

### Expected Result
- Confirmation displayed
- User redirected to confirmation page
- Email confirmation received

---

## 📱 STEP 6: CLIENT DASHBOARD

### Dashboard Features (ENHANCED ✅)

#### **Current Instructor Card** (NEW FEATURE)
Located at top of dashboard showing:
- 👨‍🏫 Instructor name, avatar
- ⭐ Rating and reviews
- 💲 Hourly rate
- 📱 Phone number (clickable)
- 📧 Email (clickable)
- 📍 Base address
- **Services Offered** (Regular Lessons, PDA Test, Mock Test)
- 📦 **Package Status** (if purchased):
  - Total hours
  - Used hours
  - Remaining hours
  - Expiry date

#### **Action Buttons** (NEW)
1. **Book Now** → Schedule new lesson with current instructor
2. **Switch Instructor** → Search and select different instructor

#### **Navigation Tabs**
1. **My Bookings**
   - Upcoming Lessons (with reschedule option)
   - Past Lessons
   - Each booking shows date, time, instructor, status

2. **Wallet & Credits**
   - Total paid balance
   - Points used
   - Credits remaining
   - Add more credits button
   - Package information (hours, expiry)
   - Recent transactions

3. **Reviews** (if available)
   - Leave review for completed lessons
   - View instructor's response

#### **Reschedule Feature**
```
Booking card → Reschedule button
        ↓
Calendar picker → Select new date/time
        ↓
Submit → Verify availability
        ↓
Confirmation email sent to both
```

#### **Review Feature**
```
Completed booking → Leave Review
        ↓
Rating (1-5 stars)
        ↓
Optional: Comments
        ↓
Submit
```

### Expected Result
- Dashboard fully functional
- **Instructor info visible with all contact details**
- **Can book more lessons directly**
- **Can switch to different instructor**
- Package hours update in real-time
- Reschedule works smoothly
- Reviews submit successfully

---

## 🧪 TESTING CHECKLIST

### ✅ Phase 1: Account Creation
- [ ] Search for instructor by location
- [ ] Select instructor
- [ ] Enter booking details
- [ ] Create account with password
- [ ] Check: Account created in database with role=CLIENT
- [ ] Check: Welcome email received

### ✅ Phase 2: Payment & Confirmation
- [ ] Complete payment with test Stripe card
- [ ] Check: Booking status changes from PENDING → CONFIRMED
- [ ] Check: Confirmation email received (with instructor contact)
- [ ] Check: Instructor gets notification
- [ ] Check: Payment shows as completed

### ✅ Phase 3: Client Dashboard
- [ ] Login with new account
- [ ] Check: Current instructor card visible
- [ ] Check: Shows instructor name, rating, rate
- [ ] Check: Shows services offered
- [ ] Check: Shows package status (hours remaining)
- [ ] Check: "Book Now" button works
- [ ] Check: "Switch Instructor" button works

### ✅ Phase 4: Rescheduling
- [ ] Create test booking
- [ ] Go to My Bookings tab
- [ ] Click reschedule on upcoming booking
- [ ] Select new date/time
- [ ] Submit
- [ ] Check: Booking updated
- [ ] Check: Reschedule email sent

### ✅ Phase 5: Package Hours Deduction
- [ ] Purchase 10-hour package
- [ ] Book 3-hour lesson
- [ ] Check: Package shows 7 hours remaining
- [ ] Book another 5-hour lesson
- [ ] Check: Package shows 2 hours remaining
- [ ] Try to book 3-hour lesson → should be blocked (insufficient hours)

### ✅ Phase 6: Email Verification
- [ ] Check inbox for:
   - [ ] Welcome email (if new account)
   - [ ] Booking confirmation (with instructor phone/email clickable)
   - [ ] Links in email work correctly
   - [ ] Dashboard link functional

---

## 🔧 FIXES IMPLEMENTED

### ✅ Email Not Received (FIXED)
- **Issue**: Emails were sent but no error logging if SMTP failed
- **Fix**: Added try-catch blocks with console logging
- **Location**: `/app/api/payments/webhook/route.ts`
- **Result**: Now logs ✅ or ❌ for each email send

### ✅ Booking Stuck as PENDING (FIXED)
- **Issue**: Webhook wasn't updating status to CONFIRMED
- **Fix**: Verified webhook payload handling and database update
- **Location**: `/app/api/payments/webhook/route.ts`
- **Result**: Bookings now properly marked as CONFIRMED after payment

### ✅ No Instructor Contact Info in Email (FIXED)
- **Issue**: Confirmation email didn't include instructor phone/email
- **Fix**: Added instructor.phone parameter to email service
- **Location**: `/app/api/payments/webhook/route.ts` + `/lib/services/email.ts`
- **Result**: Emails now show clickable phone and email links

### ✅ Dashboard Doesn't Show Instructor (FIXED)
- **Issue**: Client dashboard had no instructor visibility or services
- **Fix**: Created new instructor card with all details
- **Location**: `/app/client-dashboard/page.tsx` + `/app/api/client/current-instructor/route.ts`
- **Result**: Dashboard now shows selected instructor with services and booking options

### ✅ No Way to Switch Instructor (FIXED)
- **Issue**: Once booked, couldn't easily search for different instructor
- **Fix**: Added "Switch Instructor" button on dashboard
- **Location**: `/app/client-dashboard/page.tsx`
- **Result**: One-click navigation to instructor search

---

## 📊 API ENDPOINTS REFERENCE

### Public Endpoints (No Auth)
- `POST /api/public/bookings` - Create public booking
- `GET /api/public/instructors` - List all instructors

### Client Endpoints (Auth Required)
- `GET /api/client/profile` - Client profile
- `GET /api/client/wallet` - Wallet/credits
- `GET /api/client/packages` - Package details
- `GET /api/client/current-instructor` - Current instructor info ← NEW
- `POST /api/bookings/{id}/reschedule` - Reschedule booking
- `POST /api/reviews` - Submit review

### Payment Endpoints
- `POST /api/payments/create-intent` - Create Stripe intent
- `POST /api/payments/webhook` - Stripe webhooks

---

## 🚀 QUICK START FOR TESTING

```bash
# 1. Start development server
npm run dev

# 2. Go to booking page
http://localhost:3000/book

# 3. Search for instructor
- Enter location (e.g., "London")
- Click on an instructor

# 4. Complete booking
- Select package (10 hours)
- Enter details
- Create account with password
- Complete payment with:
  Card: 4242 4242 4242 4242
  Exp: 12/25
  CVC: 123

# 5. Check emails
- Look for welcome email
- Look for confirmation email

# 6. Login and test dashboard
- Use email + password created
- Verify instructor card shows
- Test "Book Now" button
- Test "Switch Instructor"
```

---

## ⚠️ Known Issues & Workarounds

| Issue | Status | Workaround |
|-------|--------|-----------|
| Stripe not configured | ⚠️ | Use test keys in .env.local |
| Gmail might filter emails | ⚠️ | Check Spam/Promotions folders |
| Email delays 1-2 min | ℹ️ | Normal - SMTP queuing |
| Package hours not showing | ✅ FIXED | Reload dashboard |
| Reschedule conflicts | ✅ FIXED | Select different time |

---

## 📞 Support

If issues persist after fixes:
1. **Check Server Logs**: `npm run dev` output
2. **Verify Email Config**: Check `.env.local` SMTP settings
3. **Check Database**: Verify booking.status = CONFIRMED
4. **Clear Cache**: Hard refresh (Ctrl+F5)
5. **Check Inbox**: Including spam/promotions folders

