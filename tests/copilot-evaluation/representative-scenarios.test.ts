import { describe, expect, it } from 'vitest'
import { TOOL_DEFINITIONS, validateToolArguments } from '@/lib/admin/ai-tools'
import { selectCopilotTool } from '@/lib/admin/copilot-selection'

const scenarios = [
  ['Prepare a morning operations briefing', 'getDailySummary', {}],
  ['Review platform health before launch', 'getHealthScore', {}],
  ['Triage instructor compliance risks', 'getInstructorRisk', { limit: 10, minScore: 40 }],
  ['Prepare a weekly leadership update', 'getWeeklyReport', {}],
  ['Investigate cancellation revenue impact', 'getRevenueBreakdown', { days: 30 }],
  ['Measure student repeat retention', 'getStudentRetention', {}],
  ['Choose a new service suburb from demand', 'getSuburbDemand', { limit: 15 }],
  ['Investigate overnight operations activity', 'getOperationsTimeline', { hours: 8 }],
  ['Review quarterly cancellation revenue', 'getRevenueBreakdown', { days: 90 }],
  ['Find the highest risk providers', 'getInstructorRisk', { limit: 3, minScore: 80 }],
] as const

describe('P1-10 representative admin scenarios', () => {
  it.each(scenarios)('%s produces the complete expected tool decision', (query, tool, args) => {
    expect(selectCopilotTool(query)).toEqual({ tool, args })
    expect(TOOL_DEFINITIONS.some((entry) => entry.function.name === tool)).toBe(true)
    expect(validateToolArguments(tool, args)).toMatchObject({ valid: true })
  })
})
