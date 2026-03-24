# Instructor Pricing

**Route:** `/dashboard/settings/pricing` (or `/dashboard/pricing`)  
**Auth required:** INSTRUCTOR role  
**APIs:** `GET /api/instructor/profile`, `PATCH /api/instructor/profile`

---

## Hourly Rate

The instructor's base rate per hour. Stored as `Instructor.hourlyRate` (Float, AUD).

This rate is used to calculate:
- Single lesson price: `hourlyRate × durationHours`
- Package prices: `hourlyRate × packageHours × (1 − discount)`

---

## Lesson Packages

Instructors can offer pre-defined packages. Stored as `Instructor.lessonPackages` (JSON).

Default package discounts (configurable via `/admin/pricing`):
| Package | Hours | Default Discount |
|---------|-------|-----------------|
| Starter | 6h | 5% |
| Standard | 10h | 10% |
| Intensive | 15h | 12% |

The `discountPaidBy` setting in `PlatformSettings` determines who absorbs the discount:
- `platform` — platform takes a smaller commission
- `instructor` — instructor receives less per lesson
- `shared` — split between platform and instructor

---

## Allowed Durations

`Instructor.allowedDurations` — the lesson lengths the instructor offers (e.g. 60, 90, 120 minutes). Students can only select from these durations when booking.

---

## Driving Test Package

A special package for students preparing for their driving test. Default price: $225 (configurable via `/admin/pricing` → `drivingTestPackagePrice`).

---

## Commission

The platform's commission is NOT set by the instructor — it is determined by their subscription tier and configured by the admin via `/admin/pricing`.

| Tier | Commission | Instructor Keeps |
|------|-----------|-----------------|
| BASIC | 15% | 85% |
| PRO | 12% | 88% |
| BUSINESS | 10% | 90% |

See `docs/06-payments/COMMISSIONS.md` for full details.

---

## Related

- [EARNINGS.md](./EARNINGS.md) — How earnings are calculated
- `docs/06-payments/COMMISSIONS.md` — Commission rates
- `docs/05-admin/SETTINGS.md` — Admin pricing configuration
