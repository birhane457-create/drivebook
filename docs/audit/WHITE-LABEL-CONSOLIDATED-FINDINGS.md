# DriveBook — Consolidated White-Label and Account-Separation Audit

**Status:** CONSOLIDATION BASELINE — findings have not yet completed independent verification  
**Created:** 2026-10-26  
**Branch:** `audit/white-label-findings-consolidation`  
**Base commit:** `5945d0378e9998e5eb58f9f3ce10e73b0da73362`  
**Authority:** `docs/audit/AUDIT-MASTER-TRACKER.md` remains the only authoritative lifecycle tracker.  
**Process:** Follow `docs/audit/AUDIT-PROCESS.md`. Every new finding starts at FINDING and must independently progress through VERIFIED → FIX → FIX-VERIFIED → CLOSED.  
**Scope:** Consolidate relevant Kimi, Claude and GPT source-review claims into a deduplicated worklist. This is not a claim that the application or production payment flows have been runtime-tested.

## 1. Consolidation rules

1. Preserve historical IDs such as `BRAND-V-xx`, `MM-10-A` and existing payment findings. Do not silently replace, rename, or reopen them.
2. Historical findings already CLOSED, FIX-VERIFIED, INVALIDATED, REJECTED or SUPERSEDED retain their recorded status until new evidence justifies a lifecycle action.
3. New IDs below are provisional consolidation IDs. The master tracker is authoritative; these are not yet VERIFIED.
4. A source observation, test file, commit, or report from another auditor is not proof of runtime behaviour.
5. Payment-mode activation is out of scope for this consolidation and remains blocked pending payment-flow and wallet/ledger verification.
6. Use synthetic/test accounts for runtime tests. Do not run destructive or financial tests against production without explicit approval and a safe test plan.

## 2. New consolidated findings

**Lifecycle status:** WLA-001 is now VERIFIED by independent source inspection. All other rows remain at FINDING pending their own verification. Priority is triage guidance, not a completed risk assessment.

| ID | Priority | Consolidated finding | Preliminary source evidence | Verification required | Origin |
|---|---|---|---|---|---|
| WLA-001 | P1 | DIRECT mode is assigned to non-driving registrations; quote checkout does not enforce the same DIRECT-mode block as the guarded booking/wallet routes. | `app/api/register/route.ts` sets `paymentMode = 'DIRECT'` when `businessType !== 'driving'`; `app/api/client/quotes/[id]/accept/route.ts` calls `createCheckoutSession()` without checking `paymentMode`; `lib/services/saas-payment.ts` checks `businessConfig.paymentModel === 'saas'` but does not guard `provider.paymentMode`; `create-intent` and bulk booking do contain inline DIRECT guards. `assertPlatformPaymentMode()` has no call sites in the inspected files. | **VERIFIED — source inspection.** Confirmed unsupported DIRECT is assignable and the quote checkout path lacks the DIRECT-mode guard used in the other inspected payment routes. Runtime/Stripe behaviour not tested. Next: add targeted tests and inspect all other payment entry points before FIX. | Claude + GPT |
| WLA-002 | P1 | SaaS quote Checkout may create a platform charge without a corresponding provider payable, transfer, or complete ledger entry in the `saas_booking` webhook branch. | `lib/services/saas-payment.ts`; `app/api/stripe/webhook/route.ts` | Trace a test-mode payment from Checkout Session through webhook, Stripe balance, ledger, provider payable/payout, refund and reconciliation. Establish whether this is a code omission or handled elsewhere. | Claude |
| WLA-003 | P1 | Quote checkout may return customers to a nonexistent or incorrect customer-dashboard route. | `lib/services/saas-payment.ts`; current customer dashboard route tree | Confirm route existence and exercise success/cancel return URLs in test mode. | Claude |
| WLA-004 | P2 | `application_fee_amount` may be set without the required connected-account charge context for the intended Stripe Connect charge type. | `lib/services/saas-payment.ts` and Stripe request construction | Confirm exact request parameters and charge type; run a controlled Stripe test-mode transaction; inspect Stripe API response. Do not classify as a Stripe rejection before test evidence. | Claude |
| WLA-005 | P1 | Instructor-client views may expose the customer's aggregate wallet balance rather than credit attributable to the instructor/provider. | `app/api/instructor/clients/[id]/route.ts`; `ClientWallet` and `WalletTransaction` schema | Confirm response fields and consumers; decide product semantics; test cross-provider balance visibility. Distinguish intended shared marketplace wallet from provider-owned credit. | Claude + GPT |
| WLA-006 | P1 | Custom-domain verification may treat Vercel `domain_already_in_use` / `domain_already_exists` responses as proof of ownership. | `app/api/instructor/domain/verify/route.ts` | Trace verification branches and distinguish provider/project registration from verified domain control; test safe mocked responses and conflicting domain claims. | Claude |
| WLA-007 | P1 | Domain ownership may not be protected against concurrent claims or conflicts across Provider and BusinessDomain records. | `prisma/schema.prisma`; `app/api/instructor/domain/verify/route.ts`; business-domain routes | Inspect all domain models and constraints; run concurrent claim tests against isolated test DB; verify uniqueness across all supported domain stores. | Claude + Kimi |
| WLA-008 | P1 | Cross-provider tenant isolation is not demonstrated across all ID-taking routes, files, signed URLs, exports, reports, calendars, jobs and business staff roles. | Repository-wide route/service inventory still required; see existing RBAC and audit records before creating sub-findings | Build complete inventory; trace ownership checks at each server boundary; execute Provider A/B negative-access tests. Split into granular findings only when evidence identifies distinct defects. | Kimi + Claude |
| WLA-009 | P2 | PREMIUM entitlement may differ between the driving-specific public renderer and account feature policy. | `app/subdomain/[slug]/page.tsx`; `lib/utils/account.ts` | Verify current feature helper and renderer gate; test BASIC, PRO, STUDIO and PREMIUM outputs; compare UI and server entitlements. Check historical BRAND-V-05 before deciding whether this is a new finding or residual/regression. | Kimi + GPT |
| WLA-010 | P1 | Custom-domain middleware may rewrite legitimate application paths such as booking, privacy or terms to the generic custom-domain page. | `middleware.ts`; `components/website/BusinessWebsitePage.tsx`; `app/custom-domain/page.tsx` | Enumerate all required public paths and middleware exemptions; test HTTP status, final route and response on subdomain, custom domain and primary domain. Check historical BRAND-V-08 and related findings before creating overlapping sub-findings. | GPT |
| WLA-011 | P2 | Host classification may use substring matching rather than exact host / validated subdomain boundaries. | `middleware.ts` | Test primary domain, valid subdomains, deceptive suffix/prefix hosts, case and port handling; confirm exact source condition. | GPT |
| WLA-012 | P2 | BusinessDomain custom-domain fallback may pass a business ID into a provider lookup expecting provider ID or custom slug. | `app/custom-domain/page.tsx`; `lib/website/fetchProviderWebsiteData.ts`; `lib/core/business-config.ts` | Trace IDs end-to-end for Provider-domain and BusinessDomain-only records; add isolated route tests; verify whether the path is reachable in production configuration. | GPT |
| WLA-013 | P2 | Public branding metadata may remain globally DriveBook-branded instead of being resolved per provider host. | `app/layout.tsx`; public subdomain/custom-domain renderers | Inspect title, metadataBase, canonical URL, Open Graph, favicon, JSON-LD and analytics. Test rendered HTML for DriveBook host and provider host; decide which platform-level disclosures must remain. | Kimi + GPT |
| WLA-014 | P2 | Provider branding has two stores and multiple write paths that may diverge. | `Provider`; `BusinessBranding`; `app/api/instructor/branding/route.ts`; `app/api/business/branding/route.ts`; config assembler | Reconcile historical BRAND-V-07 and related closed evidence first. Identify any remaining divergent fields and prove with current code/runtime tests before reopening or splitting. | Kimi + GPT |
| WLA-015 | P2 | Customer communications may retain DriveBook sender, support, receipt or footer identity in a provider-branded journey. | `lib/services/receipt-email.ts`; other email/SMS templates and sender configuration | Inventory booking/payment/refund/cancel/reschedule templates, sender identities, reply-to addresses, links and SMS sender. Compare actual rendered messages to the white-label contract. | Kimi + Claude + GPT |
| WLA-016 | P2 | Customer/provider portal identity and business account operations may not support full independent branding, staff roles, suspension and closure semantics. | Dashboard/login routes, account model and permissions require systematic inventory | Define product contract first; map every portal surface and lifecycle operation; test account isolation and safe deactivation. Keep separate from WLA-008 unless evidence proves overlap. | Kimi + Claude |
| WLA-017 | P1 | Trust may be placed in a caller-controlled `x-custom-domain` header without proving the host-to-provider mapping at the trusted ingress. | Middleware and any consumers of `x-custom-domain` | Trace where the header is set, overwritten and consumed; test spoofed incoming header on supported deployments. Do not assume exploitable until ingress behaviour is confirmed. | Claude |
| WLA-018 | P2 | Public branding and marketing may imply more complete white-label/page-builder capability than the implemented configured renderer provides. | Public metadata, tier descriptions, marketing pages and product docs | Compare every external-facing claim to actual features; retain the prior BRAND-V-14 disposition unless new contradictory claims are found. | Kimi |

## 3. Existing IDs to reconcile, not duplicate

Before adding any new row to the master tracker, compare the new findings against these existing records and their evidence:

- `BRAND-V-01` through `BRAND-V-17` — public branding, domains, slugs, renderer, metadata-related scope and branding configuration.
- `MM-10-A` and any existing payment-mode / SaaS settlement sub-findings — preserve the existing account-substitution investigation and its exact scope.
- `PAY-01`, `PAY-H-01`, H-01/H-02, LDG-01 and existing Stripe webhook, refund, wallet, payout and reconciliation findings.
- Existing RBAC, API ownership, upload/file and public-booking findings in Sections 1–8 of the master tracker.

A prior finding may be reopened only with new evidence under AUDIT-PROCESS.md. If one prior finding must be split, mark the original SUPERSEDED, record the reason and list replacement IDs. Do not inherit VERIFIED or FIX-VERIFIED status into new sub-findings.

## 4. Verification order

1. **Containment checks:** WLA-001 and WLA-017 — payment-mode entry points and trusted host headers.
2. **Money path:** WLA-002, WLA-003, WLA-004 and WLA-005 — test mode only, with ledger and refund trace.
3. **Domain control and routing:** WLA-006, WLA-007, WLA-010, WLA-011 and WLA-012.
4. **Tenant isolation:** WLA-008 and WLA-016.
5. **Public identity and communications:** WLA-009, WLA-013, WLA-014, WLA-015 and WLA-018.

The order may change if initial verification identifies a critical exploitable path. Verification must be performed one finding at a time, with exact commit SHA, code location, test command, output, exit code, and residual limitations recorded.

## 5. Current disposition

- No production code changed by this consolidation.
- WLA-001 is VERIFIED by source inspection only; no runtime test was executed.
- All other WLA findings remain at FINDING; none is FIX, FIX-VERIFIED or CLOSED.
- The prior master tracker remains authoritative until its versioned update is committed on this audit branch.
- DIRECT / provider-settlement mode must remain blocked until the applicable payment, wallet, ledger, refund and domain/tenant findings are resolved and independently verified.
