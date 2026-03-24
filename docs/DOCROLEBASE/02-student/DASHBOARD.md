# Student Dashboard

**Route:** `/client-dashboard`  
**Auth required:** CLIENT role  
**File:** `app/client-dashboard/page.tsx`

---

## What It Shows

- Welcome message with student name
- Wallet balance (quick view)
- Upcoming bookings (next 3)
- Progress summary (lessons completed, hours logged)
- Quick action buttons: Book a Lesson, Top Up Wallet, View Progress

---

## Navigation

The student dashboard uses a bottom navigation bar (`components/client/MobileBottomNav.tsx`) on mobile with tabs:
- Home
- Book
- Bookings
- Wallet
- Progress

---

## Progress Page

**Route:** `/client-dashboard/progress`  
**File:** `app/client-dashboard/progress/page.tsx`

Re-exports from `/dashboard/progress/page`. Calls `GET /api/client/my-performance` to fetch:
- Total lessons completed
- Total hours driven
- Performance scores per lesson
- Instructor feedback codes (PDA categories)
- Strengths and focus areas

---

## Help Page

**Route:** `/client-dashboard/help`  
**File:** `app/client-dashboard/help/page.tsx`

Static FAQ accordion with 6 categories:
1. Booking & Scheduling
2. Payments & Wallet
3. Cancellations & Refunds
4. Instructor & Lessons
5. Account & Profile
6. Technical Issues

Includes a contact section linking to `drivebook.com.au/contact`.

---

## Related

- [WALLET.md](./WALLET.md) — Wallet top-up and balance
- [BOOKINGS.md](./BOOKINGS.md) — Booking management
- [SETTINGS.md](./SETTINGS.md) — Profile settings
