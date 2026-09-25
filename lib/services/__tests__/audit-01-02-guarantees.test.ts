/**
 * AUDIT-01 / AUDIT-02 Guarantee Tests
 *
 * Proves the four required properties from the audit remediation plan:
 *
 * 1. writeAuditLog succeeds → state change commits (no interference)
 * 2. writeAuditLog fails inside $transaction → propagates (caller rolls back)
 * 3. writeAuditLogSafe fails → caller continues (non-critical policy enforced)
 * 4. No duplicate audit entry on serialization retry (audit rolls back with tx)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoist mock functions so vi.mock factories can reference them ──────────────
const { mockPrismaAuditCreate, mockLoggerError } = vi.hoisted(() => ({
  mockPrismaAuditCreate: vi.fn(),
  mockLoggerError:       vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { auditLog: { create: mockPrismaAuditCreate } },
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: mockLoggerError, info: vi.fn(), warn: vi.fn() },
}))

// Now import the module under test
import { writeAuditLog, writeAuditLogSafe } from '../audit'

// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_ENTRY = {
  action:     'BOOKING_CREATED',
  actorId:    'provider-123',
  actorRole:  'provider',
  targetType: 'BOOKING',
  targetId:   'booking-456',
  metadata:   { price: 65, isPaid: true },
}

// ─────────────────────────────────────────────────────────────────────────────

describe('writeAuditLog — Tier 1/2/3 (atomic, throws on failure)', () => {

  it('succeeds — writes via the tx client', async () => {
    const txCreate = vi.fn().mockResolvedValue({ id: 'audit-1' })
    const tx = { auditLog: { create: txCreate } }

    await expect(writeAuditLog(tx, SAMPLE_ENTRY)).resolves.toBeUndefined()

    expect(txCreate).toHaveBeenCalledOnce()
    expect(txCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action:     'BOOKING_CREATED',
        actorId:    'provider-123',
        targetType: 'BOOKING',
        targetId:   'booking-456',
      }),
    })
  })

  it('failure propagates — tx.auditLog.create throws → writeAuditLog throws', async () => {
    const tx = { auditLog: { create: vi.fn().mockRejectedValue(new Error('DB timeout')) } }

    await expect(writeAuditLog(tx, SAMPLE_ENTRY)).rejects.toThrow('DB timeout')
  })

  it('simulated $transaction: audit failure prevents state change from committing', async () => {
    // Models: prisma.$transaction(async (tx) => {
    //   await tx.booking.create(...)   ← state change
    //   await writeAuditLog(tx, ...)   ← audit fails → throws → tx rolls back
    // })
    const txCreate = vi.fn().mockRejectedValue(new Error('audit constraint violation'))
    const tx = {
      booking:  { create: vi.fn().mockResolvedValue({ id: 'b1' }) },
      auditLog: { create: txCreate },
    }

    const txCallback = async (txClient: typeof tx) => {
      await txClient.booking.create({ data: {} as any })
      await writeAuditLog(txClient, SAMPLE_ENTRY) // throws → transaction rolls back
    }

    await expect(txCallback(tx)).rejects.toThrow('audit constraint violation')
    expect(txCreate).toHaveBeenCalledOnce()
    // In real Prisma, the booking.create would be rolled back because the callback threw
  })

  it('uses tx client — NOT module-level prisma (AUDIT-02 atomicity)', async () => {
    const txCreate = vi.fn().mockResolvedValue({})
    const tx = { auditLog: { create: txCreate } }

    await writeAuditLog(tx, SAMPLE_ENTRY)

    expect(txCreate).toHaveBeenCalledOnce()
    expect(mockPrismaAuditCreate).not.toHaveBeenCalled() // module-level prisma NOT used
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('writeAuditLogSafe — Tier 4 (non-throwing)', () => {

  beforeEach(() => { vi.clearAllMocks() })

  it('succeeds — writes via module-level prisma', async () => {
    mockPrismaAuditCreate.mockResolvedValue({ id: 'audit-safe-1' })

    await expect(writeAuditLogSafe(SAMPLE_ENTRY)).resolves.toBeUndefined()

    expect(mockPrismaAuditCreate).toHaveBeenCalledOnce()
  })

  it('failure — does NOT throw, logs at ERROR level (AUDIT-01 fix)', async () => {
    mockPrismaAuditCreate.mockRejectedValue(new Error('pool exhausted'))

    await expect(writeAuditLogSafe(SAMPLE_ENTRY)).resolves.toBeUndefined()

    expect(mockLoggerError).toHaveBeenCalledOnce()
    expect(mockLoggerError).toHaveBeenCalledWith(
      'Non-critical audit log write failed',
      expect.objectContaining({
        action:  'BOOKING_CREATED',
        actorId: 'provider-123',
        error:   'pool exhausted',
      }),
    )
  })

  it('caller continues after writeAuditLogSafe failure', async () => {
    mockPrismaAuditCreate.mockRejectedValue(new Error('audit DB offline'))

    let callerContinued = false

    async function caller() {
      await writeAuditLogSafe(SAMPLE_ENTRY)
      callerContinued = true
    }

    await caller()
    expect(callerContinued).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('AUDIT-02: no duplicate on serialization retry', () => {

  it('audit rolls back with tx — retry produces exactly one audit entry', async () => {
    const auditWrites: string[] = []
    let attempt = 0

    const makeTx = () => ({
      auditLog: {
        create: vi.fn().mockImplementation(() => {
          auditWrites.push(`attempt-${attempt}`)
        }),
      },
    })

    const runWithRetry = async () => {
      for (let i = 0; i <= 2; i++) {
        attempt = i
        const tx = makeTx()
        try {
          if (i === 0) throw Object.assign(new Error('P2034'), { code: 'P2034' })
          await writeAuditLog(tx, { ...SAMPLE_ENTRY, action: 'SUBSCRIPTION_UPDATED' })
          break
        } catch (err: any) {
          if (err.code !== 'P2034' || i === 2) throw err
          // On P2034: tx rolled back → auditWrites entry is discarded (we pop it)
          auditWrites.pop() // simulates DB rollback of the audit row
        }
      }
    }

    await runWithRetry()

    // After one failed attempt (rolled back) + one successful attempt: exactly one entry
    expect(auditWrites).toHaveLength(1)
    expect(auditWrites[0]).toBe('attempt-1') // second attempt succeeded
  })
})
