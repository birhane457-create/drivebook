# WLA-017 Behavioral Verification Scope

**Finding:** WLA-017 — x-custom-domain header trust and tenant resolution  
**Fix applied:** `73b680ca` — page reads Host header instead of x-custom-domain  
**Current status:** Fix documented; behavioral verification pending

## Vercel ingress Host header behavior

Based on Vercel documentation and CDN multi-tenancy research:

Vercel's edge network routes requests based on the domain registered in the project configuration.
When a request arrives at Vercel for a registered custom domain, the `Host` header in the
proxied request is set by Vercel's edge based on the domain that matched the TLS certificate.

**Key constraint:** A client connecting directly to Vercel's edge IP cannot inject an arbitrary
`Host` header that routes to a different tenant's domain unless:
1. The spoofed domain is registered in the same Vercel project/team, AND
2. The client can manipulate the TCP/TLS layer to present a different SNI (domain fronting)

Domain fronting (SNI ≠ Host) is a known CDN multi-tenancy risk on Vercel but requires
network-layer access that is not available to ordinary HTTP clients.

## Threat model for DriveBook

The relevant attack scenario for WLA-017 is:

**Before the fix:** A client sends a normal HTTP request to `drivebook.com.au/custom-domain`
with header `x-custom-domain: provider-b-domain.com`. The page reads this header and
renders Provider B's booking page — no domain spoofing needed, pure HTTP header injection.

**After the fix:** The page reads `Host` header. The same attack sends a request to
`drivebook.com.au` with `Host: provider-b-domain.com`. Vercel's edge would reject this
because `provider-b-domain.com` is not registered as a domain on DriveBook's Vercel project
— the request would never reach the Next.js middleware at all.

The fix therefore closes the specific vulnerability (client header injection) while the
remaining theoretical risk (domain fronting) is a Vercel platform-level concern, not
specific to this application.

## What behavioral verification should establish

1. **Direct attack no longer works:** A request to `/custom-domain` on `drivebook.com.au`
   with a spoofed `x-custom-domain` header should return a different result than before.
   After the fix, the page uses `Host` = `drivebook.com.au` which is an own domain → `notFound()`.

2. **Legitimate custom domains still work:** A request arriving from a registered custom domain
   should render the correct provider page. The Host header will be the custom domain.

3. **Middleware strips x-custom-domain on own-domain requests:** Source-verified at `73b680ca`.

## Verification approach

The following behavioral tests require a Vercel-deployed environment with a registered test
custom domain:

| Test | Input | Expected |
|---|---|---|
| V01 | GET drivebook.com.au/custom-domain with x-custom-domain: test.example.com | 404 (isOwnDomain check) |
| V02 | GET drivebook.com.au/custom-domain without any header | 404 (isOwnDomain check) |
| V03 | GET from registered custom domain (e.g. test-studio.example.com) | 200 with correct provider page |
| V04 | GET from unregistered domain pointing to Vercel | Vercel 404 before reaching app |

These tests require a staging environment with a real custom domain configured.

## Current source-level evidence

- Source verified at `73b680ca`: page uses Host header, not x-custom-domain
- Middleware strips client-supplied x-custom-domain on own-domain requests
- 8/8 source-level tests pass confirming the code structure
- Domain fronting risk is a platform-level concern; not specific to this fix

## Classification

The WLA-017 fix addresses the confirmed source-level vulnerability (client-injectable header).
The remaining behavioral verification is to confirm the fix works correctly in the deployed
environment. This is a verification gap, not evidence of a remaining defect.
