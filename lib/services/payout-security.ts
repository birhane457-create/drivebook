/**
 * Payout Security Module
 * 
 * Provides runtime verification of payout destination ownership to prevent
 * account substitution attacks (PAY-01).
 * 
 * Security Model:
 * - Stripe account metadata.providerId is authoritative for this application threat model
 * - Database values can be compromised; Stripe-side metadata cannot (without API key compromise)
 * - Verification must happen immediately before money movement
 * - Fail closed on any error or missing metadata
 */

import type Stripe from 'stripe';

export interface OwnershipVerificationResult {
  valid: boolean;
  reason?: string;
  stripeAccountId?: string;
  expectedProviderId?: string;
  actualProviderId?: string;
}

/**
 * Verify that a Stripe Connect account's metadata.providerId matches the expected provider.
 * 
 * This establishes the security invariant:
 * "A payout can only be executed to a Stripe account whose metadata.providerId 
 * matches the payout.providerId"
 * 
 * SECURITY PROPERTIES:
 * 1. Retrieves account from Stripe (authoritative source for this threat model)
 * 2. Fails closed on any lookup error
 * 3. Fails closed on missing metadata
 * 4. Requires exact string match (no type coercion)
 * 
 * TOCTOU PROTECTION:
 * Caller MUST use the verified stripeAccountId for the subsequent transfer.
 * Do not retrieve destination from database again after verification.
 * 
 * @param stripe - Stripe client instance
 * @param stripeAccountId - The account ID to verify (from payout.stripeAccountId)
 * @param expectedProviderId - The provider ID that should own this account
 * @returns Verification result with validity flag and diagnostic information
 */
export async function verifyPayoutDestinationOwnership(
  stripe: Stripe,
  stripeAccountId: string,
  expectedProviderId: string
): Promise<OwnershipVerificationResult> {
  try {
    // Retrieve the Stripe account to check metadata
    const account = await stripe.accounts.retrieve(stripeAccountId);

    // Fail closed: account must exist
    if (!account || !account.id) {
      return {
        valid: false,
        reason: 'Stripe account not found or invalid',
        stripeAccountId,
        expectedProviderId,
      };
    }

    // Fail closed: metadata.providerId must exist
    const actualProviderId = account.metadata?.providerId;
    if (!actualProviderId) {
      return {
        valid: false,
        reason: 'Stripe account missing metadata.providerId',
        stripeAccountId,
        expectedProviderId,
        actualProviderId: undefined,
      };
    }

    // Exact match required (no type coercion)
    if (actualProviderId !== expectedProviderId) {
      return {
        valid: false,
        reason: `Ownership mismatch: Stripe account metadata.providerId='${actualProviderId}' does not match expected providerId='${expectedProviderId}'`,
        stripeAccountId,
        expectedProviderId,
        actualProviderId,
      };
    }

    // Verification passed
    return {
      valid: true,
      stripeAccountId,
      expectedProviderId,
      actualProviderId,
    };
  } catch (error) {
    // Fail closed on any Stripe API error
    return {
      valid: false,
      reason: `Stripe API error during ownership verification: ${error instanceof Error ? error.message : String(error)}`,
      stripeAccountId,
      expectedProviderId,
    };
  }
}
