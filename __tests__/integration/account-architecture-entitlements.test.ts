import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getAccountFeatures } from '@/lib/utils/account';

describe('account architecture — subscription entitlements', () => {
  it('does not grant white-label to BASIC from accountType=BUSINESS', () => {
    expect(
      getAccountFeatures({ subscriptionTier: 'BASIC', accountType: 'BUSINESS' }).whiteLabel
    ).toBe(false);
  });

  it('grants white-label to PREMIUM independently of account structure', () => {
    expect(
      getAccountFeatures({ subscriptionTier: 'PREMIUM', accountType: 'INDIVIDUAL' }).whiteLabel
    ).toBe(true);
  });

  it('includes PREMIUM in subdomain branding eligibility', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/subdomain/[slug]/page.tsx'),
      'utf-8'
    );
    expect(source).toContain("instructor.subscriptionTier === 'PREMIUM'");
    expect(source).toContain('const isBrandingEligible');
  });
});
