# Notifications — SMS & Email Reference

**Last updated:** April 2026

---

## SMS Policy

| Event | Student SMS | Instructor SMS |
|-------|-------------|----------------|
| Booking confirmed (Stripe payment) | ✅ 1x confirmation | ❌ None — in-app only |
| 24hr lesson reminder (cron) | ✅ 1x reminder | ✅ 1x reminder |
| Offline booking created | ❌ None | ❌ None |
| Offline 24hr reminder (cron) | ✅ 1x (to `clientPhone` if provided) | ✅ 1x (to instructor phone) |

**Total SMS per platform booking:** 2 (student) — 1 confirmation + 1 reminder  
**Total SMS per offline booking:** 1 (student, reminder only) + 1 (instructor, reminder only)

Instructor never receives a confirmation SMS — they get an in-app notification instead. This avoids noise for instructors who may have many bookings per day.

---

## Email Policy

| Event | Student Email | Instructor Email |
|-------|---------------|-----------------|
| Booking confirmed (Stripe) | ✅ Receipt email | ❌ In-app only |
| Instructor creates booking (wallet) | ✅ Receipt email | ❌ In-app only |
| Wallet top-up | ✅ Receipt email | — |
| Package purchase | ✅ Receipt email | — |
| 24hr lesson reminder (cron) | ✅ In-app notification | ✅ In-app notification |
| Offline 24hr reminder (cron) | ✅ Direct email (to `clientEmail` if provided) | ✅ In-app notification |
| Booking cancelled | ✅ Cancellation email | ❌ In-app only |
| Insufficient wallet — top-up request | ✅ "Top up to confirm" email | — |
| Review received | — | ✅ Review notification email |
| Document expiring | — | ✅ Expiry warning email |

---

## Implementation Files

| Component | File |
|-----------|------|
| SMS service | `lib/services/sms.ts` |
| Email service | `lib/services/email.ts` |
| In-app notifications | `lib/services/notifications.ts` |
| Lesson reminders cron | `app/api/cron/lesson-reminders/route.ts` |
| Booking confirmation SMS (webhook) | `app/api/stripe/webhook/route.ts` |
| Receipt emails | `lib/services/receipt-email.ts` |

---

## SMS Methods in `sms.ts`

| Method | Sends to | When |
|--------|----------|------|
| `sendBookingConfirmation()` | Student only | Stripe webhook — payment confirmed |
| `sendLessonReminderStudent()` | Student | 24hr cron |
| `sendLessonReminderInstructor()` | Instructor | 24hr cron |
| `sendCheckInNotification()` | Student | Check-in (mobile) |
| `sendCheckOutNotification()` | Student | Check-out (mobile) |
| `sendDisputeAlert()` | Admin | Dispute raised |
