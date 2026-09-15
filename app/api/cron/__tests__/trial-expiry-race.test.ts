/**
 * Tests for app/api/cron/check-trial-expiry/route.ts
 *
 * Invariant under test — SUB-12-A:
 *   The trial-expiry cron must NOT overwrite a subscription that a concurrent
 *   webhook already converted from TRIAL to ACTIVE.
 *
 * The fix: inside the transaction, updateMany conditions on status='TRIAL'.
 * If the row is already ACTIVE (webhook won the race), count=0 → skip.
 *
 * Tests:
 *   1. Normal expiry: TRIAL row → EXPIRED, provider reverted
 *   2. Race skip: row already ACTIVE → count=0, provider NOT touched
 *   3. Multiple trials: some expire, some skip (concurrent conversion)
 *   4. No expired trials: cron exits early, no DB writes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock Prisma ──────────────────────────────────────────────────────────────
const {
  mockFindMany,
  mockUpdateMany,
  mockProviderUpdate,
  mockAuditLogCreate,
  mockTransaction,
} = vi.hoisted(() => ({
  mockFindMany:       vi.fn(),
  mockUpdateMany:     vi.fn(),
  mockProviderUpdate: vi.fn(),
  mockAuditLogCreate: vi.fn(),
  mockTransaction:    vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: { findMany: mockFindMany },
    provider:     { update: mockProviderUpdate },
    auditLog:     { create: mockAuditLogCreate },
    $transaction: mockTransaction,
  },
}));

vi.mock('@/lib/services/cron-health', () => ({
  pingCronHealth: vi.fn().mockResolvedValue(undefined),
  failCronHealth: vi.fn().mockResolvedValue(undefined),
}));

process.env.CRON_SECRET = 'test-secret';

import { GET } from '../check-trial-expiry/route';

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeTrial(id: string, providerId: string) {
  return {
    id,
    providerId,
    tier: 'PRO',
    status: 'TRIAL',
    trialEndsAt: new Date('2026-07-01'), // in the past
    provider: { id: providerId, name: `Instructor ${id}`, userId: `user_${id}` },
  };
}

function cronRequest() {
  return new NextRequest('http://localhost/api/cron/check-trial-expiry', {
    headers: { authorization: 'Bearer test-secret' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuditLogCreate.mockResolvedValue(undefined);
});

describe('Trial expiry cron — SUB-12-A race condition', () => {

  describe('1. Normal expiry — TRIAL row updated to EXPIRED', () => {
    it('expires one trial subscription and reverts provider', async () => {
      const trial = makeTrial('sub_001', 'prov_001');
      mockFindMany.mockResolvedValue([trial]);

      // Simulate: subscription is still TRIAL when updateMany runs → count = 1
      mockTransaction.mockImplementation(async (fn: Function) => {
        const txClient = {
          subscription: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          provider: {
            update: mockProviderUpdate.mockResolvedValue({ id: 'prov_001', name: 'Instructor sub_001' }),
          },
        };
        return fn(txClient);
      });

      const response = await GET(cronRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.count).toBe(1);
      expect(body.skipped).toBe(0);
      expect(mockProviderUpdate).toHaveBeenCalledOnce();
      expect(mockProviderUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subscriptionStatus: 'EXPIRED', subscriptionTier: 'BASIC' }),
        }),
      );
    });
  });

  describe('2. Race skip — row already ACTIVE when cron runs', () => {
    it('does NOT update provider when updateMany count is 0', async () => {
      const trial = makeTrial('sub_002', 'prov_002');
      mockFindMany.mockResolvedValue([trial]);

      // Simulate: webhook already changed status to ACTIVE → updateMany matches 0 rows
      mockTransaction.mockImplementation(async (fn: Function) => {
        const txClient = {
          subscription: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
          provider: {
            update: mockProviderUpdate,
          },
        };
        return fn(txClient);
      });

      const response = await GET(cronRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.count).toBe(0);
      expect(body.skipped).toBe(1);
      expect(body.skippedIds).toContain('sub_002');

      // Critical: provider must NOT be touched
      expect(mockProviderUpdate).not.toHaveBeenCalled();
    });
  });

  describe('3. Mixed batch — some expire, some already converted', () => {
    it('correctly separates expired vs skipped', async () => {
      const trial1 = makeTrial('sub_a', 'prov_a'); // still TRIAL
      const trial2 = makeTrial('sub_b', 'prov_b'); // already ACTIVE (race)
      const trial3 = makeTrial('sub_c', 'prov_c'); // still TRIAL
      mockFindMany.mockResolvedValue([trial1, trial2, trial3]);

      let callCount = 0;
      mockTransaction.mockImplementation(async (fn: Function) => {
        callCount++;
        // trial1 and trial3 still TRIAL; trial2 was already converted
        const isConverted = callCount === 2;
        const innerUpdateMany = vi.fn().mockResolvedValue({ count: isConverted ? 0 : 1 });
        const innerProviderUpdate = vi.fn().mockResolvedValue({ id: `prov_${callCount}`, name: `Inst ${callCount}` });

        const txClient = {
          subscription: { updateMany: innerUpdateMany },
          provider: { update: innerProviderUpdate },
        };
        const result = await fn(txClient);

        if (!isConverted) {
          // Verify provider was updated for non-skipped trials
          expect(innerProviderUpdate).toHaveBeenCalledOnce();
        } else {
          expect(innerProviderUpdate).not.toHaveBeenCalled();
        }

        return result;
      });

      const response = await GET(cronRequest());
      const body = await response.json();

      expect(body.count).toBe(2);
      expect(body.skipped).toBe(1);
      expect(body.skippedIds).toEqual(['sub_b']);
    });
  });

  describe('4. No expired trials', () => {
    it('returns early without any DB writes', async () => {
      mockFindMany.mockResolvedValue([]);

      const response = await GET(cronRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.count).toBe(0);
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe('5. Unauthorized request', () => {
    it('rejects requests without cron secret', async () => {
      const req = new NextRequest('http://localhost/api/cron/check-trial-expiry');
      const response = await GET(req);
      expect(response.status).toBe(401);
    });
  });
});
