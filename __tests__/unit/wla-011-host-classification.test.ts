/**
 * WLA-011: Host classification — unit tests for the shared helper.
 *
 * Tests the actual classification function (lib/utils/host-classification.ts)
 * with legitimate and deceptive hostnames. Not source-text assertions.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeHostname,
  isRootDomainOrSubdomain,
  isLocalhost,
  isVercelDomain,
  isOwnDomain,
} from '@/lib/utils/host-classification';

const ROOT = 'drivebook.com.au';

describe('WLA-011: normalizeHostname', () => {
  it('lowercases the hostname', () => {
    expect(normalizeHostname('DRIVEBOOK.COM.AU')).toBe('drivebook.com.au');
    expect(normalizeHostname('LOCALHOST')).toBe('localhost');
    expect(normalizeHostname('Www.Example.COM')).toBe('www.example.com');
  });

  it('strips the port', () => {
    expect(normalizeHostname('drivebook.com.au:443')).toBe('drivebook.com.au');
    expect(normalizeHostname('localhost:3000')).toBe('localhost');
    expect(normalizeHostname('example.com:8080')).toBe('example.com');
  });

  it('strips the trailing dot', () => {
    expect(normalizeHostname('drivebook.com.au.')).toBe('drivebook.com.au');
    expect(normalizeHostname('localhost.')).toBe('localhost');
    expect(normalizeHostname('example.com.')).toBe('example.com');
  });

  it('handles combined port and trailing dot', () => {
    expect(normalizeHostname('DRIVEBOOK.COM.AU.:443')).toBe('drivebook.com.au');
  });

  it('handles empty string', () => {
    expect(normalizeHostname('')).toBe('');
  });

  it('handles IPv6 in brackets with port', () => {
    expect(normalizeHostname('[::1]:3000')).toBe('::1');
    expect(normalizeHostname('[2001:db8::1]:443')).toBe('2001:db8::1');
  });

  it('is idempotent (normalizing already-normalized host)', () => {
    const once = normalizeHostname('DRIVEBOOK.COM.AU:443');
    const twice = normalizeHostname(once);
    expect(twice).toBe('drivebook.com.au');
  });
});

describe('WLA-011: isRootDomainOrSubdomain — exact root-domain matching', () => {
  it('matches the exact root domain', () => {
    expect(isRootDomainOrSubdomain('drivebook.com.au', ROOT)).toBe(true);
  });

  it('matches legitimate subdomains (www, provider slug)', () => {
    expect(isRootDomainOrSubdomain('www.drivebook.com.au', ROOT)).toBe(true);
    expect(isRootDomainOrSubdomain('john.drivebook.com.au', ROOT)).toBe(true);
    expect(isRootDomainOrSubdomain('drivebook.drivebook.com.au', ROOT)).toBe(true);
  });

  it('rejects deceptive prefix hosts (no dot boundary)', () => {
    expect(isRootDomainOrSubdomain('evil-drivebook.com.au', ROOT)).toBe(false);
    expect(isRootDomainOrSubdomain('notdrivebook.com.au', ROOT)).toBe(false);
    expect(isRootDomainOrSubdomain('evildrivebook.com.au', ROOT)).toBe(false);
  });

  it('rejects deceptive suffix hosts (root is substring, not suffix)', () => {
    expect(isRootDomainOrSubdomain('drivebook.com.au.evil.com', ROOT)).toBe(false);
    expect(isRootDomainOrSubdomain('drivebook.com.au.malicious.net', ROOT)).toBe(false);
  });

  it('rejects completely different domains', () => {
    expect(isRootDomainOrSubdomain('example.com', ROOT)).toBe(false);
    expect(isRootDomainOrSubdomain('evil.com', ROOT)).toBe(false);
    expect(isRootDomainOrSubdomain('attacker.io', ROOT)).toBe(false);
  });

  it('normalizes case and port before matching', () => {
    expect(isRootDomainOrSubdomain('DRIVEBOOK.COM.AU', ROOT)).toBe(true);
    expect(isRootDomainOrSubdomain('WWW.DRIVEBOOK.COM.AU:443', ROOT)).toBe(true);
    expect(isRootDomainOrSubdomain('drivebook.com.au.', ROOT)).toBe(true);
  });
});

describe('WLA-011: isLocalhost — exact localhost matching', () => {
  it('matches bare localhost', () => {
    expect(isLocalhost('localhost')).toBe(true);
  });

  it('matches .localhost subdomains', () => {
    expect(isLocalhost('john.localhost')).toBe(true);
    expect(isLocalhost('provider-a.localhost')).toBe(true);
  });

  it('rejects deceptive localhost hosts (no dot boundary)', () => {
    expect(isLocalhost('localhost.evil.com')).toBe(false);
    expect(isLocalhost('evil-localhost.com')).toBe(false);
    expect(isLocalhost('evillocalhost.com')).toBe(false);
    expect(isLocalhost('localhost-evil.com')).toBe(false);
  });

  it('normalizes case and port', () => {
    expect(isLocalhost('LOCALHOST')).toBe(true);
    expect(isLocalhost('LOCALHOST:3000')).toBe(true);
    expect(isLocalhost('John.Localhost')).toBe(true);
  });
});

describe('WLA-011: isVercelDomain — Vercel preview matching', () => {
  it('matches legitimate Vercel preview subdomains', () => {
    expect(isVercelDomain('drivebook-preview.vercel.app')).toBe(true);
    expect(isVercelDomain('drivebook2-abc123-drivebook.vercel.app')).toBe(true);
  });

  it('matches vercel.app apex (platform domain)', () => {
    expect(isVercelDomain('vercel.app')).toBe(true);
  });

  it('rejects deceptive Vercel suffixes (no dot boundary)', () => {
    expect(isVercelDomain('evil-vercel.app')).toBe(false);
    expect(isVercelDomain('notvercel.app')).toBe(false);
    expect(isVercelDomain('evilvercel.app')).toBe(false);
  });

  it('normalizes case and port', () => {
    expect(isVercelDomain('DRIVEBOOK-PREVIEW.VERCEL.APP')).toBe(true);
    expect(isVercelDomain('drivebook.vercel.app:443')).toBe(true);
  });
});

describe('WLA-011: isOwnDomain — combined classification', () => {
  // ── Should be classified as own domain ──────────────────────────────

  it('classifies exact root domain as own domain', () => {
    expect(isOwnDomain('drivebook.com.au', ROOT)).toBe(true);
  });

  it('classifies www subdomain as own domain', () => {
    expect(isOwnDomain('www.drivebook.com.au', ROOT)).toBe(true);
  });

  it('classifies provider subdomains as own domain', () => {
    expect(isOwnDomain('john.drivebook.com.au', ROOT)).toBe(true);
  });

  it('classifies localhost as own domain', () => {
    expect(isOwnDomain('localhost', ROOT)).toBe(true);
  });

  it('classifies .localhost subdomains as own domain', () => {
    expect(isOwnDomain('john.localhost', ROOT)).toBe(true);
  });

  it('classifies Vercel preview subdomains as own domain', () => {
    expect(isOwnDomain('drivebook-preview.vercel.app', ROOT)).toBe(true);
  });

  it('classifies vercel.app as own domain', () => {
    expect(isOwnDomain('vercel.app', ROOT)).toBe(true);
  });

  // ── Should be classified as custom domain ────────────────────────────

  it('classifies deceptive prefix as custom domain', () => {
    expect(isOwnDomain('evil-drivebook.com.au', ROOT)).toBe(false);
  });

  it('classifies deceptive suffix as custom domain', () => {
    expect(isOwnDomain('drivebook.com.au.evil.com', ROOT)).toBe(false);
  });

  it('classifies deceptive localhost hosts as custom domain', () => {
    expect(isOwnDomain('localhost.evil.com', ROOT)).toBe(false);
    expect(isOwnDomain('evil-localhost.com', ROOT)).toBe(false);
  });

  it('classifies deceptive Vercel suffix as custom domain', () => {
    expect(isOwnDomain('evil-vercel.app', ROOT)).toBe(false);
  });

  it('classifies legitimate custom domains as custom domain', () => {
    expect(isOwnDomain('provider-site.com', ROOT)).toBe(false);
    expect(isOwnDomain('my-driving-school.com.au', ROOT)).toBe(false);
    expect(isOwnDomain('example.org', ROOT)).toBe(false);
  });

  // ── Normalization edge cases ────────────────────────────────────────

  it('normalizes uppercase, port, and trailing dot before classifying', () => {
    expect(isOwnDomain('DRIVEBOOK.COM.AU:443', ROOT)).toBe(true);
    expect(isOwnDomain('drivebook.com.au.', ROOT)).toBe(true);
    expect(isOwnDomain('LOCALHOST:3000', ROOT)).toBe(true);
    expect(isOwnDomain('DRIVEBOOK-PREVIEW.VERCEL.APP', ROOT)).toBe(true);
  });

  // ── Consistency between middleware and page usage ────────────────────

  it('produces consistent results for middleware and page (same helper)', () => {
    // Both middleware.ts and app/custom-domain/page.tsx call isOwnDomain()
    // with the same rootDomain. The helper is shared, so results are
    // guaranteed consistent. This test documents that contract.
    const testHosts = [
      'drivebook.com.au',
      'www.drivebook.com.au',
      'evil-drivebook.com.au',
      'drivebook.com.au.evil.com',
      'localhost',
      'john.localhost',
      'localhost.evil.com',
      'evil-localhost.com',
      'drivebook-preview.vercel.app',
      'evil-vercel.app',
      'vercel.app',
      'provider-site.com',
    ];

    for (const host of testHosts) {
      const result = isOwnDomain(host, ROOT);
      // The helper is a pure function — calling it twice gives the same result
      expect(isOwnDomain(host, ROOT)).toBe(result);
      // Normalized input should also give the same result
      expect(isOwnDomain(normalizeHostname(host), ROOT)).toBe(result);
    }
  });
});
