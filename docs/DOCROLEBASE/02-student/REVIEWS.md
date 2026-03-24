# Student Reviews

**Auth required:** CLIENT role  
**API:** `POST /api/bookings/[id]/review`

---

## Leaving a Review

After a lesson is `COMPLETED`, the student can leave a star rating (1–5) and optional text review.

Stored on the `Booking` model:
- `clientRating` — integer 1–5
- `clientReview` — text (optional)
- `reviewGivenAt` — timestamp

Reviews can only be submitted once per booking. The review form is shown on the booking detail page after the lesson is completed.

---

## Where Reviews Appear

- Instructor's public profile (`/book/[instructorId]`)
- Instructor's subdomain page (`/subdomain/[slug]`)
- Instructor's `averageRating` and `totalReviews` fields are updated on the `Instructor` model when a review is submitted

---

## Admin Moderation

Admins can view and manage reviews via `/admin/reviews`. Reviews are not deleted — they can be flagged or hidden by admin action.

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — Booking lifecycle
- `docs/03-instructor/DASHBOARD.md` — How instructors see their ratings
