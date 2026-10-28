/**
 * WLA-009 TESTS — PREMIUM white-label entitlement vs subdomain renderer gate
 *
 * Finding: lib/utils/account.ts grants whiteLabel=true to PREMIUM tier, but
 * app/subdomain/[slug]/page.tsx's local isPro definition excludes PREMIUM —
 * so PREMIUM providers' branding (logo) is silently suppressed on their booking
 * page despite their entitlement.
 *
 * BRAND-V-05 (closed) was about the domain verify API endpoint; it does NOT
 * cover the renderer's isPro logic. This is a separate gap.
 *
 * STATUS: No code change until policy is settled. These tests document the
 * existing inconsistency and will be updated after a policy decision.
 *
 * WHAT IS TESTED
 *   G01  getAccountFeatures: PREMIUM has whiteLabel=true
 *   G02  getAccountFeatures: PREMIUM has customDomain=true (isStudioPlus)
 *   G03  getAccountFeatures: PREMIUM has customSlug=true (isPro)
 *   G04  Renderer isPro: PRO and STUDIO are included
 *   G05  Renderer isPro: PREMIUM is excluded (documents the gap, no fix yet)
 *   G06  Source documents the gap — WLA-009 comment present
 *   G07  Policy question: renderer comment says "PRO/STUDIO/BUSINESS only"
 *   G08  Pure-logic: if isPro included PREMIUM, hasBranding would be true for PREMIUM
 */

import { describe, it, expect } from 'vitest';
import { getAccountFeatures } from '@/lib/utils/account';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const rendererSource = readFileSync(
  resolve(process.cwd(), 'app/subdomain/[slug]/page.tsx'),
  'utf-8'
);

describe('WLA-009 — PREMIUM white-label entitlement vs subdomain renderer gate', () => {

  describe('getAccountFeatures — centralized entitlement policy', () => {

    it('G01 | PREMIUM has whiteLabel=true in getAccountFeatures', () => {
      const features = getAccountFeatures({ subscriptionTier: 'PREMIUM' });
      expect(features.whiteLabel).toBe(true);
    });

    it('G02 | PREMIUM has customDomain=true in getAccountFeatures', () => {
      const features = getAccountFeatures({ subscriptionTier: 'PREMIUM' });
      expect(features.customDomain).toBe(true);
    });

    it('G03 | PREMIUM has customSlug=true in getAccountFeatures', () => {
      const features = getAccountFeatures({ subscriptionTier: 'PREMIUM' });
      expect(features.customSlug).toBe(true);
    });

    it('G03b | PRO and STUDIO also have whiteLabel=false (below PREMIUM)', () => {
      // PRO and STUDIO do NOT get whiteLabel per getAccountFeatures
      const proFeatures = getAccountFeatures({ subscriptionTier: 'PRO' });
      const studioFeatures = getAccountFeatures({ subscriptionTier: 'STUDIO' });
      expect(proFeatures.whiteLabel).toBe(false);
      expect(studioFeatures.whiteLabel).toBe(false);
    });

  });

  describe('Renderer isPro — subdomain page behavior (documents gap)', () => {

    it('G04 | Renderer source: PRO and STUDIO are in isPro definition', () => {
      expect(rendererSource).toContain("instructor.subscriptionTier === 'PRO' || instructor.subscriptionTier === 'STUDIO'");
    });

    it('G05 | Renderer source: PREMIUM is absent from isPro definition (the gap)', () => {
      // WLA-009: this test documents that PREMIUM is excluded from renderer isPro.
      // No fix yet — policy decision required.
      // If Option A is chosen (include PREMIUM), update the source and this test.
      const isPrologLine = rendererSource.match(/const isPro\s*=\s*[^\n]+/)?.[0] ?? '';
      expect(isPrologLine).not.toContain('PREMIUM');
    });

    it('G06 | Source analysis file documents the gap', () => {
      const analysisSource = readFileSync(
        resolve(process.cwd(), 'docs/audit/WLA-009-SOURCE-ANALYSIS.md'),
        'utf-8'
      );
      expect(analysisSource).toContain('WLA-009');
      expect(analysisSource).toContain('PREMIUM');
      expect(analysisSource).toContain('policy');
    });

    it('G07 | Renderer comment mentions PRO/STUDIO/BUSINESS but not PREMIUM', () => {
      // The inline comment says "logo/name white-labelling is PRO/STUDIO/BUSINESS only"
      // This documents the original intent — PREMIUM was excluded deliberately
      // OR it was never updated when PREMIUM was added. Policy must clarify.
      expect(rendererSource).toContain('PRO/STUDIO/BUSINESS only');
      expect(rendererSource).not.toMatch(/PRO\/STUDIO\/.*PREMIUM/);
    });

  });

  describe('Policy verification helpers (pure logic)', () => {

    it('G08 | If PREMIUM were included in isPro, hasBranding would be true', () => {
      // Simulate what the renderer would do if PREMIUM were in isPro
      const tier = 'PREMIUM';
      const showBrandingOnBookingPage = true;

      // Current behavior (gap)
      const isProCurrent = tier === 'PRO' || tier === 'STUDIO';
      const hasBrandingCurrent = isProCurrent && showBrandingOnBookingPage;

      // Fixed behavior (Option A)
      const isProPremiumIncluded = tier === 'PRO' || tier === 'STUDIO' || tier === 'PREMIUM';
      const hasBrandingFixed = isProPremiumIncluded && showBrandingOnBookingPage;

      expect(hasBrandingCurrent).toBe(false);   // current: logo suppressed
      expect(hasBrandingFixed).toBe(true);       // fixed: logo shown

      // These two values differ — confirming the fix would change behavior
      expect(hasBrandingCurrent).not.toBe(hasBrandingFixed);
    });

  });

});
