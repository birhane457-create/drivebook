# Instructor Clients

**Route:** `/dashboard/clients`  
**Auth required:** INSTRUCTOR role  
**File:** `app/dashboard/clients/page.tsx`  
**APIs:** `GET /api/clients`, `POST /api/clients`, `PUT /api/clients/[id]`, `GET /api/instructor/clients/[id]`

---

## Client List

Shows all clients linked to the instructor. Each row shows:
- Name, phone, email
- "No account" amber badge if `client.userId` is null
- Eye icon → `/dashboard/clients/[id]` (client detail page)
- Calendar icon → `/dashboard/bookings/new?clientId=[id]` (book now)
- Edit icon → inline expand for editing

Expandable row shows: email, address, notes, "No account" explanation, "Book Now" button.

---

## Client Detail Page

**Route:** `/dashboard/clients/[id]`  
**File:** `app/dashboard/clients/[id]/page.tsx`  
**API:** `GET /api/instructor/clients/[id]`

Shows:
- Contact info (name, phone, email, address, notes)
- Account status (registered / no account)
- Wallet balance (computed from confirmed credit/debit transactions — only shown if client has a DriveBook account)
- Stats: total bookings, total spend on completed lessons
- Booking history (last 20 bookings with status badges, each links to `/dashboard/bookings/[id]`)
- "Book Now" button
- "Send Payment Link" button (only shown if client has a DriveBook account)

The API is scoped — only returns clients belonging to this instructor. Returns 404 otherwise.

---

## Add Client

Instructors can manually add clients from the clients list page.

Required: name, email, phone.  
Optional: default pickup address, notes.

A `Client` record is created linked to the instructor. If the email matches an existing `User`, the client is linked to that account. Otherwise, a dormant `User` account is created with a random password — the client cannot log in until they set their password via the link sent when the instructor first books a lesson for them.

---

## Edit Client

Inline edit from the clients list (expand row → edit icon). Fields: name, phone, address, notes.

Email cannot be edited if the client has a DriveBook account (`client.userId` is set) — they must change it through their own account settings.

---

## Send Payment Link

When a client's wallet is insufficient for a booking, the instructor can send a payment link from:
- The booking detail page (when `status = PENDING_PAYMENT`)
- The client detail page

**API:** `POST /api/bookings/send-payment-link`

Sends the client an email with a pre-filled wallet top-up link showing the lesson cost breakdown and a direct link to their wallet page.

---

## No Account Clients

If `client.userId` is null:
- Amber "No account" badge shown in the client list
- Booking is created as `PENDING_PAYMENT` (no wallet deduction)
- Client receives a "claim your account" email with a pre-filled registration link
- Once registered, they can confirm the booking from their dashboard

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — Creating bookings for clients
- [EARNINGS.md](./EARNINGS.md) — Revenue per client
