import { describe, expect, it } from 'vitest'
import { TOOL_DEFINITIONS, validateToolArguments } from '@/lib/admin/ai-tools'

const scenarios = [
  ['morning operations briefing', 'getDailySummary', {}],
  ['health review before launch', 'getHealthScore', {}],
  ['triage instructor compliance', 'getInstructorRisk', { limit: 10, minScore: 40 }],
  ['weekly leadership update', 'getWeeklyReport', {}],
  ['investigate cancellation impact', 'getRevenueBreakdown', { days: 7 }],
  ['measure student repeat booking', 'getStudentRetention', {}],
  ['choose a new service suburb', 'getSuburbDemand', { limit: 15 }],
  ['investigate overnight activity', 'getOperationsTimeline', { hours: 8 }],
  ['review quarterly cancellation loss', 'getRevenueBreakdown', { days: 90 }],
  ['find the highest risk providers', 'getInstructorRisk', { limit: 3, minScore: 80 }],
] as const

describe('P1-10 representative admin scenarios', () => {
  it.each(scenarios)('%s has a bounded evidence request', (_scenario, tool, args) => {
    expect(TOOL_DEFINITIONS.some((entry) => entry.function.name === tool)).toBe(true)
    expect(validateToolArguments(tool, args)).toMatchObject({ valid: true })
  })
})
