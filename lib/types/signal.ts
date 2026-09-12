/**
 * Signal — Canonical schema for platform alerts, attention items, and actionable signals.
 * 
 * This is the single source of truth for severity taxonomy across:
 * - Admin dashboard alerts (pending instructors, stuck bookings, disputes)
 * - Daily summary attention items (API-driven)
 * - Staff task priorities (URGENT → critical, HIGH → high, etc)
 * - Any future alert/notification system
 * 
 * Design principles:
 * 1. Severity is derived from impact (financial, operational, compliance)
 * 2. Every signal has a clear owner/link (actionable, not informational noise)
 * 3. Timestamp enables age-based escalation (24h old medium → high)
 * 4. Source enables filtering/grouping in multi-system dashboards
 */

/**
 * Severity scale — maps to CSS tokens in globals.css
 * 
 * Critical: Immediate action required. Blocking revenue/compliance/safety.
 *           Examples: open chargebacks, expired insurance on active bookings
 * 
 * High:     Urgent, non-blocking. Delays payouts/operations if not resolved.
 *           Examples: unverified ABNs (47% withholding), stuck ended bookings
 * 
 * Medium:   Attention needed, not urgent. Track but doesn't block core ops.
 *           Examples: pending instructor approvals, expiring docs (30d window)
 * 
 * Low:      Informational. Monitor trends, no immediate action.
 *           Examples: new instructor signups, monthly revenue milestones
 * 
 * Info:     Neutral information, not a warning.
 *           Examples: system health checks, scheduled maintenance notices
 */
export type SignalSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

/**
 * Signal source — identifies which system generated this alert
 */
export type SignalSource = 
  | 'booking'          // Booking lifecycle issues (stuck states, no-shows)
  | 'instructor'       // Provider compliance (docs, ABN, approvals)
  | 'finance'          // Revenue, payouts, disputes, withholding
  | 'compliance'       // Regulatory issues (insurance, police checks)
  | 'operations'       // Platform health, system issues
  | 'client'           // Customer-facing issues (support tickets, refunds)
  | 'staff'            // Internal task queue, SLA breaches

/**
 * Core Signal interface — used by AttentionItemList, API responses, task systems
 */
export interface Signal {
  /** Unique identifier (for deduplication, tracking dismissals) */
  id: string
  
  /** Severity level — determines color, urgency, escalation rules */
  severity: SignalSeverity
  
  /** Which system/domain generated this signal */
  source: SignalSource
  
  /** Human-readable title (e.g. "5 instructors awaiting approval") */
  title: string
  
  /** Optional description/impact statement */
  description?: string
  
  /** Link to resolve/triage (e.g. /admin/instructors?status=PENDING) */
  link: string
  
  /** Optional link text override (defaults to "View →") */
  linkText?: string
  
  /** Count of affected entities (e.g. 5 instructors, 12 bookings) */
  count?: number
  
  /** When this signal was first raised (for age-based escalation) */
  createdAt: Date | string
  
  /** Optional estimated financial/operational impact */
  estimatedImpact?: string
  
  /** Optional owner/assignee (for staff task queue integration) */
  owner?: string
  
  /** Optional icon override (defaults to severity-based icon) */
  icon?: React.ReactNode
}

/**
 * Severity derivation rules — used by signal constructors to compute severity from conditions
 * 
 * Example usage:
 *   const severity = deriveSeverityFromBookingAge(hoursStuck)
 *   const signal: Signal = { severity, ... }
 */
export function deriveSeverityFromFinancialImpact(amountAUD: number): SignalSeverity {
  if (amountAUD >= 10000) return 'critical'  // $10k+ frozen/at-risk
  if (amountAUD >= 2000)  return 'high'      // $2k+ — urgent but not blocking
  if (amountAUD >= 500)   return 'medium'    // $500+ — track
  return 'low'
}

export function deriveSeverityFromAge(createdAt: Date | string, thresholds: {
  critical?: number  // hours
  high?: number
  medium?: number
}): SignalSeverity {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
  if (thresholds.critical && ageHours >= thresholds.critical) return 'critical'
  if (thresholds.high && ageHours >= thresholds.high) return 'high'
  if (thresholds.medium && ageHours >= thresholds.medium) return 'medium'
  return 'low'
}

export function deriveSeverityFromCount(count: number, thresholds: {
  critical?: number
  high?: number
  medium?: number
}): SignalSeverity {
  if (thresholds.critical && count >= thresholds.critical) return 'critical'
  if (thresholds.high && count >= thresholds.high) return 'high'
  if (thresholds.medium && count >= thresholds.medium) return 'medium'
  return 'low'
}

/**
 * Severity to Alert variant mapping — used by AttentionItemList
 */
export function severityToVariant(severity: SignalSeverity): 'destructive' | 'warning' | 'info' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'destructive'
    case 'medium':
      return 'warning'
    case 'low':
    case 'info':
      return 'info'
  }
}

/**
 * Severity to icon color — used by AttentionItemList
 */
export function severityToIconColor(severity: SignalSeverity): string {
  switch (severity) {
    case 'critical': return 'text-red-500'
    case 'high':     return 'text-red-400'
    case 'medium':   return 'text-amber-400'
    case 'low':      return 'text-sky-400'
    case 'info':     return 'text-blue-400'
  }
}
