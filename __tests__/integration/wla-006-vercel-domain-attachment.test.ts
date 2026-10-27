/**
 * WLA-006 TESTS — Vercel domain attachment behavior
 *
 * Finding: addDomainToVercel() treated domain_already_in_use (domain on another
 * Vercel project) as success, allowing false verification.
 *
 * Fix: extracted to lib/services/vercel-domains.ts; domain_already_in_use now
 * returns failure; domain_already_exists returns success (already on this project).
 *
 * WHAT IS TESTED
 *   V01  200 OK response → success: true
 *   V02  domain_already_in_use → success: false (WLA-006 FIX — was true)
 *   V03  domain_already_exists → success: true, alreadyOnThisProject: true
 *   V04  Other Vercel error → success: false with error message
 *   V05  Network failure (fetch throws) → success: false
 *   V06  Missing env vars → success: false with config error
 *   V07  Source: route imports from extracted utility (not inline function)
 *   V08  Source: route no longer contains inline addDomainToVercel
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { addDomainToVercel } from '@/lib/services/vercel-domains';

// ── Mock fetch globally ──────────────────────────────────────────────────────
// The utility calls fetch() to reach the Vercel API. We mock it per-test.

const originalFetch = globalThis.fetch;

beforeEach(() => {
  // Set required env vars for the utility to proceed past the config check
  process.env.VERCEL_API_TOKEN = 'test-token';
  process.env.VERCEL_PROJECT_ID = 'test-project-id';
  process.env.VERCEL_TEAM_ID = 'test-team-id';
});

afterEach(() => {
  // Restore fetch
  globalThis.fetch = originalFetch;
  // Clean up env
  delete process.env.VERCEL_API_TOKEN;
  delete process.env.VERCEL_PROJECT_ID;
  delete process.env.VERCEL_TEAM_ID;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WLA-006 — Vercel domain attachment behavior', () => {

  it('V01 | 200 OK → success: true', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ name: 'example.com' }),
    } as any);

    const result = await addDomainToVercel('example.com');
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('V02 | domain_already_in_use → success: false (WLA-006 FIX — was true)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: {
          code: 'domain_already_in_use',
          message: 'The domain example.com is already in use by another project.',
        },
      }),
    } as any);

    const result = await addDomainToVercel('example.com');

    // WLA-006 FIX: domain_already_in_use means the domain is on ANOTHER project.
    // This must return failure — the previous code returned success: true.
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/another.*vercel.*project/i);
    expect(result.alreadyOnThisProject).toBeUndefined();
  });

  it('V03 | domain_already_exists → success: true, alreadyOnThisProject: true', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: {
          code: 'domain_already_exists',
          message: 'The domain example.com already exists.',
        },
      }),
    } as any);

    const result = await addDomainToVercel('example.com');

    // domain_already_exists means the domain is already in this project's config.
    // This is a benign condition — not an error.
    expect(result.success).toBe(true);
    expect(result.alreadyOnThisProject).toBe(true);
  });

  it('V04 | Other Vercel error → success: false with error message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: 'invalid_domain',
          message: 'The domain name is invalid.',
        },
      }),
    } as any);

    const result = await addDomainToVercel('invalid..domain');
    expect(result.success).toBe(false);
    expect(result.error).toBe('The domain name is invalid.');
  });

  it('V05 | Network failure (fetch throws) → success: false', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await addDomainToVercel('example.com');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Vercel API unreachable');
  });

  it('V06 | Missing env vars → success: false with config error', async () => {
    delete process.env.VERCEL_API_TOKEN;

    const result = await addDomainToVercel('example.com');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/missing env vars/i);
  });

  it('V07 | Route source imports from extracted utility', async () => {
    const routeSource = readFileSync(
      resolve(process.cwd(), 'app/api/instructor/domain/verify/route.ts'),
      'utf-8'
    );

    // Must import from the extracted utility
    expect(routeSource).toContain("from '@/lib/services/vercel-domains'");
    expect(routeSource).toContain('addDomainToVercel');
  });

  it('V08 | Route source no longer contains inline addDomainToVercel function', async () => {
    const routeSource = readFileSync(
      resolve(process.cwd(), 'app/api/instructor/domain/verify/route.ts'),
      'utf-8'
    );

    // The inline function definition should be gone
    expect(routeSource).not.toContain('async function addDomainToVercel');
    // The WLA-006 bug pattern should be gone (treating domain_already_in_use as success)
    expect(routeSource).not.toContain('domain_already_in_use');
    expect(routeSource).not.toContain('domain_already_exists');
  });

});
