# TODO â€” Planned, Pending, and Deferred

**Rule:** This file tracks only what is NOT yet done. When an item is completed, remove it from here and record it in CHANGES.md or the permanent feature doc.  
**Last Updated:** August 2026

---

## ðŸ”´ PRE-LAUNCH BLOCKERS â€” must be done before going live

| # | What | Where |
|---|------|--------|
| 1 | Set live Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`) | Vercel env vars |
| 2 | Set `STRIPE_WEBHOOK_SECRET` â€” use path `/api/stripe/webhook` ONLY. Remove `/api/subscriptions/webhook` from Stripe dashboard â€” it is retired. | Vercel env vars â†’ Stripe Dashboard â†’ Webhooks |
| 3 | Create live Stripe price IDs for all 8 tiers (BASIC/PRO/STUDIO/PREMIUM Ã— monthly/annual) | Vercel env vars |
| 4 | Configure Stripe Billing Portal (plan switching + proration) | Stripe Dashboard â†’ Settings â†’ Billing |
| 6 | Verify `GOOGLE_REDIRECT_URI=https://drivebook.com.au/api/calendar/callback` | Vercel env vars + Google Cloud Console |
| 10 | Set `connection_limit=20` in `DATABASE_URL` | Vercel env vars |
| 11 | Set Firebase env vars (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) | Vercel env vars â€” required for mobile push |
| 12 | Submit sitemap to Google Search Console | search.google.com/search-console â†’ Sitemaps |
| 13 | Set `VOICE_SERVICE_API_KEY` in Railway | Required for voice AI cancel flow without session auth |
| 14 | Refund 2 duplicate $129 charges for birhane457@gmail.com | Stripe Dashboard â†’ `sub_1TvWkY` and `sub_1TvXkM` |
| 15 | Link correct `stripeSubscriptionId` for birhane457@gmail.com | `/admin/subscriptions` â†’ instructor â†’ Subscription tab â†’ Link Stripe Sub |

---

## ðŸ”§ PENDING CODE FIXES

### Package refunds â€” tiered discount recalculation

| # | Priority | Feature | Notes |
|---|---|---|---|
| PKG-1 | âœ… COMPLETE | **Partial package refund calculation** | **CRITICAL:** `cancelBooking()` in `lib/services/booking-service.ts` currently refunds `booking.price` (single lesson price) without accounting for package hours used vs remaining or tiered discounts. **Example:** Customer buys 10hr package at $70/hr with 10% discount â†’ pays $630 total. Takes 5 lessons (5hrs used, 5hrs remain). Customer requests refund. **Current behavior:** Refunds based on single lesson price. **Required behavior:** Calculate what customer should pay for 5 used hours at original purchase rates (5hrs = no tier discount, so 5 Ã— $70 = $350), then refund the difference: $630 - $350 = $280 (not full remaining balance). **Schema needed:** `Booking` already has `lockedHourlyRate`, `lockedDiscountPct`, `packageHours`, `packageHoursRemaining`, `packageTotalPaid`. **Implementation:** New function `calculatePartialPackageRefund(booking)` that: 1) calculates hours used = `packageHours - packageHoursRemaining`, 2) determines what tier discount applies to hours used (e.g., 5hrs = 0%, 6hrs = 5%, 10hrs = 10%, 15hrs = 12%), 3) calculates amount customer should have paid for used hours = `hoursUsed Ã— lockedHourlyRate Ã— (1 - usedTierDiscount/100)`, 4) refunds `packageTotalPaid - amountForUsedHours`. Apply time-based refund policy (100% if >48h notice, 50% if >24h, 0% otherwise) to the calculated refund amount. **Files to modify:** `lib/services/booking-service.ts` â†’ `cancelBooking()`, add `calculatePartialPackageRefund()` helper. **Test cases:** 10hr package ($630), use 5hrs â†’ refund $280; 15hr package ($924), use 8hrs â†’ refund based on 8hr having 5% discount vs 15hr having 12%; 6hr package, use 5hrs â†’ refund based on 5hr having 0% discount. **Status (Sept 1, 2026):** âœ… COMPLETE â€” `calculatePartialPackageRefund()` implemented in `lib/services/booking-service.ts`. |

| PKG-2 | ðŸŸ¡ MED | **Admin dashboard package refund visibility** | **GAP:** Admin booking detail view does not show package-specific refund calculation breakdown. When admin views or cancels a package booking, they cannot see: 1) Hours used vs remaining, 2) What tier discount applies to used hours, 3) Preview of tier-aware refund amount before confirming cancellation. **Current UI:** `/admin/bookings` list shows package indicator (ðŸ“¦ icon) and basic booking details. Clicking a package booking shows standard fields (status, time, price) but no package-specific fields. Cancel button shows generic confirmation "Client and instructor will be notified" â€” no refund amount preview. **Required UI additions:** 1) In booking detail modal/page, add "Package Details" section showing: `packageHours`, `packageHoursRemaining`, `packageTotalPaid`, `lockedHourlyRate`, `lockedDiscountPct`. 2) When "Cancel Booking" is clicked for a package, show refund calculation breakdown: "Hours used: 5 of 10 (5 remain) â†’ Used hours tier: 0% discount â†’ Amount for used hours: $350 â†’ Refundable base: $280 â†’ With 100% policy: $280 refund to wallet". 3) In revenue â†’ refunds tab, add "Package" column showing package details for package refunds. **Files to modify:** `app/admin/bookings/page.tsx` (modal), `app/admin/bookings/[id]/edit/page.tsx` (detail page), optionally `app/admin/revenue/page.tsx` (refunds tab). **Benefit:** Admin can explain refund amounts to customers with confidence, understand why partial package refunds differ from simple lesson refunds, audit refund accuracy. |

| PKG-3 | âœ… COMPLETE | **Package refund approval workflow (safety gate)** | **RISK:** Current system auto-refunds package cancellations immediately using tier-aware calculation. If calculation has bugs or edge cases, incorrect refunds are issued instantly with no human review. **Required:** Add manual approval workflow for package cancellations until calculation is proven stable (6-12 months). **Implementation:** 1) When customer cancels package booking from their dashboard, status â†’ `CANCELLATION_PENDING` (new status), refund NOT issued. 2) Email notification sent to admin: "Package cancellation requested by [customer] â€” [booking details] â€” calculated refund: $280 (review required)". 3) Admin dashboard shows "Pending Cancellations" queue in `/admin/bookings` with filter. 4) Admin clicks cancellation â†’ sees full package details + refund calculation breakdown (hours used, tier discount, refund amount). 5) Admin actions: **Approve** (issues refund + marks cancelled), **Adjust** (override refund amount + reason), **Reject** (keep booking active + notify customer). 6) All approvals/rejections logged to `AuditLog` with full reasoning. 7) After 6-12 months of zero calculation errors, add admin setting "Auto-approve package refunds" to bypass manual review. **Schema:** Add `Booking.cancellationStatus` enum (`null | PENDING | APPROVED | REJECTED`), `Booking.cancellationRequestedAt`, `Booking.cancellationRequestedBy`, `Booking.adminReviewedBy`, `Booking.adminReviewNote`. **Benefits:** Catches calculation errors before money moves, builds trust with customers (human reviewed), creates audit trail for disputes, allows gradual rollout. **Files:\*\* `lib/services/booking-service\.ts` \(split cancelBooking into requestCancellation \+ approveCancellation\), `app/api/bookings/\[id\]/cancel/route\.ts`, new `app/api/admin/cancellations/\[id\]/approve/route\.ts`, `app/admin/cancellations/page\.tsx` \(new queue page\)\. \|

### Package refund â€” customer & admin enhancements

| # | Priority | Feature | Notes |
|---|---|---|---|
| PKG-4 | ðŸŸ¡ MED | **Email notifications for cancellation workflow** | **MISSING:** System sends no emails during cancellation flow. **Required:** 4 email templates: 1) Customer: "Cancellation request received â€” awaiting review (24h)" (sent after `requestPackageCancellation()`), 2) Admin: "New package cancellation pending review â€” [booking details + calculated refund]" (sent after request), 3) Customer: "Cancellation approved â€” $280 refunded to card" (sent after `approveCancellation()`), 4) Customer: "Cancellation rejected â€” [reason] â€” booking remains active" (sent after `rejectCancellation()`). **Implementation:** Add 4 new functions to `lib/services/email.ts`: `sendCancellationRequestedEmail()`, `sendCancellationPendingAdminEmail()`, `sendCancellationApprovedEmail()`, `sendCancellationRejectedEmail()`. Call from service functions in `lib/services/booking-service.ts`. **Templates:** Use existing email layout, include booking details, refund breakdown, next steps. **Files:** `lib/services/email.ts` (4 new functions), `lib/services/booking-service.ts` (add email calls). |
| PKG-5 | ðŸŸ¡ MED | **Customer UI â€” request cancellation button** | **MISSING:** Customers have no way to request cancellation from their dashboard. Must contact admin manually. **Required:** 1) Add "Request Cancellation" button to package booking cards in customer dashboard (show only for active package bookings, hide if already pending/cancelled). 2) Clicking button opens modal with: refund preview (shows calculated amount based on hours used), reason textarea (required), time-based policy explanation ("Full refund if >48h notice, 50% if >24h"), submit button. 3) On submit: POST `/api/bookings/[id]/request-cancellation` with reason, show success message "Request submitted â€” admin will review within 24 hours", refresh booking list to show "Cancellation Pending" badge. 4) Booking card shows status badge: "Cancellation Pending" (yellow), "Cancellation Approved" (green), "Cancellation Rejected" (red). **Files:** `app/client-dashboard/page.tsx` or `app/dashboard/bookings/page.tsx` (depending on customer dashboard location), new modal component `components/customer/CancellationRequestModal.tsx`. **API already built:** Endpoint exists at `app/api/bookings/[id]/request-cancellation/route.ts`. |
| PKG-6 | ðŸŸ¢ LOW | **Testing checklist for cancellation workflow** | **Required before production:** Manual QA of full workflow. **Test cases:** 1) Customer requests cancellation (>48h notice) â†’ admin approves â†’ verify Stripe refund issued + wallet debited correctly. 2) Customer requests cancellation (<24h notice) â†’ verify 0% refund calculated + admin can override amount. 3) Admin rejects cancellation â†’ verify booking stays active + customer gets rejection email. 4) Test edge cases: no payment intent (offline booking), already cancelled booking, partial package (5 of 10 hours used). 5) Test admin override: approve with custom amount + note â†’ verify override amount refunded (not calculated amount). 6) Verify wallet debit prevents double-credit (check wallet balance before/after). 7) Test with different package tiers (6hr/10hr/15hr) â†’ verify tier-aware discount recalculation works. 8) Test Stripe test mode: use test card 4242 4242 4242 4242, verify refund appears in Stripe dashboard. **Files:** Create `docs/TESTING_CHECKLIST_PKG3.md` with detailed test scenarios + expected results. |
| PKG-7 | ðŸŸ¢ LOW | **Admin dashboard enhancements for cancellations** | **Nice-to-have improvements:** 1) Add filters to `/admin/cancellations` page: date range (last 7 days / 30 days / custom), instructor filter (dropdown), amount range (Files:** `lib/services/booking-service.ts` (split cancelBooking into requestCancellation + approveCancellation), `app/api/bookings/[id]/cancel/route.ts`, new `app/api/admin/cancellations/[id]/approve/route.ts`, `app/admin/cancellations/page.tsx` (new queue page). |-$100 / $100-$500 / $500+). 2) Add search: by customer name, email, booking ID. 3) Add bulk actions: "Approve selected" (if needed for high volume). 4) Add export to CSV: download pending/approved/rejected cancellations with all details for reporting. 5) Add refund calculation breakdown tooltip: hover over calculated refund amount â†’ shows: "Hours used: 5 of 10 | Used tier discount: 0% | Amount for used: $350 | Refund base: $280 | Policy applied: 100%". 6) Add sort options: by request date (newest/oldest), by refund amount (highest/lowest). **Benefit:** Easier to manage high volume of cancellation requests, better reporting for finance team. **Files:** `app/admin/cancellations/page.tsx` (add filter/search UI), backend API may need query param support. **Priority:** Low â€” core workflow works without these, add when needed. |




---

## 🟡 PAYMENT AUDIT — LOW PRIORITY UX IMPROVEMENTS

**Ref:** Payment system audit (Sept 1, 2026) — All HIGH/MEDIUM security/financial issues fixed. These LOW items are UX enhancements only.

| # | Priority | Issue | Notes |
|---|---|---|---|
| PAY-5 | 🟢 LOW | Fraud pattern detection | Implement velocity limits, suspicious refund patterns, unusual booking patterns. Not blocking production. |
| PAY-7 | 🟢 LOW | Package integrity validation | Validate package hours usage matches individual bookings (Req 14.1-14.7). Data quality check, not security issue. |
| PAY-8 | 🟢 LOW | Manual payout validation rules | Add validation checklist when admin processes manual payouts (Req 17.1-17.8). UX improvement, manual review already required. |
| PAY-10 | 🟢 LOW | Adjustment recovery email improvements | Add customer name + lesson date to instructor deduction emails. Minor UX polish. |
| PAY-12 | 🟢 LOW | Top Instructors visual separator | Add time context header to admin revenue "Top Instructors" section. Cosmetic improvement. |
| PAY-15 | 🟢 LOW | Price change audit trail | Log old/new values if booking prices are manually corrected. Nice-to-have for historical debugging. |
| PAY-17 | 🟢 LOW | Package price corruption assertion | Add validation to prevent price=packageTotal in additional creation paths beyond bulk API. Defense-in-depth. |
| PAY-19 | 🟢 LOW | Transaction history UI page | Create paginated transaction history page for clients. API exists, UI not built. |
| PAY-20 | 🟢 LOW | Payout status in earnings display | Show which earnings are paid/pending/on-hold in instructor dashboard. UX clarity improvement. |

### Document security

| # | Priority | Feature | Notes |
|---|---|---|---|
| DOC-1 | âœ… Done | **Signed URLs for private documents** | All document views (instructor + admin) now go through API endpoints that generate 5-min signed Cloudinary URLs. Raw URLs no longer returned to client. |
| DOC-2 | ðŸŸ¡ MED | **LLM document scanning on upload** | After upload, send image to GPT-4o vision (server-side only). Extract `name`, `dob`, `licenceNumber`, `issueDate`, `expiryDate`. Store in `DocumentVerification` table. Admin sees extracted card â€” approve or flag. Cross-check extracted name/DOB against instructor profile. Schema needed: `DocumentVerification` model with `extractedName`, `extractedDob`, `extractedExpiry`, `extractedIssueDate`, `extractedLicenceNo`, `matchStatus` (`MATCH`/`MISMATCH`/`UNREADABLE`/`PENDING`), `flagReason`, `reviewedByAdminId`, `reviewedAt`. Never send extracted PII to client. Admin-only review UI. |

### Instructor search

| # | Priority | Feature | Notes |
|---|---|---|---|
| SEARCH-1 | âœ… Done | **Suburb-based search** | Instructors pick served suburbs from static AU data. Search matches by suburb/postcode â€” no maths. km radius kept as fallback for instructors without a suburb list. |
| SEARCH-2 | ðŸŸ¢ LOW | **Road-distance filter** | Current radius uses air distance (Haversine). Consider Google Maps Distance Matrix API for route-accurate filtering. Cost ~$0.005/call â€” only viable at scale. Alternative: apply a 1.3Ã— road factor multiplier to the radius threshold as a cheap approximation. |

### Timezone â€” national expansion readiness

| # | Priority | What | File | Notes |
|---|---|---|---|---|
| TZ-1 | âœ… Done | **Instructor timezone selector in Settings UI** | `app/dashboard/settings/page.tsx` | Dropdown added using `AU_TIMEZONES`. Saves to `Instructor.timezone` in DB. |
| TZ-2 | âœ… Done | **Availability service timezone** | `lib/services/availability.ts` | `parseTimeUTC()` now uses `localDateTimeToUTC` with instructor's stored timezone. Falls back to state-derived TZ, then Perth. |
| TZ-3 | âœ… Done | **Schedule page week view timezone** | `app/dashboard/schedule/page.tsx` | `toPerth()` replaced with `toLocal(dt, tz)`. All date helpers accept `tz` param. `bufferSettings.timezone` flows through WeekView, AgendaView, BookingCard. |
| TZ-4 | âœ… Done | **Booking confirmation email/SMS times** | `lib/services/email.ts`, `sms.ts`, `notifications.ts` | All functions accept optional `timezone` param defaulting to Perth. Existing call sites unaffected; new call sites can pass instructor's timezone. |

**Already timezone-aware (August 2026):**
- `app/api/bookings/offline/route.ts` â€” uses `localDateTimeToUTC` with instructor's stored timezone
- `components/instructor/OfflineEarningsSection.tsx` â€” accepts `timezone` prop, uses utility functions
- `app/dashboard/expenses/page.tsx` â€” fetches instructor timezone from settings API



| # | Priority | Issue | File | Notes |
|---|---|---|---|---|
| UX-2 | ðŸŸ¢ | Availability page has no unsaved-changes warning | `app/dashboard/availability/page.tsx` | Deferred |

### Payout system

**Failed payout â€” no UI retry action**  
`Payout.status = 'FAILED'` records have no retry button in `/admin/payouts`. Admin must call `POST /api/admin/payouts/process` manually. Medium priority.

### Recommendations (do when touching relevant file)

| ID | File | What |
|---|---|---|
| R-02 | `app/api/admin/instructors/route.ts` | Use JWT role from session, not extra DB lookup |
| R-04 | `app/admin/settings/page.tsx` | Masked SMTP field shows `â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢` even when env var is absent â€” show `â€”` instead |
| D-2 | `app/dashboard/profile/page.tsx` | Profile dual-request save â€” second request failure shows success UI |
| D-4 | Various admin pages | Second-confirmation step on high-impact financial actions |
| D-5 | Admin subscription routes | Rate limiting on subscription override mutations |

### Voice AI â€” production readiness (complete when declaring Voice AI live)

> The core platform can go live without these. Required only when activating the AI receptionist for production use.

| Item |
|---|
| Deploy: `git push gitlab main` (8 commits on `origin/main` not yet on Vercel) |
| Fix instructor address typo in DB â€” `baseAddress = "6/226 whatley Crescent Maylamds"` â†’ fix via admin dashboard |
| Replace `0488 000 000` placeholder in VAPI prompt: set `SUPPORT_PHONE`/`SUPPORT_EMAIL` in Railway â†’ run `node scripts/build-vapi-prompt.js` â†’ re-upload to VAPI dashboard |
| Test `/set-password` flow end-to-end: call â†’ book later â†’ SMS â†’ click link â†’ set password |
| TTS: Adam (11Labs) mispronounces Eritrean names â€” consider Azure `en-AU-NatashaNeural` (low priority) |

---

## ðŸ”’ SECURITY â€” Phase 2

| # | Priority | Feature | Notes |
|---|---|---|---|
| SEC-1 | âœ… Done | **New device verification code** | 6-digit email OTP required when instructor logs in from a new browser. OtpModal blocks navigation until confirmed. Known devices skip OTP. Non-instructor roles get notification email only (no gate). OTP rate-limited, HMAC-hashed, 5-min TTL. |
| SEC-2 | âœ… Done | **Recognised devices page** â€” `/dashboard/settings/security` | Built: list devices, remove individual, remove all others. |
| SEC-3 | ðŸŸ¡ MED | **Force logout all devices** â€” revoke all sessions | Requires switching to database sessions (`strategy: 'database'`). Currently JWT-based â€” sessions expire at 7d max / 30min idle. |
| SEC-4 | ðŸŸ¢ LOW | **Geo-location on device notification email** | Integrate `ip-api.com` free tier. `LoginDevice.location` field already in schema. |
| SEC-5 | ðŸŸ¢ LOW | **Admin audit monitoring cron** â€” daily AuditLog review for suspicious patterns | Check >20 failed logins, unusual wallet credits, bank detail changes. Email admin summary. |
| SEC-6 | ðŸŸ¢ LOW | **Cleanup old devices cron** | `cleanupOldDevices()` already written. Just needs a cron endpoint. |

---

## ðŸ”µ DEFERRED FEATURES

### Data export â€” instructor self-serve UI
Admin CSV export is built. Instructor self-serve export not built.

### Vehicle model (Sprint 5)
Defer until Business dashboard. See `03-instructor/SCHEDULE.md`.

### Student progress tracking
Needs product design + schema work. Current implementation is lesson notes only.

### Mobile app publication
Capacitor shell exists. Not published to App Store or Google Play.

### Tests
Zero `*.test.ts` files. Priority order: Stripe webhook â†’ wallet deduction â†’ booking creation â†’ refund flow.

---

## ðŸ”µ SEO â€” PENDING

- Feature pages: `/features/wallet`, `/features/packages`, `/features/reviews`, `/features/offline-booking`
- Comparison pages: `/compare/acuity`, `/compare/manual-booking`
- SEO Phase 5 â€” Documentation centre `/docs`
- SEO Phase 6 â€” Interactive tools (lesson cost calculator, PDA quiz, package savings calculator)

---

## ðŸ”µ POST-LAUNCH PRODUCT WORK

| # | What | Effort |
|---|------|--------|
| 1 | Chargeback auto-freeze of instructor payout | 3 days |
| 2 | Payout recovery job (DB commit failure after Stripe success) | 2 days |
| 3 | Guard: instructor deleted before payout | 1 day |
| 4 | Dashboard revenue: subtract refunds from displayed totals | 1 day |
| 5 | Denormalized summary table for analytics at scale | 3 days |
| 6 | Notification deduplication (concurrent double-send) | 2 days |
| 7 | Stripe balance ledger over time | 2 days |
| 8 | SOC 2 compliance framework | 10+ days |
| 9 | Unified booking lifecycle service (single state machine for all flows) | 5+ days |
| 10 | Student dashboard partial-failure degraded states | 2 days |

---

## ðŸ”µ BLOG

Maintain 2â€“4 posts/month. Topics: new features, state expansions, seasonal content, DoT rule changes.  
OG images, Fuse.js search, and pagination deferred until 150+ posts.
