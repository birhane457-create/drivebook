/**
 * WLA-010 TESTS — Custom-domain middleware path exemptions
 *
 * Finding: middleware.ts skipPaths for the custom-domain rewrite path was
 * missing /book, /privacy and /terms. BusinessWebsitePage.tsx links to
 * /book/{provider.id}, /privacy and /terms — without exemptions these paths
 * are rewritten to /custom-domain/book/..., /custom-domain/privacy and
 * /custom-domain/terms, which do not exist and produce 404s.
 *
 * Fix: added /book, /privacy and /terms to the custom-domain skipPaths.
 * The subdomain rewrite already exempted these paths — the fix aligns them.
 *
 * WHAT IS TESTED (source-level)
 *   E01  /book is in custom-domain skipPaths
 *   E02  /privacy is in custom-domain skipPaths
 *   E03  /terms is in custom-domain skipPaths
 *   E04  /booking is still in skipPaths (existing, must not regress)
 *   E05  BusinessWebsitePage links to /book/{id}, /privacy, /terms
 *   E06  Custom-domain skipPaths matches subdomain rewrite exemptions for /book
 *   E07  Source includes WLA-010 fix comment
 *   E08  Pure-logic: paths that should be skipped are skipped
 *   E09  Pure-logic: root path / is NOT skipped (renders provider page)
 *   E10  Pure-logic: /book/ prefix also skipped (covers sub-paths)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const middlewareSource = readFileSync(
  resolve(process.cwd(), 'middleware.ts'),
  'utf-8'
);

const pageSource = readFileSync(
  resolve(process.cwd(), 'components/website/BusinessWebsitePage.tsx'),
  'utf-8'
);

// Extract the skipPaths array from the middleware source for logic testing
// We use a regex that captures everything between the [ and ] of the skipPaths constant.
function extractSkipPaths(source: string): string[] {
  const match = source.match(/const skipPaths\s*=\s*\[([^\]]+)\]/);
  if (!match) return [];
  return match[1]
    .split(',')
    .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

// Simulate the middleware rewrite decision for a given path
function wouldRewrite(pathname: string, skipPaths: string[]): boolean {
  return !skipPaths.some(p => pathname.startsWith(p));
}

describe('WLA-010 — Custom-domain middleware path exemptions', () => {

  it('E01 | /book is in custom-domain skipPaths', () => {
    expect(middlewareSource).toMatch(/skipPaths\s*=\s*\[[^\]]*'\/book'/);
  });

  it('E02 | /privacy is in custom-domain skipPaths', () => {
    expect(middlewareSource).toMatch(/skipPaths\s*=\s*\[[^\]]*'\/privacy'/);
  });

  it('E03 | /terms is in custom-domain skipPaths', () => {
    expect(middlewareSource).toMatch(/skipPaths\s*=\s*\[[^\]]*'\/terms'/);
  });

  it('E04 | /booking is still in skipPaths (existing, must not regress)', () => {
    expect(middlewareSource).toMatch(/skipPaths\s*=\s*\[[^\]]*'\/booking'/);
  });

  it('E05 | BusinessWebsitePage links to /book/{id}, /privacy, /terms', () => {
    // Confirm the page generates the links whose paths were missing from skipPaths
    expect(pageSource).toContain('/book/${provider.id}');
    expect(pageSource).toContain('href="/privacy"');
    expect(pageSource).toContain('href="/terms"');
  });

  it('E06 | custom-domain /book exemption aligns with subdomain /book exemption', () => {
    // The subdomain path already had /book/ and /book — custom-domain must match
    expect(middlewareSource).toContain("startsWith('/book/')");  // subdomain
    expect(middlewareSource).toContain("'/book'");               // both paths
  });

  it('E07 | source includes WLA-010 fix comment', () => {
    expect(middlewareSource).toContain('WLA-010');
  });

  it('E08 | pure-logic: /book, /privacy, /terms are NOT rewritten after fix', () => {
    const skipPaths = extractSkipPaths(middlewareSource);
    expect(skipPaths.length).toBeGreaterThan(0);

    // These paths must NOT be rewritten (wouldRewrite returns false)
    expect(wouldRewrite('/book', skipPaths)).toBe(false);
    expect(wouldRewrite('/book/prov-abc123', skipPaths)).toBe(false);
    expect(wouldRewrite('/privacy', skipPaths)).toBe(false);
    expect(wouldRewrite('/terms', skipPaths)).toBe(false);
    expect(wouldRewrite('/booking', skipPaths)).toBe(false);
    expect(wouldRewrite('/api/bookings', skipPaths)).toBe(false);
    expect(wouldRewrite('/login', skipPaths)).toBe(false);
  });

  it('E09 | pure-logic: root path / IS rewritten (renders provider page)', () => {
    const skipPaths = extractSkipPaths(middlewareSource);

    // Root path must be rewritten — it renders the provider's website
    expect(wouldRewrite('/', skipPaths)).toBe(true);
  });

  it('E10 | pure-logic: /book/ prefix (deep paths) are also skipped', () => {
    const skipPaths = extractSkipPaths(middlewareSource);

    // /book is the exempted prefix — all sub-paths like /book/prov-id/confirm should be skipped
    expect(wouldRewrite('/book/prov-abc/confirm', skipPaths)).toBe(false);
    expect(wouldRewrite('/book/prov-abc/payment', skipPaths)).toBe(false);
  });

});
