# Instructor Clients

**Route:** `/dashboard/clients`  
**Auth required:** INSTRUCTOR role  
**File:** `app/dashboard/clients/page.tsx`  
**APIs:** `GET /api/instructor/clients`, `POST /api/instructor/clients`, `PATCH /api/instructor/clients/[id]`

---

## Client List

Shows all clients linked to the instructor. Each client card shows:
- Name, email, phone
- Total lessons booked
- Last lesson date
- Wallet balance (if they have a DriveBook account)
- Quick actions: Book Now, Edit, View History

---

## Add Client

Instructors can manually add clients (e.g. for clients who don't self-register).

Required fields:
- Name
- Email
- Phone

Optional:
- Default pickup address
- Notes

A `Client` record is created linked to the instructor. If the email matches an existing `User`, the client is linked to that account. Otherwise, the client exists without a DriveBook account — they cannot book via the client dashboard until they register.

---

## Edit Client

Instructors can update client details (name, phone, pickup address, notes) from the client detail page.

---

## Book on Behalf

From the client list, instructors can click "Book Now" to create a booking for a specific client. This opens the booking creation form pre-filled with the client's details.

**Requirement:** The client must have a DriveBook account (`client.userId` must exist) and sufficient wallet balance.

If the wallet is insufficient, the instructor can send a payment link to the client's email.

---

## Client History

The client detail page (`/dashboard/clients/[id]`) shows:
- All bookings with this client
- Lesson feedback history
- Performance scores over time
- Total hours driven

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — Creating bookings for clients
- [EARNINGS.md](./EARNINGS.md) — Revenue per client
