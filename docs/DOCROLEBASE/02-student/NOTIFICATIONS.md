# Student Notifications

**Route:** `/client-dashboard/notifications`  
**Auth required:** CLIENT role  
**APIs:** `GET /api/notifications`, `POST /api/notifications/mark-read`

---

## Bell Icon (Header)

The `NotificationBell` component in `components/ClientNav.tsx` shows:
- A red badge with unread count when `unreadCount > 0`
- A dropdown with the 20 most recent notifications on click
- "Mark all read" button in the dropdown header
- "View all notifications →" link at the bottom of the dropdown

The bell is visible on both desktop nav and mobile header.

---

## Notifications Page

**File:** `app/client-dashboard/notifications/page.tsx`

Full-page list of all notifications ordered by `createdAt DESC`. Features:
- Unread count badge in the page header
- "Mark all read" button (only shown when unread count > 0)
- Each notification links to the relevant page (e.g. booking detail)
- Clicking an unread notification marks it as read
- Empty state: "You're all caught up"

---

## Notification Types

| Type | Trigger | Icon |
|------|---------|------|
| `BOOKING_CONFIRMED` | Booking confirmed after payment | ✅ |
| `BOOKING_CANCELLED` | Booking cancelled by any party | ❌ |
| `BOOKING_RESCHEDULED` | Booking rescheduled | 🔄 |
| `PAYMENT_RECEIVED` | Wallet top-up confirmed | 💰 |
| `LESSON_REMINDER` | 24h before lesson | ⏰ |
| `NEW_MESSAGE` | Message from instructor | 💬 |

---

## Mobile Bottom Nav Badge

The client mobile bottom nav (`components/client/MobileBottomNav.tsx`) shows a red badge dot on the "My Bookings" tab when there are pending reviews (`GET /api/client/pending-reviews` returns items). The badge disappears after all reviews are submitted.

---

## APIs

**`GET /api/notifications`**  
Returns `{ notifications: NotificationItem[], unreadCount: number }` for the logged-in user.

**`POST /api/notifications/mark-read`**  
Body: `{ notificationId: string }` — marks a single notification as read.  
Body: `{}` — marks all notifications as read.

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — Booking detail page (notification links point here)
- `lib/hooks/useNotifications.ts` — Client-side hook used by the bell component
