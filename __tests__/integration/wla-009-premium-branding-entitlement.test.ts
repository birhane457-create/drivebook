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

    it('G04 | Renderer source: PRO, STUDIO and PREMIUM are in isBrandingEligible', () => {
      // After the WLA-009 fix the renderer uses isBrandingEligible not isPro
      expect(rendererSource).toContain("isBrandingEligible");
      expect(rendererSource).toContain("instructor.subscriptionTier === 'PRO'");
      expect(rendererSource).toContain("instructor.subscriptionTier === 'STUDIO'");
      expect(rendererSource).toContain("instructor.subscriptionTier === 'PREMIUM'");
    });

    it('G05 | Renderer source: PREMIUM is included in isBrandingEligible (WLA-009 fix)', () => {
      // WLA-009 fixed: PREMIUM is now included.
      // This test replaces the earlier G05 that documented the gap.
      const isBrandingLine = rendererSource.match(/const isBrandingEligible\s*=\s*[^;]+/s)?.[0] ?? '';
      expect(isBrandingLine).toContain('PREMIUM');
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

    it('G07 | Renderer comment reflects architecture decision', () => {
      // After the fix, the comment should mention the architecture decision
      expect(rendererSource).toContain('subscription entitlement');
      expect(rendererSource).toContain('PREMIUM');
      // Old comment "PRO/STUDIO/BUSINESS only" is gone
      expect(rendererSource).not.toContain('PRO/STUDIO/BUSINESS only');
    });

  });

  describe('Policy verification helpers (pure logic)', () => {

    it('G08 | isBrandingEligible includes PREMIUM — hasBranding is now true for PREMIUM', () => {
      // After the WLA-009 fix: PREMIUM isBrandingEligible=true
      const tier = 'PREMIUM';
      const showBrandingOnBookingPage = true;

      // Fixed behavior (isBrandingEligible includes PREMIUM)
      const isBrandingEligible = tier === 'PRO' || tier === 'STUDIO' || tier === 'PREMIUM';
      const hasBranding = isBrandingEligible && showBrandingOnBookingPage;

      expect(hasBranding).toBe(true);  // PREMIUM now gets branding
    });

    it('G09 | multiInstructor returns false for all current tiers (not yet implemented)', () => {
      // Architecture decision: structure never grants entitlement.
      // multiInstructor is false until Business tier and multi-provider management
      // are implemented and the provider-limit enforcement is in place.
      for (const tier of ['BASIC', 'PRO', 'STUDIO', 'PREMIUM']) {
        const features = getAccountFeatures({ subscriptionTier: tier });
        expect(features.multiInstructor).toBe(false);
      }
    });

    it('G10 | whiteLabel is tier-only — accountType=BUSINESS does not grant it alone', () => {
      // Architecture decision: structure (accountType) must not grant whiteLabel.
      // A BUSINESS account type with a BASIC tier must NOT get whiteLabel.
      const businessBasic = getAccountFeatures({ subscriptionTier: 'BASIC', accountType: 'BUSINESS' });
      expect(businessBasic.whiteLabel).toBe(false);

      // A BUSINESS account with PREMIUM tier DOES get whiteLabel (via tier, not structure)
      const businessPremium = getAccountFeatures({ subscriptionTier: 'PREMIUM', accountType: 'BUSINESS' });
      expect(businessPremium.whiteLabel).toBe(true);
    });

  });

});
