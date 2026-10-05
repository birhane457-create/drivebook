# Phase 3 — Branding, Theme & Public-Face End-to-End Audit

**Audit type:** Architecture / product / documentation consistency / end-to-end readiness  
**Audit state:** FINDINGS IDENTIFIED — NO IMPLEMENTATION  
**Repository inspected:** `da9ae505`  
**Scope:** Branding setup → persistence → theme/identity resolution → public subdomain/custom-domain rendering → white-label surfaces → documentation  
**Historical audit rule:** This audit does not modify or reopen the Phase 1/2 security baseline.

---

## 1. Executive conclusion

The repository already contains a substantial branding and public-page system. It is **not accurate to describe the current product as fully white-label**.

The implemented system currently provides a meaningful **branded public booking experience**, including business/display name, logo, colours, public slug, custom-domain routing, branded booking UI, and a generic BusinessWebsite renderer.

However, the repository contains **two overlapping branding architectures**:

1. Legacy/provider branding stored directly on `Provider`
2. Newer business branding stored in `BusinessBranding` and resolved through `BusinessConfig`

The two paths are not yet a single authoritative system. They can mirror or override one another differently.

Documentation is also materially inconsistent with the current source. In particular:

- API method names differ from documentation.
- Documentation refers to an `Instructor` model while production source uses `Provider`.
- Tier claims differ between documentation, UI, and server code.
- `hidePoweredBy` is documented but is not present in the inspected `Provider` schema.
- The new BusinessBranding system uses `showPlatformBranding`, while the legacy public driving page uses `showBrandingOnBookingPage`.
- The public driving page still visibly renders **"Powered by DriveBook"** when branding is enabled, contradicting the claim that this can be fully hidden.
- The new BusinessBranding API mirrors selected values back into Provider fields, creating two sources of truth.
- Theme/font settings exist in the BusinessBranding model and setup UI but are not represented in the legacy Provider branding path and are not demonstrated as controlling the legacy public page.
- Custom-domain routing has two rendering paths: generic BusinessWebsite and driving-specific SubdomainBookingPage.

**Recommended product wording at this stage:**

> **DriveBook provides branded public booking pages and selected white-label capabilities. Full white-labeling is not currently implemented across the entire customer journey.**

Do not market the current system simply as "fully white-label".

---

# 2. What currently exists

## 2.1 Legacy Provider branding

The production `Provider` model contains:

- `businessName`
- `brandLogo`
- `brandColorPrimary`
- `brandColorSecondary`
- `showBrandingOnBookingPage`
- `customSlug`
- `customDomain`
- `domainVerified`
- `domainVerifiedAt`
- social fields
- account/tier fields

The legacy instructor branding API is:

`GET/PUT /api/instructor/branding`

It persists branding directly to `Provider`.

## 2.2 New Business configuration

The repository also contains:

- `Business`
- `BusinessBranding`
- `BusinessDomain`
- `BusinessWebsite`
- `BusinessTerminology`
- `BusinessCapabilities`
- `BusinessService`
- `BusinessSettings`
- `BusinessAIConfig`

The newer branding model contains:

- logo
- primary colour
- secondary colour
- font family
- theme
- show-platform-branding
- custom slug

The runtime `getBusinessConfig()` attempts to load these records first and falls back to the driving template.

## 2.3 Business branding UI/API

There is a separate:

`/business-setup/branding`

and:

`GET/PUT /api/business/branding`

The API validates colours, URLs and slug format and writes `BusinessBranding`.

It then mirrors several values into `Provider` for backward compatibility.

## 2.4 Public rendering

There are currently two public rendering concepts:

### Driving-specific renderer

`app/subdomain/[slug]/page.tsx`

This renders the established driving instructor booking page.

### Generic business renderer

`components/website/BusinessWebsitePage.tsx`

This uses `BusinessConfig` terminology, services, capabilities, branding and AI configuration.

Custom domains can select the generic renderer when BusinessConfig is sufficiently customised; otherwise they fall back to the driving-specific renderer.

## 2.5 Custom domain

There is a custom-domain verification flow:

`POST /api/instructor/domain/verify`

It:

1. checks provider identity;
2. checks tier;
3. checks trial state;
4. validates domain syntax;
5. checks CNAME;
6. falls back to A-record/Vercel IP verification;
7. optionally calls the Vercel API;
8. persists `customDomain`;
9. sets `domainVerified`.

The custom-domain page then resolves the verified domain and selects a renderer.

## 2.6 Public branding endpoint

There is also:

`GET /api/public/instructor/[instructorId]/branding`

It returns public branding only when:

- branding is enabled;
- tier is PRO/STUDIO/PREMIUM.

This is an additional public branding interface separate from the BusinessConfig website renderer.

---

# 3. What is missing or incomplete

## BRAND-01 — Full white-label claim is not supported by implementation

**Classification:** Product/documentation accuracy + enhancement  
**Severity:** Medium  
**Status:** FINDING

The repository's white-label documentation itself acknowledges substantial remaining gaps, including:

- custom email sending domains;
- per-business SMS sender identity;
- branded login;
- branded dashboard;
- branded student portal;
- dynamic favicon;
- some confirmation-page branding;
- remaining DriveBook references.

More importantly, the inspected driving public page footer still renders:

`© YEAR BusinessName · Powered by DriveBook`

when branding is active.

Therefore the current implementation is not a zero-DriveBook-visibility white-label experience.

### Required wording

Use:

> **Branded public booking experience**

or:

> **Partial white-label capabilities**

rather than:

> **Fully white-label platform**

until the entire customer-facing journey is independently verified.

---

# 4. BRAND-02 — Two branding sources of truth

**Classification:** Architecture gap  
**Severity:** High for maintainability / consistency  
**Status:** FINDING

There are two branding stores:

### Provider

`Provider.brandLogo`  
`Provider.brandColorPrimary`  
`Provider.brandColorSecondary`  
`Provider.showBrandingOnBookingPage`  
`Provider.customSlug`  
`Provider.customDomain`

### BusinessBranding

`BusinessBranding.logo`  
`BusinessBranding.primaryColour`  
`BusinessBranding.secondaryColour`  
`BusinessBranding.fontFamily`  
`BusinessBranding.theme`  
`BusinessBranding.showPlatformBranding`  
`BusinessBranding.customSlug`

The business branding API explicitly mirrors data back into Provider.

This means the system does not currently have one clean authoritative branding record.

### Risk

A future update can modify one store without correctly updating the other.

That can produce:

- dashboard branding differing from public branding;
- old colour displayed after a business branding change;
- slug divergence;
- platform-branding toggle divergence;
- generic renderer showing one identity while driving renderer shows another.

### Required architecture decision

Before implementation, choose one of:

1. BusinessBranding becomes authoritative and Provider fields become compatibility-only; or
2. Provider remains authoritative for the driving product and BusinessBranding is only used for migrated generic businesses; or
3. introduce a single explicit branding service/repository that defines precedence and synchronization.

Do not add more branding fields until this is decided.

---

# 5. BRAND-03 — Platform-branding toggle semantics are inconsistent

**Classification:** Confirmed implementation consistency issue  
**Severity:** Medium  
**Status:** FINDING

The BusinessBranding model calls the field:

`showPlatformBranding`

where:

- true = show "Powered by"
- false = hide platform branding.

The legacy Provider model instead uses:

`showBrandingOnBookingPage`

which means something materially different:

- true = enable branded booking page.

The business branding API contains this mapping:

`showBrandingOnBookingPage: parsed.data.showPlatformBranding === false`

This is an intentional translation, but it creates two inverse booleans representing related concepts.

The public driving renderer then independently determines its footer behavior.

### Result

The product has three concepts:

- show branding;
- show platform branding;
- hide platform branding.

These are easy to misinterpret and have already produced inconsistent documentation.

### Enhancement

Replace the multiple inverse controls with one explicit policy concept at the service layer, for example:

- `platformBrandingMode`
- or a clearly defined `showPlatformBranding`

and derive the legacy compatibility field internally.

---

# 6. BRAND-04 — Documentation does not match the current API contract

**Classification:** Documentation defect  
**Severity:** Medium  
**Status:** FINDING

The inspected branding documentation states:

`POST /api/instructor/branding`

but the source implements:

- GET
- PUT

The documentation also describes an Instructor model while the active Prisma model is Provider.

The documentation describes the logo flow as posting to the branding endpoint, while the current UI uploads the file through:

`POST /api/upload`

with:

`type=brand-logo`

and then sends the resulting URL to the branding API.

This should be corrected.

---

# 7. BRAND-05 — Tier documentation is inconsistent with server enforcement

**Classification:** Product/configuration documentation gap  
**Severity:** High  
**Status:** FINDING

Examples:

### Custom domain

Documentation contains conflicting claims including PRO/PREMIUM/STUDIO.

The current domain verification source enforces:

`STUDIO` or `PREMIUM`

The dashboard also treats custom-domain capability as:

`tier === 'STUDIO'`

Therefore the UI and server do not currently express exactly the same tier policy.

### Custom slug

Documentation describes different tier availability in different files.

The instructor branding API itself does not enforce a PRO-only slug restriction.

The dashboard presents the slug section as PRO+.

### Branding colours

Documentation says colours are available to all tiers, while the dashboard blocks BASIC users from the branding page entirely.

### Finding

The product has no single authoritative tier matrix.

---

# 8. BRAND-06 — Business branding fields are not fully propagated to the legacy public page

**Classification:** Architecture/enhancement gap  
**Severity:** Medium  
**Status:** FINDING

BusinessBranding contains:

- fontFamily
- theme
- showPlatformBranding

The Provider legacy branding path contains:

- logo
- primary colour
- secondary colour
- showBrandingOnBookingPage.

The inspected `fetchProviderWebsiteData()` loads BusinessConfig but then explicitly overrides logo/colours from Provider fields in certain cases.

The legacy driving renderer therefore does not demonstrate complete use of:

- BusinessBranding.theme
- BusinessBranding.fontFamily
- BusinessBranding.showPlatformBranding

### Result

Saving a theme or font in Business Setup does not establish that the visitor sees that theme/font on the established driving public page.

This is a **functional propagation gap**, not merely documentation.

---

# 9. BRAND-07 — Business setup and instructor branding are parallel user experiences

**Classification:** UX/architecture gap  
**Severity:** Medium  
**Status:** FINDING

There are two administrative surfaces:

- `/dashboard/branding`
- `/business-setup/branding`

They expose overlapping concepts but different models and controls.

An operator can therefore reasonably ask:

> "Which branding page is authoritative?"

The repository does not currently provide a single obvious answer.

### Required future state

One canonical setup experience should manage:

- identity;
- logo;
- colours;
- theme;
- public URL;
- custom domain;
- platform attribution;
- public-page preview;
- terminology.

The implementation may remain split internally, but the user-facing source of truth should be singular.

---

# 10. BRAND-08 — Public-page branding is broader than the current "branding" name suggests

**Classification:** Product architecture observation  
**Severity:** Low/Medium  
**Status:** ENHANCEMENT

The public face includes more than visual branding:

- display identity;
- terminology;
- service catalogue;
- contact details;
- social links;
- booking rules;
- availability;
- reviews;
- FAQ;
- AI configuration;
- domain;
- SEO;
- platform attribution.

The newer BusinessWebsite architecture already recognises this.

Therefore the long-term product concept should probably be:

> **Business Public Website / Brand**

rather than a narrow "logo and colours" feature.

This would better match the actual system.

---

# 11. BRAND-09 — Public page contains hardcoded platform/business language

**Classification:** Public-face consistency gap  
**Severity:** Medium  
**Status:** FINDING

The driving public page still contains hardcoded platform/business language, including DriveBook references in generated public content.

The newer BusinessWebsite renderer uses BusinessConfig terminology, but the driving-specific renderer retains driving-specific and DriveBook-specific copy.

This means the generic business architecture and legacy driving page are not yet equivalent public products.

This is another reason the product should not currently be described as fully white-label across all business types.

---

# 12. BRAND-10 — Public-page theme system is incomplete

**Classification:** Enhancement  
**Severity:** Medium  
**Status:** FINDING

The BusinessBranding model supports:

- light/dark theme;
- font family;
- primary colour;
- secondary colour.

The established driving page visibly applies primary/secondary colours but largely retains fixed visual structure and fixed light-page styling.

The audit therefore finds:

> **Colour theming exists; complete theme theming does not yet exist across the established public page.**

A future theme system should define tokens for:

- background;
- foreground;
- muted text;
- cards;
- borders;
- CTA;
- links;
- focus states;
- hero;
- footer;
- booking overlay;
- mobile navigation.

---

# 13. BRAND-11 — Logo upload is implemented but policy is narrower than documentation

**Classification:** Documentation/UX gap  
**Severity:** Low/Medium  
**Status:** FINDING

The current upload endpoint:

- requires authenticated user;
- permits provider/admin/staff roles;
- accepts JPEG/PNG/WebP/GIF;
- limits size to 10 MB;
- sends `brand-logo` to Cloudinary.

The branding UI separately limits the selected logo to 2 MB.

The old documentation states PNG/JPG/SVG up to 2 MB.

Therefore:

- SVG is documented but rejected by the current upload API;
- UI and API size limits differ;
- documentation and implementation disagree.

This needs one authoritative policy.

---

# 14. BRAND-12 — Custom-domain system has two domain models

**Classification:** Architecture gap  
**Severity:** Medium  
**Status:** FINDING

There are:

1. `Provider.customDomain`
2. `BusinessDomain`

The custom-domain page can resolve either.

This is consistent with the broader migration architecture, but it again creates two domain ownership systems.

The future architecture should define:

- one canonical business domain model;
- migration compatibility for Provider.customDomain;
- primary-domain selection;
- verified state;
- provisioning state;
- SSL state;
- old-domain behaviour.

---

# 15. BRAND-13 — Public identity precedence needs formal definition

**Classification:** Architecture gap  
**Severity:** Medium  
**Status:** FINDING

The code currently uses several possible identity sources:

- Provider.name
- Provider.businessName
- Business.name
- BusinessConfig.name
- terminology.provider
- terminology.providerGroup

`getDisplayName()` and `getProviderLabel()` provide part of the abstraction, but public website rendering also constructs its own display identity.

The product needs a formal precedence rule.

Recommended conceptual rule:

`Public business identity → Business.name/businessName → Provider.name fallback`

while:

`Legal identity → never replaced by display branding`

This distinction already exists conceptually in `getDisplayIdentity.ts`, but it should become the authoritative contract used by all public surfaces.

---

# 16. What should be considered "working" today

| Capability | Current assessment |
|---|---|
| Business/display name | IMPLEMENTED |
| Logo upload | IMPLEMENTED |
| Primary/secondary colours | IMPLEMENTED |
| Public slug | IMPLEMENTED |
| Public subdomain routing | IMPLEMENTED |
| Custom domain verification | IMPLEMENTED |
| Vercel domain provisioning path | IMPLEMENTED |
| Branded public booking page | IMPLEMENTED |
| Generic business public renderer | IMPLEMENTED |
| Business terminology | IMPLEMENTED |
| Business services on generic renderer | IMPLEMENTED |
| Business theme storage | IMPLEMENTED |
| Business font storage | IMPLEMENTED |
| Full theme application to legacy page | NOT ESTABLISHED |
| Single branding source of truth | NOT ESTABLISHED |
| Full white-label | NOT IMPLEMENTED |
| Branded email domain | NOT IMPLEMENTED |
| Per-business SMS identity | NOT IMPLEMENTED |
| Fully branded login | NOT IMPLEMENTED |
| Fully branded client portal | NOT IMPLEMENTED |
| Fully branded management dashboard | NOT IMPLEMENTED |
| Dynamic public favicon | NOT ESTABLISHED |
| Single authoritative tier matrix | NOT ESTABLISHED |
| Documentation/source consistency | NOT ESTABLISHED |

---

# 17. Recommended product terminology

Until the missing pieces are implemented and verified:

### Use

**"Branded booking page"**

**"Custom business branding"**

**"Branded public website"**

**"Custom domain and branding"**

**"White-label capabilities"**

### Avoid

**"Fully white-label"**

**"100% white-label"**

**"Completely removes DriveBook from the customer experience"**

The current implementation does not support those stronger claims.

---

# 18. Implementation should NOT start yet

This audit intentionally does not prescribe immediate code changes.

Before implementation, the architecture decision should be:

### Step 1 — Define the canonical model

Decide whether `BusinessBranding` becomes authoritative.

### Step 2 — Define public identity precedence

Document exactly how Business name, Provider name and terminology resolve.

### Step 3 — Define white-label scope

Separate:

- public booking branding;
- public website branding;
- transaction/receipt branding;
- email identity;
- SMS identity;
- login;
- student portal;
- provider/admin portal.

### Step 4 — Define tier matrix

Create one authoritative matrix used by:

- UI;
- API;
- public rendering;
- documentation;
- tests.

### Step 5 — Define domain architecture

Choose `BusinessDomain` as the long-term model or formally document why Provider.customDomain remains authoritative.

### Step 6 — Define theme contract

Specify exactly what "theme" controls before implementing additional visual controls.

### Step 7 — Then implement

Only after those decisions should individual fixes/enhancements be planned.

---

# 19. Audit conclusion

The current system is **not a missing-branding system**. It already contains substantial branding and public-page functionality.

The main problem is **fragmentation and overstatement**:

> The codebase has more branding capability than the simplest documentation suggests, but less complete white-label capability than some documentation claims.

The highest-value work is therefore not immediately adding more UI.

It is first to establish a **single coherent branding/public-face architecture**, reconcile the Provider and BusinessConfig systems, establish authoritative tier rules, and accurately define what DriveBook means by "white-label".

**No implementation is approved from this audit.**

**Next audit phase:** independently verify the identified findings against all relevant public surfaces (booking page, payment, confirmation, emails, SMS, login, dashboards, custom domain) and convert only confirmed defects/gaps into implementation tasks.
