## Public Booking Flow – DriveBook Platform

This document describes how public bookings work across the main DriveBook app and the voice microservice, and what we do to keep them production‑ready.

---

### 1. Web Public Booking Flows

#### 1.1 Single-lesson public booking API

- **Endpoint**: `POST /api/public/bookings`
- **Used for**: Simple one-off bookings created directly from public pages, email links, or marketing landing pages.
- **Request shape** (simplified):
  - `instructorId: string`
  - `clientName: string`
  - `clientEmail: string (email)`
  - `clientPhone: string (9–15 digits, optional leading +, spaces stripped)`
  - `pickupAddress: string`
  - `startTime: string (ISO datetime)`
  - `endTime: string (ISO datetime, > startTime)`
  - `notes?: string`
  - `createAccount?: boolean`
  - `password?: string` (when `createAccount` is true)

**Key production protections:**

- **Validation**: Done via zod in `app/api/public/bookings/route.ts`:
  - Email format validation
  - Phone normalization + regex validation (`+` + 9–15 digits)
  - Start/end times must be valid datetimes and `endTime > startTime`
- **Server-side price calculation**:
  - The client `price` is *ignored*.
  - The API recomputes the price from:
    - Instructor’s `hourlyRate`
    - Duration in hours: `(endTime - startTime)`
  - Commission is calculated using this authoritative server-side amount.
- **Rate limiting**:
  - Uses `bookingRateLimit` and `checkRateLimitStrict` from `lib/ratelimit.ts`.
  - Identifier: `public-booking:{clientEmail}:{instructorId}` + IP address.
  - If exceeded → returns `429` with standard `X-RateLimit-*` headers.
- **Side effects**:
  - Creates/links a `user` and `client` record when `createAccount` is true.
  - Computes travel time and commission via shared services.
  - Pushes to Google Calendar when enabled for the instructor.
  - Sends confirmation emails to client + instructor.
  - Returns `201` with:
    - `booking` object
    - `redirectTo: /booking/{bookingId}/payment`

#### 1.2 Multi-step bulk package booking

- **Entry UI**:
  - `app/book/page.tsx` – location search landing page
  - `app/book/[instructorId]/page.tsx` – public instructor booking page (bulk packages)
  - Multi-step flow components in `app/book/[instructorId]/*`
- **API endpoint**: `POST /api/public/bookings/bulk`
- **Used for**: Package purchases (6/10/15 hours, optional test package) with “book now” or “book later” logic.

**Key behaviours:**

- **Validation**: zod schema in `app/api/public/bookings/bulk/route.ts`:
  - Instructor, package type, hours, booking type (`now|later`)
  - Scheduled slots (for “book now”)
  - Account-holder & learner details
  - Pricing object (validated but re-derived for commissions and wallet).
- **Pricing & commission**:
  - Uses `calculateBulkCommissionDynamic` from `lib/config/packages.ts` + platform pricing settings.
  - Total price and commission details are stored in a **wallet transaction** and **transaction** record.
- **Wallet-first design**:
  - Package purchases are credited to a client wallet as **pending** until payment is confirmed.
  - For “book now”, actual `booking` rows are created for each scheduled slot (with conflict checks).
  - For “book later”, all hours are stored as wallet credits for future scheduling.
- **Rate limiting**:
  - Uses `bulkBookingRateLimit` + `checkRateLimitStrict`.
  - Identifier: `bulk-booking:{accountHolderEmail}:{instructorId}` + IP.
  - Exceeding the limit returns `429` with `X-RateLimit-*` headers.
- **Error handling**:
  - If a scheduled slot conflicts with an existing booking:
    - Wallet + transaction records are rolled back.
    - API returns `409` with a human-readable message.

---

### 2. Voice Microservice Bookings (drivebook-hybrid)

The voice service (`drivebook-hybrid/`) exposes a smaller set of REST APIs used by Twilio + Copilot Studio.

- **Key endpoints** (see `drivebook-hybrid/openapi.yaml`):
  - `POST /voice/incoming` – Twilio webhook, routes calls to AI agent or voicemail.
  - `POST /voice/voicemail` – stores voicemail + optional SMS notifications.
  - `POST /api/bookings` – simple booking endpoint used by the AI agent.
  - `GET /api/instructor/lookup` – instructor phone lookup (DriveBook API + local cache).

**Alignment with web booking:**

- **Validation**:
  - Uses shared zod phone/date/time schemas in `drivebook-hybrid/utils/validators.js`.
  - Server-side checks prevent invalid dates and out-of-hours bookings.
- **Price & commission**:
  - Voice service booking amount is derived from instructor `hourlyRate` and duration.
  - Commission logic is compatible with the main platform’s payment model.
- **Rate limiting**:
  - Voicemail + message creation uses a database-backed rate limiter per caller number.
  - Prevents abuse and spam via repeated messages.
- **Logging & tracing**:
  - All voice bookings and errors are logged with a `requestId` for cross-system tracing.

---

### 3. Production-Ready Safeguards (Web + Voice)

Across both apps, the following safeguards are in place for production:

1. **Strong validation** (zod)
   - Emails, phones, datetimes and enums are all validated on the server.
2. **Server-side pricing**  
   - Public booking price is recomputed on the server and does **not** trust client amounts.
3. **Rate limiting (Upstash + in-memory fallback)**  
   - Shared `lib/ratelimit.ts` used for:
     - `bookingRateLimit` – single bookings
     - `bulkBookingRateLimit` – package purchases
   - Strict mode for financial endpoints (fail-closed if limiter fails).
4. **Conflict checks**
   - For bulk “book now” flows, every slot is checked for overlaps before creating bookings.
5. **Graceful fallbacks**
   - Calendar push failures do not break booking creation.
   - Voice service errors fall back to voicemail where safe.
6. **Observability**
   - Structured JSON logs with `requestId` fields in both apps.
   - Clear console warnings when rate limiting falls back to in-memory mode in development.

---

### 4. How to Integrate the AI Agent with Web Booking

1. **Read-only lookup**  
   - AI agent uses the voice API (`/api/instructor/lookup`) to find instructors by phone.
2. **Booking creation**  
   - For now, the AI agent uses the voice service’s `/api/bookings` endpoint, which mirrors the single-lesson web booking semantics (instructor, date/time, client details).
3. **Future enhancement (shared booking core)**  
   - Extract shared booking creation logic into a common service module so both:
     - `app/api/public/bookings*` (Next.js app)
     - `drivebook-hybrid` booking APIs  
     call the same core booking function for consistent validation, pricing, and commission.

---

### 5. Client Dashboard & Safety (Overview)

Although this document focuses on public booking, the **client dashboard** is where clients manage what they have booked. Key safety features:

- Access control is enforced in **middleware**:
  - `/client-dashboard/**` is only accessible when the authenticated user’s role is `CLIENT`.
  - Instructors/admins are redirected to their respective dashboards; unauthenticated users are sent to `/login`.
- All client APIs (`/api/client/**`) require a valid NextAuth session and always scope queries by the logged-in user’s `email` or `userId`.
- Wallet and booking APIs:
  - Use **transactional updates** and optimistic locking (wallet `version` and credit checks) to prevent race conditions and double-spend from the wallet.
  - Apply **rate limiting** (via `bulkBookingRateLimit`) to bulk booking creation, protecting against spam or scripted abuse.
- Dashboard pages (`/client-dashboard`, `/client-dashboard/bookings`, `/client-dashboard/wallet`, `/client-dashboard/book-lesson`) handle:
  - Full-screen loading states while fetching `/api/client/profile`, `/api/client/wallet`, etc.
  - Graceful error views if data fails to load.
  - Redirects back to `/login` on unauthenticated sessions for a smooth, safe experience.

---

### 6. Quick Checklist for Production

Before going live with public bookings:

- [ ] Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and server Stripe keys.
- [ ] Configure Upstash Redis (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) for real rate limiting.
- [ ] Verify `HOUR_PACKAGES` and pricing settings in the platform table.
- [ ] Run `npm test` for the voice service and main app integration tests.
- [ ] Test a full public booking flow:
  - Search → select instructor → choose package → register → review → pay → confirm.
  - Check emails, calendar events, wallet/transactions where applicable.

---

### 7. Instructor & Admin Dashboards (High-level Safety Notes)

Although managed in separate docs, it helps to know how instructor/admin areas relate to public bookings:

- **Instructor dashboard (`/dashboard/**`)**
  - Access controlled by `middleware.ts` and `app/dashboard/layout.tsx`:
    - Only `INSTRUCTOR`, `ADMIN`, or `SUPER_ADMIN` roles with a valid `instructorId` can access.
  - Booking APIs used by instructors (`/api/bookings*`) are:
    - Authenticated via NextAuth.
    - Rate-limited using `bookingRateLimit` and `bookingActionRateLimit`.
    - Protected by:
      - State machine validation for cancel/reschedule.
      - Ownership checks (instructor/client/admin).
      - Audit logging for sensitive actions.
  - UI now uses inline **toast notifications** for booking actions instead of blocking browser alerts, improving usability without changing security.

- **Admin dashboard (`/admin/**`)**
  - Access controlled by `middleware.ts`:
    - Only `ADMIN` and `SUPER_ADMIN` roles can reach any `/admin/**` routes; others are redirected away.
  - Admin APIs (`/api/admin/**`) handle:
    - Instructor approval/suspension.
    - Client wallet adjustments and refunds.
    - Payout previews/processing and revenue reporting.
    - Compliance/document review and “fortress” financial dashboards.
  - These APIs:
    - Use authenticated NextAuth sessions.
    - Apply rate limiting via `bulkBookingRateLimit`, `walletRateLimit`, `payoutRateLimit`, etc.
    - Rely on transactions + audit logs to keep financial and compliance operations consistent and traceable.

Public bookings, client dashboards, instructor dashboards, and admin dashboards together form a **single, locked-down flow** from first booking (web or voice) through to instructor payouts and administrative oversight.

