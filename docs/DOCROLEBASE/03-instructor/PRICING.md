# Instructor Pricing

**Route:** `/dashboard/settings` (Pricing section)  
**Auth required:** INSTRUCTOR role  
**APIs:** `GET /api/instructor/settings`, `PUT /api/instructor/settings`

> Pricing is configured in the Settings page, not a separate `/pricing` route.

---

## Hourly Rate

The instructor's base rate per hour. Stored as `Instructor.hourlyRate` (Float, AUD).

This rate is used to calculate:
- Single lesson price: `hourlyRate × durationHours`
- Package prices: `hourlyRate × packageHours × (1 − discount)`

---

## Lesson Packages

Instructors can no longer offer legacy pre-defined `lessonPackages`. Instructor-configured packages have been removed; platform-managed PDA test packages remain supported via `offersTestPackage` and related fields.

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

## Legacy Add-on Cleanup

**Status:** ✅ COMPLETE (June 16, 2026)

Instructor **special services** and custom legacy add-ons are **removed** and no longer supported across booking flows. Use the platform PDA test package fields instead.

### Supported pricing only

| Type | Source | How students book |
|------|--------|-------------------|
| **Hourly lessons** | `Instructor.hourlyRate` | Client dashboard, instructor booking API |
| **Bulk packages (6 / 10 / 15 hrs)** | Platform discounts via `PlatformSettings` + `calculatePackagePriceDynamic` | Public/subdomain wizard, `/api/public/bookings/bulk` |
| **PDA test pack** | `PDATestConfig` + `offersTestPackage` / `testPackagePrice` in instructor dashboard settings | `includeTestPackage` toggle in bulk booking; PDA configs in settings |

### Rejected payloads

APIs return `400` if the request includes `specialServiceId`, `specialServiceName`, `specialServiceType`, `customPackageId`, or `customPackagePrice`.


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
