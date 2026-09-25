export type CopilotSelection = {
  tool: string
  args: Record<string, number>
}

const selectionRules: Array<{ keywords: string[]; exclude?: string[]; selection: CopilotSelection }> = [
  { keywords: ['morning', 'operations'], selection: { tool: 'getDailySummary', args: {} } },
  { keywords: ['health', 'review'], selection: { tool: 'getHealthScore', args: {} } },
  { keywords: ['quarterly', 'cancellation'], selection: { tool: 'getRevenueBreakdown', args: { days: 90 } } },
  { keywords: ['high', 'risk', 'providers'], selection: { tool: 'getInstructorRisk', args: { limit: 3, minScore: 80 } } },
  { keywords: ['risk', 'review'], selection: { tool: 'getInstructorRisk', args: { limit: 10, minScore: 40 } } },
  { keywords: ['compliance', 'risk'], selection: { tool: 'getInstructorRisk', args: { limit: 10, minScore: 40 } } },
  { keywords: ['completed', 'bookings'], selection: { tool: 'getDailySummary', args: {} } },
  { keywords: ['cancellations', 'yesterday'], selection: { tool: 'getDailySummary', args: {} } },
  { keywords: ['disputes', 'summary'], selection: { tool: 'getDailySummary', args: {} } },
  { keywords: ['health', 'score'], selection: { tool: 'getHealthScore', args: {} } },
  { keywords: ['payment', 'failures'], selection: { tool: 'getHealthScore', args: {} } },
  { keywords: ['onboarding', 'health'], selection: { tool: 'getHealthScore', args: {} } },
  { keywords: ['at', 'risk'], selection: { tool: 'getInstructorRisk', args: { limit: 5, minScore: 30 } } },
  { keywords: ['compliance', 'instructors'], selection: { tool: 'getInstructorRisk', args: { limit: 10, minScore: 40 } } },
  { keywords: ['weekly', 'performance'], selection: { tool: 'getWeeklyReport', args: {} } },
  { keywords: ['week', 'revenue', 'trend'], selection: { tool: 'getWeeklyReport', args: {} } },
  { keywords: ['leadership', 'update'], selection: { tool: 'getWeeklyReport', args: {} } },
  { keywords: ['cancellation', 'revenue'], exclude: ['quarterly'], selection: { tool: 'getRevenueBreakdown', args: { days: 30 } } },
  { keywords: ['repeat', 'students'], selection: { tool: 'getStudentRetention', args: {} } },
  { keywords: ['student', 'retention'], selection: { tool: 'getStudentRetention', args: {} } },
  { keywords: ['retention', 'students'], selection: { tool: 'getStudentRetention', args: {} } },
  { keywords: ['service', 'suburb'], selection: { tool: 'getSuburbDemand', args: { limit: 15 } } },
  { keywords: ['market', 'demand'], selection: { tool: 'getSuburbDemand', args: { limit: 20 } } },
  { keywords: ['overnight', 'activity'], selection: { tool: 'getOperationsTimeline', args: { hours: 8 } } },
  { keywords: ['payout', 'activity'], selection: { tool: 'getOperationsTimeline', args: { hours: 12 } } },
]

function words(query: string): Set<string> {
  return new Set(query.toLowerCase().match(/[a-z]+/g) ?? [])
}

export function selectCopilotTool(query: string): CopilotSelection | null {
  const queryWords = words(query)
  if (queryWords.size === 0 || /\d/.test(query) || /\b(days?|hours?|weeks?)\b/i.test(query)) return null

  const matches = selectionRules.filter(({ keywords, exclude = [] }) => (
    !exclude.some((keyword) => [...queryWords].some((word) => word.startsWith(keyword)))
    && keywords.every((keyword) => [...queryWords].some((word) => word.startsWith(keyword) || keyword.startsWith(word)))
  ))
  const selections = new Map(matches.map(({ selection }) => [
    JSON.stringify(selection), selection,
  ]))

  if (selections.size !== 1) return null
  const selection = selections.values().next().value as CopilotSelection
  return { tool: selection.tool, args: { ...selection.args } }
}