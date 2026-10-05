# Manual Testing Guide - Phase 3B

**Environment:** Isolated test environment  
**Base URL:** https://drivebook-wheat.vercel.app  
**Date:** 2026-10-05  

---

## Prerequisites

- ✅ Automated integration tests passed (14/14 critical tests)
- ✅ Stripe TEST mode confirmed
- ✅ Supabase test account connected
- ✅ No real customer data in environment

---

## Test Session Setup

### Before You Begin

1. Open browser in **incognito/private mode** (clean session)
2. Navigate to: https://drivebook-wheat.vercel.app
3. Open browser DevTools (F12):
   - Console tab: Watch for JavaScript errors
   - Network tab: Monitor API requests
   - Application/Storage tab: Check cookies/localStorage

### Test Credentials

You will create test accounts during this session. Use test email addresses:
- Instructor: `test-instructor-[timestamp]@example.com`
- Client: `test-client-[timestamp]@example.com`

---

## Test Suite 1: Registration & Authentication

### 1.1 User Registration ✅ / ❌

**Test:** Create new instructor account

1. Navigate to `/register`
2. Fill registration form with test data:
   - Email: `test-instructor-$(date +%s)@example.com`
   - Password: Strong test password (save for later)
   - Role: Instructor
   - Required fields: Business name, phone, etc.
3. Submit registration

**Expected Results:**
- [ ] Form validates correctly
- [ ] No JavaScript errors in console
- [ ] Registration succeeds (status message or redirect)
- [ ] Database record created (verify via next login)
- [ ] Email sent (if email verification enabled)

**Actual Results:**
```
Status: 
Errors: 
Notes: 
```

---

### 1.2 Email Verification (if enabled) ✅ / ❌ / ⏭️

**Test:** Email confirmation flow

1. Check test email inbox for verification email
2. Click verification link
3. Confirm account activated

**Expected Results:**
- [ ] Email delivered within 1 minute
- [ ] Email contains verification link
- [ ] Link redirects to confirmation page
- [ ] Account status updated to verified

**Actual Results:**
```
Status: 
Email received: Y/N
Verification worked: Y/N
Notes: 
```

---

### 1.3 Login Flow ✅ / ❌

**Test:** Authenticate with created account

1. Navigate to `/login`
2. Enter test credentials
3. Submit login

**Expected Results:**
- [ ] Login succeeds
- [ ] Redirects to `/dashboard`
- [ ] Session cookie created (check DevTools → Application → Cookies)
- [ ] `next-auth.session-token` or similar cookie present
- [ ] No console errors

**Actual Results:**
```
Status: 
Redirect URL: 
Session token present: Y/N
Errors: 
```

---

### 1.4 Protected Route Access ✅ / ❌

**Test:** Verify authenticated access to dashboard

1. After login, navigate to `/dashboard`
2. Verify page loads successfully
3. Check network requests for API calls

**Expected Results:**
- [ ] Dashboard loads without errors
- [ ] User data displayed correctly
- [ ] API requests return 200 OK
- [ ] No authentication errors in console

**Actual Results:**
```
Status: 
Data displayed: 
API errors: 
```

---

### 1.5 Logout ✅ / ❌

**Test:** Session termination

1. Click logout button/link
2. Verify redirected to public page
3. Attempt to access `/dashboard` again

**Expected Results:**
- [ ] Logout succeeds
- [ ] Session cookie cleared
- [ ] Redirects to login or home
- [ ] Accessing `/dashboard` redirects back to login

**Actual Results:**
```
Status: 
Session cleared: Y/N
Re-access protected route result: 
```

---

## Test Suite 2: Database Operations

### 2.1 Profile Update ✅ / ❌

**Test:** Write operation to database

1. Login with test instructor account
2. Navigate to profile settings
3. Update profile information (e.g., business name, phone)
4. Save changes

**Expected Results:**
- [ ] Form submission succeeds
- [ ] Success message displayed
- [ ] Data persists after page refresh
- [ ] Database record updated (verify in Supabase if accessible)

**Actual Results:**
```
Status: 
Data persisted: Y/N
Errors: 
```

---

### 2.2 Create Booking (if accessible) ✅ / ❌ / ⏭️

**Test:** Complex database write with relations

1. Navigate to bookings section
2. Create new test booking
3. Fill required fields
4. Submit

**Expected Results:**
- [ ] Booking created successfully
- [ ] Confirmation message shown
- [ ] Booking appears in list
- [ ] Related records created (transactions, etc.)

**Actual Results:**
```
Status: 
Booking ID: 
Related records created: 
Errors: 
```

---

### 2.3 Query Performance ✅ / ❌

**Test:** Database read operations

1. Navigate to dashboard
2. Check page load time
3. Verify data displays correctly
4. Check Network tab for slow queries

**Expected Results:**
- [ ] Page loads in < 2 seconds
- [ ] All data displays correctly
- [ ] No database timeout errors
- [ ] API responses < 500ms

**Actual Results:**
```
Page load time: 
Slowest API request: 
Errors: 
```

---

## Test Suite 3: Stripe Integration (TEST MODE)

### 3.1 Verify Stripe Test Mode ✅ / ❌

**Test:** Confirm test mode active

1. Navigate to `/dashboard/subscription`
2. Open browser DevTools → Network tab
3. Look for Stripe API requests or embedded key
4. Check page source for `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

**Expected Results:**
- [ ] Publishable key starts with `pk_test_`
- [ ] NO `pk_live_` keys found
- [ ] Stripe Elements load correctly (if visible)

**Actual Results:**
```
Stripe mode: TEST / LIVE / UNKNOWN
Key prefix found: 
Notes: 
```

---

### 3.2 Create Test PaymentIntent ✅ / ❌ / ⏭️

**Test:** Stripe test transaction

1. Navigate to subscription or payment page
2. Initiate payment flow
3. Use Stripe test card: `4242 4242 4242 4242`
4. Expiry: Any future date (e.g., 12/34)
5. CVC: Any 3 digits (e.g., 123)
6. Submit payment

**Expected Results:**
- [ ] Payment form loads
- [ ] Stripe Elements render correctly
- [ ] Test card accepted
- [ ] PaymentIntent created (check Network tab for API call)
- [ ] Success message displayed
- [ ] Database updated with subscription/payment record

**Actual Results:**
```
Status: 
PaymentIntent ID: 
Database record created: Y/N
Errors: 
```

---

### 3.3 Stripe Webhook (if verifiable) ✅ / ❌ / ⏭️

**Test:** Webhook delivery

1. After payment, check Vercel logs (if accessible)
2. Or check application logs/audit trail
3. Verify webhook event processed

**Expected Results:**
- [ ] Webhook received by application
- [ ] Event processed successfully
- [ ] Database updated via webhook handler

**Actual Results:**
```
Status: 
Webhook received: Y/N
Event type: 
Processing result: 
```

---

## Test Suite 4: Error Handling

### 4.1 Invalid Login ✅ / ❌

**Test:** Error messages display correctly

1. Navigate to `/login`
2. Enter incorrect credentials
3. Submit

**Expected Results:**
- [ ] Error message displayed
- [ ] No console errors
- [ ] Form remains on login page
- [ ] No sensitive information leaked in error

**Actual Results:**
```
Status: 
Error message: 
Appropriate error: Y/N
```

---

### 4.2 CSRF Protection ✅ / ❌

**Test:** Form submission security

1. Login to application
2. Open DevTools → Network tab
3. Submit a form (e.g., profile update)
4. Check for CSRF token in request

**Expected Results:**
- [ ] CSRF token present in form or headers
- [ ] NextAuth CSRF token visible
- [ ] Form submission works correctly

**Actual Results:**
```
Status: 
CSRF token found: Y/N
Token location: 
```

---

### 4.3 SQL Injection Protection ✅ / ❌

**Test:** Basic input validation

1. Attempt to enter SQL-like string in search/input field
2. Example: `' OR '1'='1`
3. Submit

**Expected Results:**
- [ ] Input sanitized or rejected
- [ ] No SQL error messages
- [ ] Application handles gracefully

**Actual Results:**
```
Status: 
Input handling: 
Response: 
```

---

## Test Suite 5: External Services (Optional)

### 5.1 Email Delivery ✅ / ❌ / ⏭️

**Test:** SMTP integration

1. Trigger email (password reset, booking confirmation, etc.)
2. Check test email inbox

**Expected Results:**
- [ ] Email delivered within 60 seconds
- [ ] Content renders correctly
- [ ] Links work
- [ ] Sender address correct

**Actual Results:**
```
Status: 
Email received: Y/N
Delivery time: 
Content correct: Y/N
```

---

### 5.2 File Upload (Cloudinary) ✅ / ❌ / ⏭️

**Test:** Image/file storage

1. Navigate to profile or document upload
2. Upload test image
3. Verify upload succeeds

**Expected Results:**
- [ ] Upload succeeds
- [ ] Image displays correctly
- [ ] File stored in Cloudinary test account
- [ ] URL returned and saved

**Actual Results:**
```
Status: 
Upload succeeded: Y/N
Image URL: 
Errors: 
```

---

## Test Suite 6: Performance & UX

### 6.1 Page Load Performance ✅ / ❌

**Test:** Application responsiveness

1. Navigate through major pages
2. Measure load times
3. Check for performance issues

**Key Pages:**
- `/` (homepage)
- `/dashboard`
- `/dashboard/bookings`
- `/dashboard/earnings`

**Expected Results:**
- [ ] All pages load in < 3 seconds
- [ ] No layout shift (CLS)
- [ ] Smooth interactions

**Actual Results:**
```
Homepage: 
Dashboard: 
Bookings: 
Performance issues: 
```

---

### 6.2 Mobile Responsiveness ✅ / ❌ / ⏭️

**Test:** Responsive design

1. Open DevTools → Toggle device toolbar (Ctrl+Shift+M)
2. Test mobile viewport (375×667 - iPhone SE)
3. Test tablet viewport (768×1024 - iPad)

**Expected Results:**
- [ ] Layout adapts correctly
- [ ] No horizontal scroll
- [ ] Touch targets appropriately sized
- [ ] Navigation accessible

**Actual Results:**
```
Mobile view: 
Tablet view: 
Issues found: 
```

---

### 6.3 Console Errors ✅ / ❌

**Test:** Clean execution

Review browser console across all test activities

**Expected Results:**
- [ ] No uncaught errors
- [ ] No 404s for assets
- [ ] No broken API calls
- [ ] Warnings acceptable but documented

**Actual Results:**
```
Errors found: 
Warnings: 
Action needed: 
```

---

## Summary & Sign-Off

### Test Execution Summary

| Test Suite | Passed | Failed | Skipped | Notes |
|------------|--------|--------|---------|-------|
| 1. Auth | __/5 | __/5 | __/5 | |
| 2. Database | __/3 | __/3 | __/3 | |
| 3. Stripe | __/3 | __/3 | __/3 | |
| 4. Errors | __/3 | __/3 | __/3 | |
| 5. External | __/2 | __/2 | __/2 | |
| 6. Performance | __/3 | __/3 | __/3 | |
| **TOTAL** | __/19 | __/19 | __/19 | |

### Critical Issues Found

```
Issue 1: 
Issue 2: 
Issue 3: 
```

### Environment Assessment

**Isolated Test Environment Status:**
- [ ] ✅ Fully functional - ready for credential rotation
- [ ] ⚠️ Functional with minor issues - can proceed
- [ ] ❌ Blocking issues found - requires fixes

### Recommendations

```
1. 
2. 
3. 
```

### Tester Sign-Off

**Tested By:** _______________  
**Date:** 2026-10-05  
**Time:** _______________  
**Duration:** _______________  

**Overall Assessment:** _______________

---

## Next Steps After Manual Testing

1. **If all tests pass:**
   - ✅ Document results
   - ✅ Proceed to SECURITY-01 credential rotation
   - ✅ Update Vercel Production environment variables
   - ✅ Re-test with new credentials
   - ✅ Mark SECURITY-01 FIX-VERIFIED → CLOSED

2. **If issues found:**
   - ⚠️ Document all failures
   - ⚠️ Prioritize: blocking vs non-blocking
   - ⚠️ Fix blocking issues
   - ⚠️ Re-test
   - ⚠️ Then proceed to credential rotation

3. **Custom domain decision:**
   - Decision: Use www.drivebook.au OR drivebook-wheat.vercel.app
   - If www.drivebook.au: Fix 404 configuration
   - If drivebook-wheat: Update as primary URL

---

**Manual Testing Status:** ⚠️ PENDING EXECUTION  
**Automated Tests:** ✅ PASSED (14/14)  
**Ready for Credential Rotation:** ⏳ AWAITING MANUAL TEST COMPLETION
