import { describe, expect, it } from 'vitest'
import { safeQuery, safeQueryAll } from '@/lib/admin/tool-contracts'

const failures = [
  ['booking count timeout', 'completed bookings'],
  ['payment aggregate unavailable', 'week revenue'],
  ['provider query rejected', 'approved providers'],
  ['dispute database timeout', 'disputes'],
  ['payout service unavailable', 'failed payouts'],
  ['customer count unavailable', 'new students'],
  ['retention query failed', 'repeat students'],
  ['suburb demand query failed', 'suburb demand'],
  ['audit event query failed', 'audit events'],
  ['operations query failed', 'booking activity'],
] as const

describe('P1-10 failure handling contract', () => {
  it.each(failures)('%s remains an explicit ERROR, not zero', async (message, label) => {
    const result = await safeQuery<number>(() => Promise.reject(new Error(message)), label)
    expect(result.status).toBe('ERROR')
    if (result.status === 'ERROR') {
      expect(result.error).toContain(label)
      expect(result.error).toContain(message)
      expect(result.error).not.toMatch(/\b0\b/)
    }
  })

  it('preserves successful evidence beside a failed query', async () => {
    const results = await safeQueryAll([
      () => Promise.resolve(42),
      () => Promise.reject(new Error('revenue unavailable')),
      () => Promise.resolve(7),
    ], ['completed', 'revenue', 'students'])

    expect(results.map((result) => result.status)).toEqual(['SUCCESS', 'ERROR', 'SUCCESS'])
  })
})
