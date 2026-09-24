import { describe, expect, it } from 'vitest'
import { callTool, validateToolArguments } from '../ai-tools'

describe('P1-08 server-side Copilot boundary', () => {
  it.each([
    ['booking notes injection', 'getInstructorRisk', { limit: 5 }],
    ['customer/provider name injection', 'getDailySummary', {}],
    ['address injection', 'getSuburbDemand', { limit: 10 }],
    ['payment error injection', 'getWeeklyReport', {}],
    ['tool-result field injection', 'getOperationsTimeline', { hours: 24 }],
  ])('accepts only the schema for %s and does not treat content as executable input', (_label, tool, args) => {
    expect(validateToolArguments(tool, args)).toEqual({ valid: true, args })
  })

  it.each([
    ['malicious mutation tool', 'deleteBooking', {}],
    ['unavailable tool', 'getSystemPrompt', {}],
    ['unexpected argument', 'getDailySummary', { executeMutation: true }],
    ['string numeric argument injection', 'getSuburbDemand', { limit: 'DROP TABLE bookings' }],
    ['negative numeric argument', 'getOperationsTimeline', { hours: -1 }],
    ['non-finite numeric argument', 'getRevenueBreakdown', { days: Number.NaN }],
  ])('rejects %s before dispatch', (_label, tool, args) => {
    const result = validateToolArguments(tool, args)
    expect(result.valid).toBe(false)
  })

  it('rejects an unknown mutation tool through the dispatcher', async () => {
    await expect(callTool('updateBookingStatus', { status: 'COMPLETED' })).rejects.toThrow(
      'Unknown tool: updateBookingStatus',
    )
  })
})
