/**
 * SUB-06-A Writer #4: Trial Creation Routes - Provider-First Locking Tests
 * 
 * Purpose: Verify that both desktop and mobile trial creation routes use the
 * createOrReuseTrialSubscription() lifecycle helper with Provider-first locking
 * to prevent race conditions during initial trial subscription creation.
 * 
 * Writers:
 * - Desktop: app/api/instructor/subscription/route.ts POST (else block, trial creation)
 * - Mobile: app/api/instructor/subscription/mobile/route.ts POST (trial creation)
 * 
 * Test Coverage:
 * 1. Desktop route creates trial subscription via lifecycle helper
 * 2. Desktop route prevents concurrent trial creation races
 * 3. Mobile route creates trial subscription via lifecycle helper
 * 4. Mobile route reuses existing trial (no duplicate)
 * 
 * CRITICAL: These tests invoke the actual production routes with proper authentication.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { POST as DesktopPOST } from '@/app/api/instructor/subscription/route';
import { POST as MobilePOST } from '@/app/api/instructor/subscription/mobile/route';
import { getServerSession } from 'next-auth';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Mock next-auth session
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock Stripe to prevent actual API calls in tests
// The second concurrent request may reach the Stripe checkout path
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      customers: {
        create: vi.fn().mockResolvedValue({ id: 'cus_test_mock' }),
      },
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({
            url: 'https://checkout.stripe.com/test',
            id: 'cs_test_mock',
          }),
        },
      },
    })),
  };
});

describe('SUB-06-A Writer #4: Trial Creation Locking (Production Routes)', () => {
  // Test fixtures
  const testUserId = 'test-user-writer-04';
  const testProviderId = 'test-provider-writer-04';
  const testEmail = 'writer04@test.com';
  const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret';

  beforeEach(async () => {
    // Clean up any existing test data
    await prisma.subscription.deleteMany({
      where: { providerId: testProviderId },
    });
    await prisma.provider.deleteMany({
      where: { id: testProviderId },
    });
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.subscription.deleteMany({
      where: { providerId: testProviderId },
    });
    await prisma.provider.deleteMany({
      where: { id: testProviderId },
    });
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
    vi.clearAllMocks();
  });

  /**
   * Helper: Create authenticated desktop request
   */
  function createDesktopRequest(tier: string = 'BASIC', billingCycle: 'monthly' | 'annual' = 'monthly') {
    return new NextRequest('http://localhost:3000/api/instructor/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, billingCycle }),
    });
  }

  /**
   * Helper: Create authenticated mobile request with JWT
   */
  function createMobileRequest(userId: string, tier: string = 'BASIC', billingCycle: 'monthly' | 'annual' = 'monthly') {
    // Mobile route expects JWT with sub=userId (not providerId)
    const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '1h' });
    return new NextRequest('http://localhost:3000/api/instructor/subscription/mobile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ tier, billingCycle }),
    });
  }

  /**
   * Helper: Mock desktop authenticated session
   */
  function mockDesktopSession(userId: string, email: string) {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: userId, email, role: 'INSTRUCTOR' }
    } as any);
  }

  /**
   * Helper: Create test provider and user
   */
  async function createTestUserAndProvider() {
    await prisma.user.create({
      data: {
        id: testUserId,
        email: testEmail,
        name: 'Writer 04 Test User',
      },
    });

    await prisma.provider.create({
      data: {
        id: testProviderId,
        userId: testUserId,
        name: 'Test Provider 04',
        phone: '+61400000004',
        hourlyRate: 80,
        baseAddress: '123 Test St',
        subscriptionTier: 'BASIC',
        subscriptionStatus: 'TRIAL',
        maxProviders: 1,
      },
    });
  }

  describe('Desktop Route Tests', () => {
    it('Test 1: Should create trial subscription via lifecycle helper (desktop)', async () => {
      // Setup: Create user and provider WITHOUT subscription
      await createTestUserAndProvider();

      // Mock authentication
      mockDesktopSession(testUserId, testEmail);

      // Test: Call desktop production route to create first trial subscription
      const request = createDesktopRequest('BASIC');
      
      try {
        const response = await DesktopPOST(request);
        const data = await response.json();

        // Debug: Log error if failed
        if (response.status !== 200) {
          console.error('Test 1 Error Response:', {
            status: response.status,
            data: data,
          });
        }

        // Verify: Response indicates success
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.subscription.tier).toBe('BASIC');
        expect(data.subscription.status).toBe('TRIAL');
      } catch (error) {
        console.error('Test 1 Exception:', error);
        throw error;
      }

      // Verify: Subscription was created in database
      const createdSubscription = await prisma.subscription.findFirst({
        where: { providerId: testProviderId },
      });

      expect(createdSubscription).not.toBeNull();
      expect(createdSubscription!.tier).toBe('BASIC');
      expect(createdSubscription!.status).toBe('TRIAL');
      expect(createdSubscription!.trialEndsAt).not.toBeNull();

      console.log('✅ Test 1 PASS: Desktop route creates trial via lifecycle helper');
    });

    it('Test 2: Should prevent concurrent trial creation via Provider FOR UPDATE (desktop)', async () => {
      // Setup: Create user and provider WITHOUT subscription
      await createTestUserAndProvider();

      // Mock authentication
      mockDesktopSession(testUserId, testEmail);

      // Test: Launch two concurrent trial creation requests
      const createTrialViaRoute = async () => {
        const request = createDesktopRequest('BASIC');
        const response = await DesktopPOST(request);
        return { response, data: await response.json() };
      };

      // Execute concurrent requests to PRODUCTION POST handler
      const [result1, result2] = await Promise.allSettled([
        createTrialViaRoute(),
        createTrialViaRoute(),
      ]);

      // Both should succeed — first creates the trial, second finds it and
      // either reuses it or routes to the Stripe checkout (add-payment) path.
      // Both are valid 200 outcomes. The key invariant is exactly 1 subscription.
      expect(result1.status).toBe('fulfilled');
      expect(result2.status).toBe('fulfilled');

      if (result1.status === 'fulfilled' && result2.status === 'fulfilled') {
        expect(result1.value.response.status).toBe(200);
        expect(result2.value.response.status).toBe(200);
        // One response is the trial creation, the other is either reuse or checkout
        const data1 = result1.value.data;
        const data2 = result2.value.data;
        const bothSucceeded = data1.success !== false && data2.success !== false;
        expect(bothSucceeded).toBe(true);
      }

      // Verify: Exactly ONE subscription was created (no duplicates)
      const allSubscriptions = await prisma.subscription.findMany({
        where: { providerId: testProviderId },
      });

      expect(allSubscriptions.length).toBe(1);
      expect(allSubscriptions[0].status).toBe('TRIAL');

      console.log('✅ Test 2 PASS: Concurrent trial creation prevented via Provider FOR UPDATE (desktop)');
      console.log(`   Exactly 1 subscription created (FOR UPDATE lock prevented duplicate)`);
    });
  });

  describe('Mobile Route Tests', () => {
    it('Test 3: Should create trial subscription via lifecycle helper (mobile)', async () => {
      // Setup: Create user and provider WITHOUT subscription
      await createTestUserAndProvider();

      try {
        // Test: Call mobile production route to create first trial subscription (use userId, not providerId)
        const request = createMobileRequest(testUserId, 'BASIC');
        const response = await MobilePOST(request);
        const data = await response.json();

        // Debug: Log error if failed
        if (response.status !== 200) {
          console.error('Test 3 Error Response:', {
            status: response.status,
            data: data,
          });
        }

        // Verify: Response indicates success
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.subscription.tier).toBe('BASIC');
        expect(data.subscription.status).toBe('TRIAL');
      } catch (error) {
        console.error('Test 3 Exception:', error);
        throw error;
      }

      // Verify: Subscription was created in database
      const createdSubscription = await prisma.subscription.findFirst({
        where: { providerId: testProviderId },
      });

      expect(createdSubscription).not.toBeNull();
      expect(createdSubscription!.tier).toBe('BASIC');
      expect(createdSubscription!.status).toBe('TRIAL');
      expect(createdSubscription!.trialEndsAt).not.toBeNull();

      console.log('✅ Test 3 PASS: Mobile route creates trial via lifecycle helper');
    });

    it('Test 4: Should reuse existing trial subscription (mobile)', async () => {
      // Setup: Create user, provider, AND existing trial subscription
      await createTestUserAndProvider();

      const existingTrial = await prisma.subscription.create({
        data: {
          providerId: testProviderId,
          tier: 'BASIC',
          status: 'TRIAL',
          monthlyAmount: 0,
          billingCycle: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      // Test: Call mobile route when trial already exists (use userId, not providerId)
      const request = createMobileRequest(testUserId, 'BASIC');
      const response = await MobilePOST(request);
      const data = await response.json();

      // Verify: Response indicates success
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify: NO duplicate subscription was created
      const allSubscriptions = await prisma.subscription.findMany({
        where: { providerId: testProviderId },
      });

      expect(allSubscriptions.length).toBe(1);
      expect(allSubscriptions[0].id).toBe(existingTrial.id);

      console.log('✅ Test 4 PASS: Mobile route reuses existing trial (no duplicate)');
    });
  });
});
