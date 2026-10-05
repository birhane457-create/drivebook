# Custom Brand / Public Face — Kimi + Claude Verification

Repository: birhane457-create/drivebook
Branch: main
Method: independent source verification. No remediation was implemented.

## Consolidated findings

| ID | Source | Claim | Result | Severity |
|---|---|---|---|---|
| BRAND-V-01 | Kimi | Custom-domain ownership is not sufficiently protected | VERIFIED | P0/P1 |
| BRAND-V-02 | Kimi | CNAME verification accepts any value containing "vercel" | VERIFIED | P0/P1 |
| BRAND-V-03 | Kimi | Business Setup custom-domain save loses customDomain | VERIFIED | P1 |
| BRAND-V-04 | Kimi | Business Setup gives the wrong DNS target | VERIFIED | P1 |
| BRAND-V-05 | Kimi | PREMIUM custom-domain entitlement is inconsistent | VERIFIED | P1 |
| BRAND-V-06 | Kimi | Server-side plan gating is weaker than UI gating | VERIFIED | P1 |
| BRAND-V-07 | Kimi | Branding has two sources of truth | VERIFIED | P1 |
| BRAND-V-08 | Kimi | Driving businesses can bypass the generic public renderer | VERIFIED | P1/P2 |
| BRAND-V-09 | Kimi | theme and fontFamily are stored but not rendered | VERIFIED | P2 |
| BRAND-V-10 | Kimi | Platform-branding flag is not carried into BusinessConfig | VERIFIED | P2 |
| BRAND-V-11 | Kimi | Slug policy/storage/uniqueness is inconsistent | VERIFIED | P2 |
| BRAND-V-12 | Kimi | Business Setup displays inconsistent public URL format | VERIFIED | P2 |
| BRAND-V-13 | Kimi | Setup progress can falsely report primary-colour completion | VERIFIED | P2 |
| BRAND-V-14 | Kimi | Public page is a configured renderer, not a full page builder | VERIFIED | Observation |
| BRAND-V-15 | Claude | Changing customDomain through legacy branding API does not clear domainVerified | VERIFIED | P1 |
| BRAND-V-16 | Claude | Slug collision can occur between BusinessBranding and Provider | VERIFIED | P1/P2 |
| BRAND-V-17 | Claude | /api/branding is a stale unauthenticated branding endpoint | VERIFIED | P2 / legacy |

## Evidence summary

### BRAND-V-01 — custom-domain ownership
Provider.customDomain is not DB-unique. The verification route writes Provider directly and does not check whether another provider owns the hostname. BusinessDomain.host is separately unique, but that model is not the write path used by the verification endpoint. Public Provider resolution uses findFirst.

### BRAND-V-02 — DNS verification
The verification route uses dnsValue.toLowerCase().includes('vercel'). This is broader than an exact cname.vercel-dns.com comparison.

### BRAND-V-03 — domain persistence
Business Setup sends customDomain to /api/business/branding. The branding Zod schema does not contain customDomain, so the parsed object excludes it. The existing verification route persists the Provider customDomain only when DNS verification succeeds.

### BRAND-V-04 — DNS target
Business Setup constructs cname.${rootDomain}. The verification route is designed around cname.vercel-dns.com. The setup UI and verification logic therefore do not share one authoritative target.

### BRAND-V-05 — PREMIUM
The verification endpoint permits STUDIO and PREMIUM. The custom-domain public route also permits both. Legacy Dashboard Branding uses tier === STUDIO for its custom-domain feature, excluding PREMIUM.

### BRAND-V-06 — server-side entitlement
The legacy instructor branding PUT authenticates the caller and checks trial expiry, but it does not enforce the intended tier matrix for branding, slug, or custom-domain writes. UI restrictions are therefore not the complete security boundary.

### BRAND-V-07 — two branding authorities
The legacy API writes Provider branding fields. The Business Branding API writes BusinessBranding and mirrors selected fields into Provider. BusinessBranding additionally contains font/theme/platform-branding fields that are not represented by the legacy Provider model.

### BRAND-V-08 — dual public renderers
Subdomain and custom-domain routes use BusinessWebsitePage only when terminology/service heuristics indicate customization. Otherwise they fall through to the driving-specific renderer.

### BRAND-V-09 — theme/font
BusinessBranding, its API, and BusinessConfig assembly contain fontFamily and theme. BusinessWebsitePage consumes logo and colours but does not apply fontFamily or light/dark theme.

### BRAND-V-10 — platform-branding flag
BusinessBranding contains showPlatformBranding and BusinessWebsitePage checks it, but getBusinessConfig/assembleConfig does not include the field in the BusinessConfig branding object.

### BRAND-V-11 — slug invariant
BusinessBranding.customSlug is DB-unique. Provider.customSlug is not. The business API checks BusinessBranding uniqueness and then mirrors the slug into Provider. Public resolution uses Provider.customSlug.

### BRAND-V-12 — URL presentation
Business Setup's input visually uses rootDomain/slug, while the actual public URL is slug.rootDomain. This is a presentation defect.

### BRAND-V-13 — false setup completion
Business Setup checks whether config.branding.primaryColour exists. getBusinessConfig supplies #3B82F6 when the stored value is absent, so the completion indicator can interpret the default as user configuration.

### BRAND-V-14 — page builder claim
BusinessWebsitePage is a fixed-section configured public website renderer. The inspected path has no section ordering, section visibility, custom-page, or comparable page-builder management model.

### BRAND-V-15 — stale domain verification
The domain verification endpoint sets customDomain and domainVerified=true. The legacy branding PUT accepts customDomain and updates it without resetting domainVerified/domainVerifiedAt. The custom-domain public route resolves using customDomain plus domainVerified=true. This creates stale verification state after an unverified domain mutation.

### BRAND-V-16 — slug collision
BusinessBranding.customSlug is unique only in that table. Provider.customSlug has no DB unique constraint. The business API checks only BusinessBranding before mirroring into Provider. Public lookup uses Provider.findFirst by customSlug. The missing cross-model uniqueness invariant is therefore confirmed. Runtime testing is still required to establish the exact duplicate-creation/exploitation path under current data.

### BRAND-V-17 — legacy branding endpoint
/api/branding accepts a caller-supplied provider/user ID without session authorization and returns hardcoded branding values. It is not purely dead: components/mobile/MobileLayout.tsx still calls it. Therefore removal requires checking the active mobile workflow first.

## Security vs product architecture

Security/integrity candidates:
- BRAND-V-01, V-02, V-03, V-05, V-06, V-07, V-15, V-16, V-17.

Product/architecture findings:
- BRAND-V-04, V-08, V-09, V-10, V-11, V-12, V-13, V-14.

## Required runtime verification before implementation

1. Duplicate custom-domain claim by two providers.
2. Change an already verified domain through legacy branding PUT and confirm public resolution behaviour.
3. Create duplicate slugs across BusinessBranding and Provider and determine actual public resolution.
4. Direct BASIC/PREMIUM API entitlement tests.
5. DNS substring-"vercel" test.
6. Business Setup custom-domain persistence test.
7. Public rendering tests for driving and generic businesses.
8. Theme/font/footer-branding rendering tests.
9. Confirm whether /api/branding is required by an active mobile workflow.

Lifecycle:
FINDING -> VERIFIED -> FIX -> FIX-VERIFIED -> CLOSED.

No historical finding should be modified solely because these are new post-baseline branding findings.
