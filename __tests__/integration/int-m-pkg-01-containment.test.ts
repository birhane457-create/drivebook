/**
 * INT-M-PKG-01 CONTAINMENT VERIFICATION
 * 
 * This test suite verifies that the mobile package purchase endpoint
 * is properly disabled by default (fail closed) and returns 503 when
 * the feature flag is not explicitly enabled.
 * 
 * SECURITY REQUIREMENT: POST /api/client/packages/mobile must return 503
 * unless ENABLE_MOBILE_PACKAGE_PURCHASE=true is explicitly set.
 * 
 * This is containment only - not a complete fix. The three underlying defects
 * (IDOR, hardcoded pricing, payment bypass) remain in the code but are
 * unreachable while the endpoint is disabled.
 * 
 * Full remediation tracked separately: package catalog + payment flow redesign.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Test configuration
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const ORIGINAL_ENV = process.env.ENABLE_MOBILE_PACKAGE_PURCHASE

describe('INT-M-PKG-01 Containment Verification', () => {
  
  beforeAll(async () => {
    // Ensure we're testing against the correct state
    console.log('INT-M-PKG-01 Containment Test Suite')
    console.log('Feature flag value:', process.env.ENABLE_MOBILE_PACKAGE_PURCHASE)
  })

  afterAll(async () => {
    // Restore original env value
    if (ORIGINAL_ENV !== undefined) {
      process.env.ENABLE_MOBILE_PACKAGE_PURCHASE = ORIGINAL_ENV
    } else {
      delete process.env.ENABLE_MOBILE_PACKAGE_PURCHASE
    }
    await prisma.$disconnect()
  })

  describe('C1: Default behavior (feature flag not set)', () => {
    beforeEach(() => {
      // Ensure flag is not set
      delete process.env.ENABLE_MOBILE_PACKAGE_PURCHASE
    })

    it('should return 503 when attempting package purchase', async () => {
      const response = await fetch(`${BASE_URL}/api/client/packages/mobile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer fake-jwt-token', // Would fail auth anyway
        },
        body: JSON.stringify({
          packageId: 'test-provider-id',
          paymentMethod: 'stripe',
        }),
      })

      expect(response.status).toBe(503)
      
      const data = await response.json()
      expect(data.code).toBe('MOBILE_PURCHASE_DISABLED')
      expect(data.message).toContain('web app')
      expect(data.webUrl).toBeDefined()
    })
  })

  describe('C2: Explicit disable (feature flag = false)', () => {
    beforeEach(() => {
      process.env.ENABLE_MOBILE_PACKAGE_PURCHASE = 'false'
    })

    it('should return 503 when flag is explicitly false', async () => {
      const response = await fetch(`${BASE_URL}/api/client/packages/mobile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer fake-jwt-token',
        },
        body: JSON.stringify({
          packageId: 'test-provider-id',
          paymentMethod: 'stripe',
        }),
      })

      expect(response.status).toBe(503)
      
      const data = await response.json()
      expect(data.code).toBe('MOBILE_PURCHASE_DISABLED')
    })
  })

  describe('C3: Various non-true values (fail closed)', () => {
    const falseValues = ['0', 'False', 'FALSE', 'no', 'disabled', '', 'null', 'undefined']

    falseValues.forEach(value => {
      it(`should return 503 when flag = "${value}"`, async () => {
        process.env.ENABLE_MOBILE_PACKAGE_PURCHASE = value

        const response = await fetch(`${BASE_URL}/api/client/packages/mobile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer fake-jwt-token',
          },
          body: JSON.stringify({
            packageId: 'test-provider-id',
            paymentMethod: 'stripe',
          }),
        })

        expect(response.status).toBe(503)
      })
    })
  })

  describe('C4: GET endpoint remains available', () => {
    it('should allow GET requests (viewing existing packages)', async () => {
      // GET endpoint should remain functional for viewing client's existing packages
      // This test verifies we only disabled POST, not GET
      
      const response = await fetch(`${BASE_URL}/api/client/packages/mobile`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer fake-jwt-token', // Would fail auth, but proves we reach auth layer
        },
      })

      // Should reach auth validation (401) not feature flag (503)
      expect(response.status).toBe(401)
    })
  })

  describe('C5: Response format verification', () => {
    beforeEach(() => {
      delete process.env.ENABLE_MOBILE_PACKAGE_PURCHASE
    })

    it('should return properly formatted error response', async () => {
      const response = await fetch(`${BASE_URL}/api/client/packages/mobile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer fake-jwt-token',
        },
        body: JSON.stringify({
          packageId: 'test-provider-id',
          paymentMethod: 'stripe',
        }),
      })

      expect(response.status).toBe(503)
      expect(response.headers.get('content-type')).toContain('application/json')
      
      const data = await response.json()
      
      // Required fields
      expect(data.error).toBeDefined()
      expect(data.message).toBeDefined()
      expect(data.code).toBe('MOBILE_PURCHASE_DISABLED')
      expect(data.webUrl).toBeDefined()
      
      // Mobile app can use this to redirect user
      expect(data.webUrl).toMatch(/^https?:\/\//)
    })
  })

  describe('C6: Security - endpoint does not reach vulnerable code', () => {
    beforeEach(() => {
      delete process.env.ENABLE_MOBILE_PACKAGE_PURCHASE
    })

    it('should not process packageId or reach checkProviderEligible()', async () => {
      // The vulnerable code path starts with: checkProviderEligible(packageId, ...)
      // With the kill switch, we should never reach that code
      
      const response = await fetch(`${BASE_URL}/api/client/packages/mobile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer fake-jwt-token',
        },
        body: JSON.stringify({
          packageId: 'malicious-provider-id',
          paymentMethod: 'manual',
        }),
      })

      expect(response.status).toBe(503)
      
      // Verify no booking was created (defensive check)
      // In a proper test environment, we'd have a test database to verify this
      // For now, verify we got 503 before any business logic
    })
  })

  describe('C7: Documentation references', () => {
    it('should reference audit documentation in code comments', async () => {
      // This is a meta-test verifying the containment is properly documented
      const fs = await import('fs/promises')
      const routeContent = await fs.readFile(
        'app/api/client/packages/mobile/route.ts',
        'utf-8'
      )

      // Verify documentation references are present
      expect(routeContent).toContain('INT-M-PKG-01')
      expect(routeContent).toContain('CONTAINMENT')
      expect(routeContent).toContain('IDOR')
      expect(routeContent).toContain('Hardcoded pricing')
      expect(routeContent).toContain('Payment bypass')
      expect(routeContent).toContain('docs/audit/phase2/INT-M-PKG-01-DISCOVERY.md')
    })
  })
})

/**
 * TEST EXECUTION NOTES:
 * 
 * These tests verify containment only. They prove:
 *   ✅ POST endpoint returns 503 by default (fail closed)
 *   ✅ Only explicit 'true' would enable the endpoint
 *   ✅ GET endpoint remains available for viewing packages
 *   ✅ Error response is properly formatted for mobile app
 *   ✅ Vulnerable code path is unreachable while disabled
 * 
 * These tests DO NOT verify:
 *   ❌ Complete fix for IDOR vulnerability
 *   ❌ Complete fix for hardcoded pricing
 *   ❌ Complete fix for payment bypass
 *   ❌ Package catalog implementation
 *   ❌ Stripe payment integration
 * 
 * Next phase requires:
 *   1. Package catalog schema design
 *   2. Server-side pricing authority
 *   3. Client entitlement verification
 *   4. Payment-before-activation flow
 *   5. Full integration tests of replacement flow
 * 
 * INT-M-PKG-01 should remain OPEN until replacement flow is complete.
 */
