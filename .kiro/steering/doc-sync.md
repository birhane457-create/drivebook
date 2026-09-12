---
inclusion: always
---

# Documentation Sync — Standing Instruction

The DOCROLEBASE docs (`docs/DOCROLEBASE/`) are **living state documents**, not changelogs or session logs.

Every doc describes what the system does **right now**. Not what was planned. Not what changed last week. Not "as of [date]". Just: what is true today.

---

## The Rule

**When you change code, you change the doc in the same session.**

No exceptions. A code change without a matching doc update is incomplete work.

---

## What "Update the Doc" Means

It means rewriting the relevant section to reflect the new reality — same as if the doc had always been written that way.

**Correct:**
> The `POST /api/public/bookings/bulk` endpoint returns a `voice` object with 9 fields: `instructor`, `package`, `packageHours`, `scheduledHours`, `scheduledLessons`, `remainingHours`, `firstLesson`, `paymentRequired`, `confirmation`.

**Wrong:**
> ~~We added a `voice` object to the bulk API response in August 2026. It now contains...~~

The second form is a changelog entry. This is not a changelog. Rewrite the whole section if needed.

---

## Doc Ownership Map

Each area of the codebase maps to a specific DOCROLEBASE file. When you change code in that area, update the corresponding doc.

| Code area | Primary doc |
|-----------|-------------|
| `app/api/public/bookings/bulk/route.ts` | `01-public/BOOKING_FLOW_COMPLETE.md` |
| `app/api/stripe/webhook/route.ts` | `08-technical/WEBHOOKS.md` |
| `app/subdomain/[slug]/page.tsx` | `01-public/SUBDOMAIN_PAGE.md` |
| `app/book/[instructorId]/page.tsx` | `01-public/BOOKING_FLOW_COMPLETE.md` |
| `app/api/instructor/branding/` | `03-instructor/BRANDING.md` |
| `app/api/instructor/subscription/` | `07-subscriptions/TIERS.md`, `07-subscriptions/BILLING.md` |
| `app/api/instructor/domain/` | `docs/SUBDOMAIN_SYSTEM.md` |
| `app/api/admin/` | `05-admin/` folder — relevant file |
| `app/dashboard/` | `03-instructor/DASHBOARD.md` or specific page doc |
| `lib/utils/account.ts` | `platform-model.md` (this repo's steering), `00-overview/GLOSSARY.md` |
| `lib/branding/getDisplayIdentity.ts` | `01-public/SUBDOMAIN_PAGE.md`, `03-instructor/BRANDING.md` |
| `lib/services/email.ts` | `03-instructor/NOTIFICATIONS.md` (if exists) or BOOKING_FLOW_COMPLETE |
| `lib/services/receipt-email.ts` | `06-payments/RECEIPTS.md` |
| `lib/services/platform-pricing.ts` | `06-payments/COMMISSIONS.md` |
| `lib/config/subscriptions.ts` | `07-subscriptions/TIERS.md` |
| `lib/config/packages.ts` | `06-payments/COMMISSIONS.md` |
| `prisma/schema.prisma` (new model or field) | `08-technical/CODEBASE_MAP.md`, `00-overview/GLOSSARY.md` |
| `components/DashboardNav.tsx` | `docs/NAVIGATION_ARCHITECTURE.md` |
| `components/SubscriptionPlans.tsx` | `07-subscriptions/TIERS.md`, `03-instructor/SUBSCRIPTION_TIERS.md` |
| `.kiro/steering/platform-model.md` | Update in place when platform model changes |

---

## Before Writing the Doc Update

1. **Read the current doc section first** — do not write from memory
2. **Verify the code** — read the actual file, not an assumption about what it does
3. **Rewrite the section** — not append, not annotate. Replace the stale content with current content
4. **Check for stale cross-references** — if you changed `Provider.subscriptionTier`, also check any doc that references that field name

---

## Doc Quality Standard

A doc section passes quality when:

- [ ] It describes what the code does now, not what it used to do
- [ ] No field names, model names, or tier names are out of date
- [ ] Status markers are accurate: "Live", "Phase 2", "Coming Soon" — not guessed
- [ ] API response shapes match what the route actually returns
- [ ] Feature flags and tier gates match `lib/utils/account.ts`

---

## What NOT to Do

- Do not create a new markdown file to document a change — update the existing DOCROLEBASE file
- Do not add a "Last updated: [date]" or "Changed in session X" header — the doc is always current, dates add noise
- Do not add "Note: as of August 2026..." qualifiers — just write the current truth
- Do not leave a `TODO: update docs` comment — do it now, in this session
- Do not summarise what changed in the doc — describe what is

---

## The `docs/newplan/` Exception

The `docs/newplan/` folder contains planning notes and investigation docs. These are **not** living state docs — they are planning artifacts and do not need to be kept current. Do not update them when code changes. They can be ignored.

The only living docs are:
- `docs/DOCROLEBASE/**` — canonical reference for all platform behaviour
- `.kiro/steering/**` — standing instructions for this AI agent
- `docs/NAVIGATION_ARCHITECTURE.md` — nav structure reference

---

## Example: What a Correct Doc Update Looks Like

**Code change:** Added `provider?` parameter to `sendPackagePurchaseReceipt()` in `lib/services/receipt-email.ts`

**Wrong doc update (changelog style):**
> We added `provider?: {name, businessName}` to `sendPackagePurchaseReceipt` in August 2026 to support white-label.

**Correct doc update (state style) in `06-payments/RECEIPTS.md`:**
> ### sendPackagePurchaseReceipt
>
> Accepts `provider?: { name: string; businessName?: string | null }` alongside `instructorName: string`. When `provider` is supplied, calls `getDisplayName(provider)` to resolve the display name. `instructorName` is a legacy fallback for callers that don't have a full provider object.
