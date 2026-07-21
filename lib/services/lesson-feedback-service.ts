import {
  PDACategory,
  PDASeverity,
  getFeedbackByCode,
  getFeedbackByCategory,
  isCriticalFeedback,
  getCategoryDisplayName,
  getSeverityColor
} from '../constants/pda-feedback-codes'

export interface LessonFeedbackSummary {
  totalIssues: number
  criticalIssues: number
  majorIssues: number
  moderateIssues: number
  minorIssues: number
  categoriesAffected: PDACategory[]
  testReady: boolean
  overallScore: number
}

export interface CategoryBreakdown {
  category: PDACategory
  displayName: string
  issueCount: number
  score: number
  feedbackItems: Array<{
    code: number
    severity: PDASeverity
    shortText: string
    fullText: string
    improvementTip: string
  }>
}

/**
 * Calculate category scores based on feedback codes
 * Score = 100 - (number of issues * severity weight)
 */
export function calculateCategoryScores(feedbackCodes: number[]): Record<PDACategory, number> {
  const severityWeights = {
    [PDASeverity.MINOR]: 5,
    [PDASeverity.MODERATE]: 10,
    [PDASeverity.MAJOR]: 20,
    [PDASeverity.CRITICAL]: 50
  }

  const categoryScores: Record<PDACategory, number> = {
    [PDACategory.SIGNAL]: 100,
    [PDACategory.LOOK_BEHIND]: 100,
    [PDACategory.MOVEMENT]: 100,
    [PDACategory.PATH]: 100,
    [PDACategory.VEHICLE_MANAGEMENT]: 100,
    [PDACategory.RESPONSIVENESS]: 100,
    [PDACategory.FLOW]: 100,
    [PDACategory.CRITICAL]: 100
  }

  feedbackCodes.forEach(code => {
    const feedback = getFeedbackByCode(code)
    if (feedback) {
      const deduction = severityWeights[feedback.severity]
      categoryScores[feedback.category] = Math.max(0, categoryScores[feedback.category] - deduction)
    }
  })

  return categoryScores
}

/**
 * Calculate overall score (average of all category scores).
 * Returns 0 if no feedback codes were provided — a score of 100 with no
 * issues is misleading. Only show a score when issues have been assessed.
 */
export function calculateOverallScore(categoryScores: Record<PDACategory, number>, feedbackCodes?: number[]): number {
  if (feedbackCodes !== undefined && feedbackCodes.length === 0) return 0
  const scores = Object.values(categoryScores)
  return Math.round(scores.reduce((a, s) => a + s, 0) / scores.length)
}

/**
 * Determine if student is test-ready based on scores and critical issues
 */
export function isTestReady(feedbackCodes: number[], overallScore: number): boolean {
  const hasCritical = feedbackCodes.some(code => isCriticalFeedback(code))
  return !hasCritical && overallScore >= 80
}

/**
 * Generate a comprehensive summary of lesson feedback
 */
export function generateFeedbackSummary(feedbackCodes: number[]): LessonFeedbackSummary {
  const severityCounts = {
    [PDASeverity.CRITICAL]: 0,
    [PDASeverity.MAJOR]: 0,
    [PDASeverity.MODERATE]: 0,
    [PDASeverity.MINOR]: 0
  }

  const categoriesSet = new Set<PDACategory>()

  feedbackCodes.forEach(code => {
    const feedback = getFeedbackByCode(code)
    if (feedback) {
      severityCounts[feedback.severity]++
      categoriesSet.add(feedback.category)
    }
  })

  const categoryScores = calculateCategoryScores(feedbackCodes)
  const overallScore = calculateOverallScore(categoryScores, feedbackCodes)

  return {
    totalIssues: feedbackCodes.length,
    criticalIssues: severityCounts[PDASeverity.CRITICAL],
    majorIssues: severityCounts[PDASeverity.MAJOR],
    moderateIssues: severityCounts[PDASeverity.MODERATE],
    minorIssues: severityCounts[PDASeverity.MINOR],
    categoriesAffected: Array.from(categoriesSet),
    testReady: isTestReady(feedbackCodes, overallScore),
    overallScore
  }
}

/**
 * Get detailed breakdown by category
 */
export function getCategoryBreakdown(feedbackCodes: number[]): CategoryBreakdown[] {
  const categoryScores = calculateCategoryScores(feedbackCodes)
  const categoryMap = new Map<PDACategory, number[]>()

  // Group codes by category
  feedbackCodes.forEach(code => {
    const feedback = getFeedbackByCode(code)
    if (feedback) {
      if (!categoryMap.has(feedback.category)) {
        categoryMap.set(feedback.category, [])
      }
      categoryMap.get(feedback.category)!.push(code)
    }
  })

  // Build breakdown for each category
  const breakdown: CategoryBreakdown[] = []

  Object.values(PDACategory).forEach(category => {
    const codes = categoryMap.get(category) || []
    const feedbackItems = codes.map(code => {
      const feedback = getFeedbackByCode(code)!
      return {
        code: feedback.code,
        severity: feedback.severity,
        shortText: feedback.shortText,
        fullText: feedback.fullText,
        improvementTip: feedback.improvementTip
      }
    })

    breakdown.push({
      category,
      displayName: getCategoryDisplayName(category),
      issueCount: codes.length,
      score: categoryScores[category],
      feedbackItems
    })
  })

  // Sort by issue count (most issues first)
  return breakdown.sort((a, b) => b.issueCount - a.issueCount)
}

/**
 * Get progress comparison between two lessons
 */
export interface ProgressComparison {
  category: PDACategory
  displayName: string
  previousScore: number
  currentScore: number
  improvement: number
  trend: 'improved' | 'declined' | 'stable'
}

export function compareProgress(
  previousCodes: number[],
  currentCodes: number[]
): ProgressComparison[] {
  const previousScores = calculateCategoryScores(previousCodes)
  const currentScores = calculateCategoryScores(currentCodes)

  return Object.values(PDACategory).map(category => {
    const previousScore = previousScores[category]
    const currentScore = currentScores[category]
    const improvement = currentScore - previousScore

    let trend: 'improved' | 'declined' | 'stable'
    if (improvement > 5) trend = 'improved'
    else if (improvement < -5) trend = 'declined'
    else trend = 'stable'

    return {
      category,
      displayName: getCategoryDisplayName(category),
      previousScore,
      currentScore,
      improvement,
      trend
    }
  })
}

/**
 * Get recommended focus areas (categories with lowest scores)
 */
export function getRecommendedFocusAreas(
  feedbackCodes: number[],
  limit: number = 3
): CategoryBreakdown[] {
  const breakdown = getCategoryBreakdown(feedbackCodes)
  return breakdown
    .filter(item => item.issueCount > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
}

/**
 * Format feedback for display
 */
export function formatFeedbackForDisplay(feedbackCodes: number[]) {
  return feedbackCodes.map(code => {
    const feedback = getFeedbackByCode(code)
    if (!feedback) return null

    return {
      code: feedback.code,
      category: feedback.category,
      categoryDisplay: getCategoryDisplayName(feedback.category),
      severity: feedback.severity,
      severityColor: getSeverityColor(feedback.severity),
      shortText: feedback.shortText,
      fullText: feedback.fullText,
      improvementTip: feedback.improvementTip,
      officialCriteria: feedback.officialCriteria
    }
  }).filter(Boolean)
}
