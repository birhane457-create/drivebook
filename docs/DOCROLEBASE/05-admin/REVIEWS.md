# Admin Reviews

**Route:** `/admin/reviews`  
**Auth required:** ADMIN or SUPER_ADMIN  
**File:** `app/admin/reviews/page.tsx`  
**Data source:** `Booking` model fields — `clientRating`, `clientReview`, `isReviewed`, `reviewGivenAt`

---

## What It Shows

Stats row:
- Total reviews
- Average rating (⭐)
- 5-star count
- 1–2 star count

Review table (last 100, ordered by `reviewGivenAt DESC`):
- Star rating (★★★★★ visual)
- Student name
- Instructor name
- Review comment (truncated)
- Date submitted

---

## Data Model

Reviews are NOT stored in a separate `Review` model. They are stored directly on the `Booking` record:

| Field | Type | Description |
|-------|------|-------------|
| `clientRating` | `Int?` | 1–5 star rating |
| `clientReview` | `String?` | Written comment |
| `isReviewed` | `Boolean` | Set to `true` after submission |
| `reviewGivenAt` | `DateTime?` | Timestamp of submission |

The page queries `Booking` where `isReviewed = true` and `clientRating != null`.

---

## Moderation

Reviews are currently read-only in the admin. There is no hide/flag/delete action in the UI.

The `Instructor.averageRating` and `Instructor.totalReviews` fields are recalculated automatically when a student submits a review via `POST /api/reviews`.

---

## Related

- [INSTRUCTOR_APPROVALS.md](./INSTRUCTOR_APPROVALS.md) — Instructor profile shows review count and average rating
- `app/api/reviews/route.ts` — Student review submission
- `app/api/client/pending-reviews/route.ts` — Pending reviews for students
