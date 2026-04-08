# Student Reviews

**Route:** `/client-dashboard/reviews`  
**Auth required:** CLIENT role  
**APIs:** `POST /api/reviews`, `GET /api/reviews`, `GET /api/client/pending-reviews`

---

## Leaving a Review

After a lesson has passed (startTime in the past) and the booking is `CONFIRMED` or `COMPLETED`, the student can leave a star rating (1–5) and a written comment.

**Two entry points:**
1. **Bookings page** (`/client-dashboard/bookings`) — a "Leave Review" button (yellow star icon) appears on each completed booking card
2. **Reviews page** (`/client-dashboard/reviews`) — "Pending Reviews" tab lists all completed lessons awaiting a review

**UI:** `components/ReviewModal.tsx` — modal with interactive star rating and comment textarea. Submits to `POST /api/reviews`.

**Rules:**
- One review per booking — once submitted, the button disappears
- Booking must have a past `startTime` — cannot review future lessons
- Only the client who made the booking can review it

**Stored on the `Booking` model:**
- `clientRating` — integer 1–5
- `clientReview` — text comment
- `reviewGivenAt` — timestamp
- `isReviewed` — boolean flag (set to `true` after submission)

---

## Pending Reviews

`GET /api/client/pending-reviews` returns completed past bookings where `isReviewed = false`. The reviews page shows these in the "Pending Reviews" tab so students know which lessons they haven't reviewed yet.

---

## After Submission

On successful review:
- `Booking.isReviewed` set to `true`
- `Instructor.averageRating` and `Instructor.totalReviews` recalculated from all published reviews
- Instructor receives an email notification: "New Review from [Student] — [Rating] stars"
- In-app notification sent to instructor via `notifyReviewReceived()`

---

## Where Reviews Appear

- Instructor's public booking page (`/book/[instructorId]`)
- Instructor's subdomain page (`/subdomain/[slug]`)
- Admin reviews page (`/admin/reviews`) — read-only moderation view

---

## Admin Moderation

Admins can view all reviews via `/admin/reviews`. Reviews are not deleted — they can be flagged or hidden by admin action.

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — Booking lifecycle and the "Leave Review" button
- `components/ReviewModal.tsx` — Review submission modal
- `app/api/client/pending-reviews/route.ts` — Pending reviews API
- `app/api/reviews/route.ts` — Review creation and retrieval
