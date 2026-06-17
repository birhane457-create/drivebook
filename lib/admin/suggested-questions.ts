/**
 * Centralized suggested questions for the Admin AI Chat.
 * Grouped by category so they can be surfaced contextually.
 * Add new questions here — the chat component reads from this file.
 */

export interface SuggestedQuestion {
  question: string
  category: 'operations' | 'revenue' | 'instructors' | 'students' | 'platform'
  /** Which tool(s) this question likely triggers — informational only */
  tools?: string[]
}

export const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  // Operations
  { question: 'What needs my attention today?',          category: 'operations', tools: ['getDailySummary', 'getHealthScore'] },
  { question: 'What happened in the last 6 hours?',      category: 'operations', tools: ['getOperationsTimeline'] },
  { question: 'Are there any open disputes?',             category: 'operations', tools: ['getDailySummary'] },
  { question: 'Show me stuck payments.',                  category: 'operations', tools: ['getDailySummary'] },

  // Revenue
  { question: 'Why is revenue lower this week?',          category: 'revenue',     tools: ['getWeeklyReport', 'getRevenueBreakdown'] },
  { question: 'How much revenue did we lose from cancellations?', category: 'revenue', tools: ['getRevenueBreakdown'] },
  { question: 'Which instructors generated the most revenue?',    category: 'revenue', tools: ['getRevenueBreakdown'] },
  { question: 'How are we tracking this week vs last week?',      category: 'revenue', tools: ['getWeeklyReport'] },

  // Instructors
  { question: 'Which instructors are highest risk?',      category: 'instructors', tools: ['getInstructorRisk'] },
  { question: 'Who has incomplete Stripe onboarding?',    category: 'instructors', tools: ['getInstructorRisk'] },
  { question: 'Which instructors have expiring documents?', category: 'instructors', tools: ['getInstructorRisk'] },
  { question: 'Who has the most cancellations this month?', category: 'instructors', tools: ['getInstructorRisk'] },

  // Students
  { question: 'How many students returned for another booking?', category: 'students', tools: ['getStudentRetention'] },
  { question: 'What is our student retention rate?',      category: 'students',    tools: ['getStudentRetention'] },

  // Platform
  { question: 'What is the platform health score?',       category: 'platform',    tools: ['getHealthScore'] },
  { question: 'Which suburbs have the most demand?',      category: 'platform',    tools: ['getSuburbDemand'] },
  { question: 'Summarise platform health.',               category: 'platform',    tools: ['getHealthScore', 'getDailySummary'] },
]

/** Returns a subset for display — default 6, optionally filtered by category */
export function getDisplayQuestions(opts?: {
  category?: SuggestedQuestion['category']
  limit?: number
}): SuggestedQuestion[] {
  const { category, limit = 6 } = opts ?? {}
  const filtered = category
    ? SUGGESTED_QUESTIONS.filter(q => q.category === category)
    : SUGGESTED_QUESTIONS
  return filtered.slice(0, limit)
}

/** All unique categories */
export const QUESTION_CATEGORIES = [
  'operations', 'revenue', 'instructors', 'students', 'platform',
] as const satisfies SuggestedQuestion['category'][]
