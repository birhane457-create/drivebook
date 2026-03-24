# Admin Reviews

**Route:** `/admin/reviews`
**Auth required:** ADMIN or SUPER_ADMIN
**File:** `app/admin/reviews/page.tsx`

---

## Overview

Read-only view of all reviews on the platform. Shows moderation status (published / hidden / flagged). Currently a display-only page — no publish/unpublish/delete actions are wired in the UI. Moderation actions would need to be added.

---

## Stats

| Stat | Description |
|------|-------------|
| Total Reviews | All reviews ever submitted |
| Published | `isPublished = true` |
| Flagged | `isFlagged = true` |
| Avg Rating | Mean star rating across all reviews |

---

## Review List

Shows the 50 most recent reviews ordered by `createdAt DESC`.

**Mobile:** Card layout — rating stars, client name, instructor name, date, status badges, comment (truncated to 3 lines).

**Desktop:** Table layout — Rating, Client, Instructor, Comment (truncated), Date, Status.

### Status badges

| Badge | Condition |
|-------|-----------|
| Published (green) | `isPublished = true` |
| Hidden (grey) | `isPublished = false` |
| Flagged (red) | `isFlagged = true` — shown in addition to published/hidden |

---

## Current Limitations

- No publish/unpublish toggle in the UI
- No delete action
- No response/reply from instructor
- No pagination (capped at 50)
- No filter by instructor or rating

These are known gaps. The data model supports `isPublished` and `isFlagged` — the UI just doesn't expose the write operations yet.

---

## Data Model

```
Review {
  id
  rating        Int (1–5)
  comment       String?
  isPublished   Boolean
  isFlagged     Boolean
  createdAt     DateTime
  instructor    → Instructor
  client        → Client
}
```

---

## Related

- `docs/02-student/REVIEWS.md` — How clients submit reviews
- `docs/03-instructor/DASHBOARD.md` — How instructors see their reviews
