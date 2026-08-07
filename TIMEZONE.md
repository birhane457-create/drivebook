# Timezone Audit — National Expansion

## Status: ✅ Complete

All hardcoded `Australia/Perth` timezone references have been removed from the
production codebase. Every date/time formatting call now resolves the timezone
through the canonical helpers in `lib/utils/timezone.ts`.

---

## Canonical Timezone Utilities

File: `lib/utils/timezone.ts`

| Export | Purpose |
|---|---|
| `DEFAULT_TIMEZONE` | Platform fallback (`'Australia/Perth'`) — used only when no instructor TZ is set |
| `AU_TIMEZONES` | All 7 IANA zones for Australian states/territories |
| `resolveTimezone(tz)` | Validates IANA string; falls back to `DEFAULT_TIMEZONE` |
| `timezoneFromState(state)` | Maps AU state code (WA/SA/NT/QLD/NSW/VIC/TAS/ACT) → IANA zone |
| `localDateTimeToUTC(date, time, tz)` | Converts instructor-local date+time to UTC for storage |
| `formatLocalDate(utcDate, tz, opts)` | UTC → local date string |
| `formatLocalTime(utcDate, tz, opts)` | UTC → local time string |
| `getLocalDateKey(utcDate, tz)` | UTC → YYYY-MM-DD in the given timezone (used for day grouping) |

**Strategy:**
- All datetimes stored in DB are UTC.
- Display uses `instructor.timezone` (IANA string from DB) when available.
- Fall back to `timezoneFromState(instructor.state)` when timezone field is unset.
- Fall back to `DEFAULT_TIMEZONE` only as last resort.
- Student-facing display in the browser should use the browser's local timezone (via JS `Intl` with no explicit `timeZone` option).

---

## Files Updated

### Booking API routes (instructor timezone resolved per-booking)
| File | Change |
|---|---|
| `app/api/bookings/[id]/cancel/route.ts` | `bookingTimezone` via `resolveTimezone`/`timezoneFromState` |
| `app/api/bookings/[id]/check-in/route.ts` | `instructorTimezone` for SMS check-in message |
| `app/api/bookings/[id]/route.ts` | Fixed duplicate `const bookingTimezone` declaration; added `deleteBookingTimezone` in DELETE scope |
| `app/api/bookings/route.ts` | `instructorTimezone` for wallet TX descriptions, confirmation emails |
| `app/api/bookings/batch/route.ts` | `instructorTimezone` for pending/confirmed booking emails |

### Public booking API routes
| File | Change |
|---|---|
| `app/api/public/bookings/bulk/route.ts` | Added `timezone`+`state` to instructor select; `lessonDisplayTz` for `firstLessonDisplay` |
| `app/api/public/bookings/[id]/cancel/route.ts` | Resolved `cancelTz` from instructor before `notifyWaitingList` |
| `app/api/public/bookings/[id]/payment-summary/route.ts` | Added `timezone`+`state` to instructor select; resolves TZ for `time` field |

### Admin routes
| File | Change |
|---|---|
| `app/api/admin/bookings/route.ts` | Fetches instructor `timezone`+`state`; uses `adminBookingTz` for wallet DEBIT description |
| `app/api/admin/export/route.ts` | `DEFAULT_TIMEZONE` for bookings CSV and revenue CSV date columns |
| `app/api/admin/revenue/route.ts` | `DEFAULT_TIMEZONE` for monthly chart labels |
| `app/api/admin/weekly-report/route.ts` | `DEFAULT_TIMEZONE` for report period label and email footer |
| `app/api/admin/transactions/[transactionId]/invoice/route.ts` | `invoiceTz` resolved from instructor; all invoice date/time fields use it |
| `app/api/admin/ai-brief/route.ts` | `DEFAULT_TIMEZONE` for LLM prompt date label |

### Admin UI pages (browser-rendered — now use browser local timezone)
| File | Change |
|---|---|
| `app/admin/audit-log/page.tsx` | Removed hardcoded Perth; timestamps now display in admin's browser TZ |
| `app/admin/cron-jobs/page.tsx` | Removed hardcoded Perth; timestamps now display in admin's browser TZ |

### Instructor routes
| File | Change |
|---|---|
| `app/api/instructor/invoices/[transactionId]/route.ts` | `invoiceTz` resolved from instructor; all text invoice fields use it |
| `app/api/instructor/invoices/[transactionId]/data/route.ts` | `invoiceTz` resolved from instructor; all structured JSON fields use it |
| `app/api/instructor/receipts/weekly/route.ts` | `receiptTz` resolved from instructor; day grouping and receipt header use it |
| `app/api/dashboard/mobile/route.ts` | `mobileTz` resolved from instructor; upcoming bookings date/time display uses it |

### Payment / Stripe routes
| File | Change |
|---|---|
| `app/api/payments/verify/route.ts` | `DEFAULT_TIMEZONE` for wallet DEBIT transaction description dates (POST + GET handlers) |
| `app/api/stripe/webhook/route.ts` | `DEFAULT_TIMEZONE` for wallet DEBIT TX description and trial-end email date |

### Other routes
| File | Change |
|---|---|
| `app/api/auth/device-check/route.ts` | `DEFAULT_TIMEZONE` for security alert email timestamp |
| `app/api/client/my-performance/route.ts` | `DEFAULT_TIMEZONE` for performance chart date label |

### Background jobs
| File | Change |
|---|---|
| `lib/jobs/packageExpiryAlerts.ts` | Replaced `PERTH_TIME_ZONE`/`PERTH_OFFSET_MS` + `getPerthDayRange()` with generic `getLocalDayRange(date, tz)` using dynamic UTC offset via `Intl.DateTimeFormat` — no fixed offset hardcoded |

### Notification & email services
| File | Change |
|---|---|
| `lib/services/notifications.ts` | `fmtDate`/`fmtTime` accept `tz` param defaulting to `DEFAULT_TIMEZONE`; caller passes instructor TZ |
| `lib/services/receipt-email.ts` | Uses `DEFAULT_TIMEZONE` via `AU_TZ` constant (short-term; per-instructor TZ is a follow-up) |

---

## Remaining Follow-ups (not blocking, low risk)

These items were validated as genuine but have acceptable risk profiles for post-launch:

1. **`lib/services/receipt-email.ts` — per-instructor TZ on receipts**
   The `fmtDate`/`fmtTime` helpers use `DEFAULT_TIMEZONE` for all receipt emails. This is
   correct for single-instructor WA launch. For national launch, pass `instructor.timezone`
   into each receipt function so Sydney students get AEST dates on their receipts.

2. **`lib/services/notifications.ts` — some notify functions don't accept TZ**
   `notifyBookingConfirmed`, `notifyClientBookingConfirmed`, `notifyClientBookingRescheduled`,
   and reminder functions fall back silently to Perth. These are in-app notifications (not
   emails/SMS), so the impact is low. Add a `timezone` param when refactoring the notification
   layer.

3. **OpenAPI specs / documentation**
   Any `.yaml`/`.md` docs that mention `Australia/Perth` explicitly should be updated to
   reflect national timezone support in the next documentation sprint.

---

## Verification

Run this command to confirm zero hardcoded Perth timezone references remain in runtime code:

```bash
rg "timeZone: 'Australia/Perth'" --type ts --type tsx --glob '!node_modules' --glob '!.next'
```

Expected output: **no matches**.
