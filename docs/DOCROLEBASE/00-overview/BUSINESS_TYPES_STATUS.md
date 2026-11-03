# Business Types — Current Status

**Finding:** APP-H-07  
**Status:** DOCUMENTED  
**Date:** 2026-08-15

---

## Summary

The `Provider.businessType` field accepts multiple values, but only `INDIVIDUAL` is fully functional in production. The `DRIVING_SCHOOL` and `CORPORATE` types exist in the schema and data model but their multi-instructor management features are not implemented.

---

## businessType Values

| Value | Status | Notes |
|-------|--------|-------|
| `INDIVIDUAL` | ✅ Fully operational | Default. Single instructor, sole trader or ABN-holder. All features work. |
| `DRIVING_SCHOOL` | ⚠️ Partial — Phase 2 | School entity exists in DB; multi-instructor management, shared calendar, staff accounts not implemented. Current workaround: schools register as individual instructor accounts. |
| `CORPORATE` | ⚠️ Stub only | Schema field only. No differentiated behaviour in any route. Treated identically to INDIVIDUAL at runtime. |

---

## Business Configuration Models

`prisma/business-config-schema.prisma` defines the following models for Business configuration. These models exist in the schema but their use in production depends on whether the data migration has been run.

| Model | Purpose | Status |
|-------|---------|--------|
| `Business` | Core entity linking to Provider | Schema present |
| `BusinessBranding` | Custom logo, colours, domain | Schema present |
| `BusinessDomain` | Custom subdomain for white-label booking page | Schema present |
| `BusinessCapabilities` | Feature flags per business | Schema present |
| `BusinessService` | Offered services (e.g. manual, automatic, automatic electric) | Schema present |
| `BusinessTerminology` | Custom label overrides (e.g. "lesson" → "session") | Schema present |

---

## Registration Flow — Manual Recovery

At provider registration, `createBusinessFromTemplate()` runs **outside** the main `prisma.$transaction`. If it fails:

- The User, Provider, and Subscription rows are committed (the transaction already succeeded)
- The Business configuration rows may be absent
- `Provider.businessId` will remain NULL (the relationship is set at the end of `createBusinessFromTemplate`)
- The provider account is functional (bookings, payments, payouts all work)
- Business configuration features (branding, custom domain, Business website) will be unavailable until manually repaired

**Detection:** A Provider with no corresponding `Business` row is in a partially-initialised state. Query:

```sql
SELECT p.id, p.name, p."businessId"
FROM "Provider" p
LEFT JOIN "Business" b ON b.id = p."businessId"
WHERE p."businessId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "Business" b2
    WHERE b2.id = ('biz_' || p.id) AND b2."isActive" = true
  );
```

**Repair (manual — no admin panel endpoint exists):**

Recovery currently requires an operator-run script or engineering intervention. There is no admin panel or automated cron that triggers repair.

To repair a specific Provider:

1. Identify the affected Provider ID (see detection query above).
2. Load the appropriate template config for the Provider's business type.
3. Call `createBusinessFromTemplate(prisma, 'biz_' + providerId, providerId, config)`.
   - The function uses `upsert` for Business records — safe to re-run without duplication.
   - The `$executeRaw` sets `Provider.businessId` only if it is currently NULL — safe to re-run.
4. Verify the relationship afterward:

```sql
SELECT id, "businessId" FROM "Provider" WHERE id = '<providerId>';
-- Expected: businessId = 'biz_<providerId>'
```

---

## When DRIVING_SCHOOL / CORPORATE Features Will Be Available

This is a Phase 2 product feature. The design is tracked in `docs/newplan/BUSINESS_TIER_DEEP_INVESTIGATION.md` and related files. No timeline is set. Until these features ship, new schools should register as `INDIVIDUAL` providers.

---

## Related

- `prisma/business-config-schema.prisma` — Model definitions
- `docs/newplan/BUSINESS_TIER_STATUS_AND_PLAN.md` — Phase 2 roadmap
- `docs/newplan/BUSINESS_TO_PREMIUM_SUMMARY.md` — Subscription tier implications
