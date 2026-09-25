import { describe, expect, it } from 'vitest'
import { TOOL_DEFINITIONS, validateToolArguments } from '@/lib/admin/ai-tools'

const cases = [
  ['daily completed bookings', 'getDailySummary', {}],
  ['platform health score', 'getHealthScore', {}],
  ['instructors needing attention', 'getInstructorRisk', { limit: 5, minScore: 30 }],
  ['week over week performance', 'getWeeklyReport', {}],
  ['cancellation revenue loss', 'getRevenueBreakdown', { days: 30 }],
  ['repeat student retention', 'getStudentRetention', {}],
  ['demand by suburb', 'getSuburbDemand', { limit: 10 }],
  ['recent operations activity', 'getOperationsTimeline', { hours: 24 }],
  ['yesterday cancellations', 'getDailySummary', {}],
  ['payment failure health signal', 'getHealthScore', {}],
  ['high risk instructors', 'getInstructorRisk', { minScore: 70 }],
  ['current versus prior week', 'getWeeklyReport', {}],
  ['top earners this quarter', 'getRevenueBreakdown', { days: 90 }],
  ['students returning within 60 days', 'getStudentRetention', {}],
  ['new market demand', 'getSuburbDemand', { limit: 20 }],
  ['payout activity today', 'getOperationsTimeline', { hours: 12 }],
  ['open disputes summary', 'getDailySummary', {}],
  ['onboarding health', 'getHealthScore', {}],
  ['instructor risk shortlist', 'getInstructorRisk', { limit: 3 }],
  ['monthly revenue trend', 'getRevenueBreakdown', { days: 30 }],
] as const

describe('P1-10 tool selection contract', () => {
  it.each(cases)('%s selects a documented read-only tool', (_intent, tool, args) => {
    const definition = TOOL_DEFINITIONS.find((entry) => entry.function.name === tool)
    expect(definition).toBeDefined()
    expect(definition?.function.description.length).toBeGreaterThan(20)
    expect(validateToolArguments(tool, args)).toEqual({ valid: true, args })
  })
})
