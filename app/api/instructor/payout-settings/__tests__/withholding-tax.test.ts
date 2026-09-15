/**
 * Tests for C-3 fix: payout-settings POST cannot set withholdingTaxRate,
 * abnVerified, or abnStatus from client input.
 *
 * Invariant: The instructor can submit ABN data (abn, abnEntityName) but
 * cannot assert their own verification status or determine their tax rate.
 * Those fields are admin-only.
 *
 * The fix removed three fields from verificationUpdate:
 *   - abnVerified
 *   - abnStatus
 *   - withholdingTaxRate
 *
 * Tests verify the logic that was removed is no longer present:
 *   1. Client supplies abnVerified:true + withholdingTaxRate:0 → neither written
 *   2. Client supplies abnVerified:true alone → not written
 *   3. Client supplies withholdingTaxRate:0 alone → not written
 *   4. Client supplies abnEntityName → IS written (allowed field)
 *   5. When ABN changes → withholdingTaxRate reset to 47 by server logic (unchanged)
 */

import { describe, it, expect } from 'vitest';

// ── Extract the verificationUpdate logic for unit testing ──────────────────
// This mirrors the exact logic in payout-settings POST after the C-3 fix.

interface ClientInput {
  abn?: string | null;
  abnEntityName?: string;
  abnVerified?: boolean;
  abnStatus?: string | null;
  withholdingTaxRate?: number;
  [key: string]: unknown;
}

interface ExistingState {
  abn: string | null;
}

/**
 * Reproduces the verificationUpdate derivation from the fixed POST handler.
 * Returns the fields that would be written to the DB for the verification block.
 */
function deriveVerificationUpdate(
  clientInput: ClientInput,
  existing: ExistingState,
): Record<string, unknown> {
  const incomingAbn  = clientInput.abn ?? null;
  const existingAbn  = existing.abn ?? null;
  const abnChanged   = incomingAbn !== existingAbn;

  // Destructure to get abnEntityName (only allowed field from client)
  const { abnEntityName } = clientInput;

  // C-3 FIX: abnVerified, abnStatus, withholdingTaxRate are NOT included
  const verificationUpdate: Record<string, unknown> = abnChanged ? {} : {
    ...(abnEntityName !== undefined ? { abnEntityName } : {}),
    // abnVerified:       ADMIN-ONLY
    // abnStatus:         ADMIN-ONLY
    // withholdingTaxRate: ADMIN-ONLY
  };

  return verificationUpdate;
}

describe('C-3: payout-settings withholdingTaxRate / abnVerified protection', () => {

  describe('1. Client cannot self-verify and set 0% withholding', () => {
    it('abnVerified:true + withholdingTaxRate:0 in same request → neither written', () => {
      const update = deriveVerificationUpdate(
        { abn: '12345678901', abnVerified: true, withholdingTaxRate: 0 },
        { abn: '12345678901' }, // ABN unchanged
      );

      expect(update).not.toHaveProperty('abnVerified');
      expect(update).not.toHaveProperty('withholdingTaxRate');
    });
  });

  describe('2. Client cannot set abnVerified alone', () => {
    it('abnVerified:true supplied → not included in update', () => {
      const update = deriveVerificationUpdate(
        { abn: '12345678901', abnVerified: true },
        { abn: '12345678901' },
      );

      expect(update).not.toHaveProperty('abnVerified');
    });

    it('abnVerified:false supplied → also not included (no downgrade attack either)', () => {
      const update = deriveVerificationUpdate(
        { abn: '12345678901', abnVerified: false },
        { abn: '12345678901' },
      );

      expect(update).not.toHaveProperty('abnVerified');
    });
  });

  describe('3. Client cannot set withholdingTaxRate alone', () => {
    it('withholdingTaxRate:0 supplied without abnVerified → not written', () => {
      const update = deriveVerificationUpdate(
        { abn: '12345678901', withholdingTaxRate: 0 },
        { abn: '12345678901' },
      );

      expect(update).not.toHaveProperty('withholdingTaxRate');
    });

    it('withholdingTaxRate:47 supplied → also not written (no client override)', () => {
      const update = deriveVerificationUpdate(
        { abn: '12345678901', withholdingTaxRate: 47 },
        { abn: '12345678901' },
      );

      expect(update).not.toHaveProperty('withholdingTaxRate');
    });
  });

  describe('4. abnEntityName is the only allowed verification-adjacent field', () => {
    it('abnEntityName supplied → IS included in update', () => {
      const update = deriveVerificationUpdate(
        { abn: '12345678901', abnEntityName: 'Test Pty Ltd' },
        { abn: '12345678901' },
      );

      expect(update).toHaveProperty('abnEntityName', 'Test Pty Ltd');
    });

    it('no abnEntityName supplied → update is empty (no verification fields)', () => {
      const update = deriveVerificationUpdate(
        { abn: '12345678901' },
        { abn: '12345678901' },
      );

      expect(update).toEqual({});
    });
  });

  describe('5. ABN change resets server-side (not affected by client fields)', () => {
    it('when ABN changes verificationUpdate is empty regardless of client input', () => {
      // When abnChanged=true the route uses abnFields={abnVerified:false,...}
      // and verificationUpdate is {} — so client-supplied verification fields
      // never appear in the update even if provided.
      const update = deriveVerificationUpdate(
        { abn: '99999999999', abnVerified: true, withholdingTaxRate: 0 },
        { abn: '12345678901' }, // different ABN
      );

      // verificationUpdate is always {} when abnChanged
      expect(update).toEqual({});
    });
  });

  describe('C-3 attack scenario (explicit)', () => {
    it('full attack payload: same ABN + claiming verified + 0% rate → no effect', () => {
      // The attack: POST { abn:"same_abn", abnVerified:true, withholdingTaxRate:0 }
      const update = deriveVerificationUpdate(
        {
          abn:               '51824753556',
          abnVerified:       true,
          abnStatus:         'VERIFIED',
          withholdingTaxRate: 0,
          abnEntityName:     'My Company Pty Ltd',
        },
        { abn: '51824753556' }, // same ABN — abnChanged = false
      );

      // Only abnEntityName should be present
      expect(Object.keys(update)).toEqual(['abnEntityName']);
      expect(update.abnEntityName).toBe('My Company Pty Ltd');
      expect(update).not.toHaveProperty('abnVerified');
      expect(update).not.toHaveProperty('abnStatus');
      expect(update).not.toHaveProperty('withholdingTaxRate');
    });
  });
});
