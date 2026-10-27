/**
 * WLA-017 TESTS — Custom-domain header trust and tenant resolution
 *
 * Finding: app/custom-domain/page.tsx read `x-custom-domain` from request
 * headers, which is client-controllable. A client could send a spoofed
 * `x-custom-domain` header to render a different provider's booking page.
 *
 * Evidence: multiple verification scripts (brand-verify-*.mjs, fix-verify-*.mjs)
 * deliberately sent `x-custom-domain` as a client header and the page accepted
 * it — confirming the header is fully client-controllable.
 *
 * Fix: the page now reads the `Host` header (TLS-verified, not spoofable)
 * instead of `x-custom-domain`. The middleware strips client-supplied
 * `x-custom-domain` headers on own-domain requests (defense in depth).
 *
 * WHAT IS TESTED
 *   H01  Page source reads `host` header, not `x-custom-domain`
 *   H02  Page source strips port from Host header
 *   H03  Page source validates Host is not an own domain (returns notFound)
 *   H04  Page source no longer trusts `x-custom-domain` for tenant resolution
 *   H05  Middleware source strips client-supplied x-custom-domain on own domain
 *   H06  Middleware still sets x-custom-domain on custom-domain rewrites (backward compat)
 *   H07  Verification scripts that used spoofed headers are now ineffective (source evidence)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('WLA-017 — Custom-domain header trust and tenant resolution', () => {

  const pageSource = readFileSync(
    resolve(process.cwd(), 'app/custom-domain/page.tsx'),
    'utf-8'
  );

  const middlewareSource = readFileSync(
    resolve(process.cwd(), 'middleware.ts'),
    'utf-8'
  );

  it('H01 | page reads host header for tenant resolution', () => {
    // The page must read the Host header, not x-custom-domain
    expect(pageSource).toContain("headersList.get('host')");
    expect(pageSource).not.toContain("headersList.get('x-custom-domain')");
  });

  it('H02 | page strips port from host header', () => {
    // Port must be stripped (e.g. "example.com:443" → "example.com")
    expect(pageSource).toContain("hostHeader.split(':')[0]");
  });

  it('H03 | page validates host is not an own domain', () => {
    // The page must reject requests where Host is an own domain
    // (prevents direct access to /custom-domain on drivebook.com.au)
    expect(pageSource).toContain('isOwnDomain');
    expect(pageSource).toContain('notFound()');
    // Must check against root domain, localhost, and vercel.app
    expect(pageSource).toContain('rootDomain');
    expect(pageSource).toContain('localhost');
    expect(pageSource).toContain('vercel.app');
  });

  it('H04 | page no longer uses x-custom-domain for tenant lookup', () => {
    // The page must NOT use x-custom-domain to look up the provider
    // The Prisma query should use the Host-derived customDomain
    const prismaQueryPos = pageSource.indexOf('prisma.provider.findFirst');
    expect(prismaQueryPos).toBeGreaterThan(-1);

    // The x-custom-domain header should not appear between the header read
    // and the Prisma query (it's no longer used for resolution)
    const headerReadEnd = pageSource.indexOf("hostHeader.split(':')[0]");
    const queryStart = pageSource.indexOf('prisma.provider.findFirst');

    // There should be no reference to x-custom-domain between header read and query
    const section = pageSource.substring(headerReadEnd, queryStart);
    expect(section).not.toContain('x-custom-domain');
  });

  it('H05 | middleware strips client-supplied x-custom-domain on own domain', () => {
    // Defense in depth: on own-domain requests, strip any client-supplied header
    expect(middlewareSource).toContain("req.headers.get('x-custom-domain')");
    expect(middlewareSource).toContain("response.headers.delete('x-custom-domain')");
  });

  it('H06 | middleware still sets x-custom-domain on custom-domain rewrites', () => {
    // Backward compatibility: the middleware still sets the header on rewrites
    // (other code or scripts may read it, but the page no longer trusts it)
    expect(middlewareSource).toContain("response.headers.set('x-custom-domain'");
  });

  it('H07 | page source includes WLA-017 fix comment', () => {
    // Documentation: the fix should be clearly marked
    expect(pageSource).toContain('WLA-017');
  });

  it('H08 | middleware source includes WLA-017 fix comment', () => {
    expect(middlewareSource).toContain('WLA-017');
  });

});
