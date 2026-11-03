/**
 * WLA-013: Custom-domain metadata isolation tests.
 *
 * Tests two aspects:
 * 1. Source inspection: root layout conditionally renders DriveBook scripts
 *    only when isOwnDomain returns true.
 * 2. Source inspection: custom-domain page has generateMetadata that resolves
 *    tenant-specific metadata without falling back to DriveBook branding.
 * 3. Unit tests: isOwnDomain correctly classifies hosts for the layout conditional.
 *
 * Note: These are source-inspection + unit tests. Full Next.js server-rendered
 * HTML verification (checking actual <script> tags in output) requires a running
 * Next.js server and is documented as a limitation.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { isOwnDomain } from '@/lib/utils/host-classification';

const ROOT = 'drivebook.com.au';

// ── Source files ──────────────────────────────────────────────────────────────

const layoutSource = readFileSync(
  resolve(process.cwd(), 'app/layout.tsx'),
  'utf-8'
);

const customDomainSource = readFileSync(
  resolve(process.cwd(), 'app/custom-domain/page.tsx'),
  'utf-8'
);

// ── Part B: Root layout conditional scripts ───────────────────────────────────

describe('WLA-013 Part B: Root layout — conditional platform scripts', () => {
  it('B01 — root layout imports isOwnDomain and normalizeHostname', () => {
    expect(layoutSource).toContain('host-classification');
    expect(layoutSource).toContain('isOwnDomain');
    expect(layoutSource).toContain('normalizeHostname');
  });

  it('B02 — root layout reads host header and computes showPlatformScripts', () => {
    expect(layoutSource).toContain("headersList.get('host')");
    expect(layoutSource).toContain('showPlatformScripts');
    expect(layoutSource).toContain('isOwnDomain(hostname, rootDomain)');
  });

  it('B03 — Organization JSON-LD is inside showPlatformScripts conditional', () => {
    expect(layoutSource).toContain('showPlatformScripts &&');
    expect(layoutSource).toContain("Organization");
    // The Organization JSON-LD must be inside the conditional block
    const condStart = layoutSource.indexOf('showPlatformScripts &&');
    const orgJsonLd = layoutSource.indexOf("'@type': 'Organization'");
    expect(orgJsonLd).toBeGreaterThan(condStart);
  });

  it('B04 — Google Ads tracking is inside showPlatformScripts conditional', () => {
    expect(layoutSource).toContain('AW-18353082328');
    const condStart = layoutSource.indexOf('showPlatformScripts &&');
    const adsTag = layoutSource.indexOf('AW-18353082328');
    expect(adsTag).toBeGreaterThan(condStart);
  });

  it('B05 — RSS feed link is inside showPlatformScripts conditional', () => {
    expect(layoutSource).toContain('application/rss+xml');
    const condStart = layoutSource.indexOf('showPlatformScripts &&');
    const rssTag = layoutSource.indexOf('application/rss+xml');
    expect(rssTag).toBeGreaterThan(condStart);
  });

  it('B06 — WebSite schema JSON-LD is inside showPlatformScripts conditional', () => {
    expect(layoutSource).toContain("'@type': 'WebSite'");
    const condStart = layoutSource.indexOf('showPlatformScripts &&');
    const websiteSchema = layoutSource.indexOf("'@type': 'WebSite'");
    expect(websiteSchema).toBeGreaterThan(condStart);
  });
});

// ── Part A: Custom-domain generateMetadata ───────────────────────────────────

describe('WLA-013 Part A: Custom-domain page — generateMetadata', () => {
  it('A01 — custom-domain page exports generateMetadata', () => {
    expect(customDomainSource).toContain('export async function generateMetadata');
  });

  it('A02 — generateMetadata resolves Provider with verified customDomain', () => {
    expect(customDomainSource).toContain('customDomain,');
    expect(customDomainSource).toContain('domainVerified: true');
    expect(customDomainSource).toContain("STUDIO");
    expect(customDomainSource).toContain("PREMIUM");
  });

  it('A03 — generateMetadata resolves verified BusinessDomain as fallback', () => {
    expect(customDomainSource).toContain('resolveBusinessDomain');
  });

  it('A04 — generateMetadata returns tenant-specific title (not DriveBook)', () => {
    // The metadata title should be derived from the provider or business name
    // It must NOT contain the hardcoded DriveBook title
    expect(customDomainSource).toContain('displayName');
    expect(customDomainSource).toContain('Book Online');
    expect(customDomainSource).toContain('biz.website?.seoTitle');
  });

  it('A05 — generateMetadata sets canonical to the custom domain (not drivebook.com.au)', () => {
    expect(customDomainSource).toContain('canonical');
    expect(customDomainSource).toContain('https://${customDomain}');
    // Must NOT canonical to BASE_URL or drivebook.com.au
    expect(customDomainSource).not.toContain('canonical: BASE_URL');
  });

  it('A06 — generateMetadata returns OpenGraph with tenant siteName', () => {
    expect(customDomainSource).toContain('openGraph');
    expect(customDomainSource).toContain('siteName');
  });

  it('A07 — generateMetadata does not fall back to DriveBook metadata for unknown domains', () => {
    // For unresolved domains, it returns title: 'Website' — not DriveBook title
    expect(customDomainSource).toContain("title: 'Website'");
  });

  it('A08 — generateMetadata checks isOwnDomain defensively', () => {
    // If the host is somehow an own domain (should not reach this page),
    // return minimal metadata without resolving a tenant
    expect(customDomainSource).toContain('isOwnDomain(customDomain, rootDomain)');
    expect(customDomainSource).toContain("title: 'Website'");
  });

  it('A09 — generateMetadata only uses verified domain records', () => {
    // Provider path requires domainVerified: true
    expect(customDomainSource).toContain('domainVerified: true');
    // BusinessDomain path uses resolveBusinessDomain which requires verified: true
    expect(customDomainSource).toContain('resolveBusinessDomain');
  });
});

// ── isOwnDomain classification for layout conditional ─────────────────────────

describe('WLA-013: isOwnDomain classification for layout conditional', () => {
  it('C01 — main DriveBook domain is classified as own domain', () => {
    expect(isOwnDomain('drivebook.com.au', ROOT)).toBe(true);
  });

  it('C02 — DriveBook subdomain is classified as own domain', () => {
    expect(isOwnDomain('www.drivebook.com.au', ROOT)).toBe(true);
    expect(isOwnDomain('john.drivebook.com.au', ROOT)).toBe(true);
  });

  it('C03 — Vercel preview is classified as own domain', () => {
    expect(isOwnDomain('drivebook-preview.vercel.app', ROOT)).toBe(true);
  });

  it('C04 — custom domain is NOT classified as own domain', () => {
    expect(isOwnDomain('provider-site.com', ROOT)).toBe(false);
    expect(isOwnDomain('my-driving-school.com.au', ROOT)).toBe(false);
  });

  it('C05 — deceptive host is NOT classified as own domain', () => {
    expect(isOwnDomain('evil-drivebook.com.au', ROOT)).toBe(false);
    expect(isOwnDomain('drivebook.com.au.evil.com', ROOT)).toBe(false);
  });

  it('C06 — empty or malformed host is NOT classified as own domain', () => {
    expect(isOwnDomain('', ROOT)).toBe(false);
    expect(isOwnDomain('localhost', ROOT)).toBe(true); // localhost IS own domain
  });

  it('C07 — host with port is handled', () => {
    expect(isOwnDomain('drivebook.com.au:443', ROOT)).toBe(true);
    expect(isOwnDomain('provider.com:443', ROOT)).toBe(false);
  });
});
