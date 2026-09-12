/**
 * Dashboard signal constructors — compute Signal[] from admin dashboard data.
 * 
 * Replaces inline severity assignment with derived severity based on:
 * - Count thresholds (5+ pending → medium, 10+ → high)
 * - Financial impact (disputes, withholding)
 * - Operational urgency (stuck bookings blocking payouts)
 * 
 * Each function returns Signal[], not ad-hoc objects with hardcoded severity.
 */

import { Signal, deriveSeverityFromCount } from '@/lib/types/signal'

export function createPendingInstructorSignal(count: number): Signal | null {
  if (count === 0) return null
  
  return {
    id: 'pending-instructors',
    severity: deriveSeverityFromCount(count, { high: 10, medium: 3 }),
    source: 'instructor',
    title: `${count} instructor${count > 1 ? 's' : ''} awaiting approval`,
    link: '/admin/instructors?status=PENDING',
    linkText: 'Review now →',
    count,
    createdAt: new Date(), // In real system, track when first instructor went pending
  }
}

export function createEndedConfirmedSignal(count: number): Signal | null {
  if (count === 0) return null
  
  // Stuck bookings are HIGH severity — they block payout release
  return {
    id: 'ended-confirmed-bookings',
    severity: count >= 5 ? 'high' : 'medium',
    source: 'booking',
    title: `${count} lesson${count > 1 ? 's' : ''} ended but still CONFIRMED`,
    description: 'Mark complete to release payouts.',
    link: '/admin/bookings',
    linkText: 'Go to Bookings →',
    count,
    createdAt: new Date(),
  }
}

export function createExpiringDocsSignal(count: number): Signal | null {
  if (count === 0) return null
  
  // Expiring docs are MEDIUM — 30-day window gives time to resolve
  return {
    id: 'expiring-documents',
    severity: 'medium',
    source: 'compliance',
    title: `${count} instructor${count > 1 ? 's' : ''} have documents expiring within 30 days`,
    link: '/admin/documents',
    linkText: 'Review Docs →',
    count,
    createdAt: new Date(),
  }
}

export function createUnverifiedABNSignal(count: number): Signal | null {
  if (count === 0) return null
  
  // Unverified ABN is HIGH — causes 47% withholding on every payout
  return {
    id: 'unverified-abns',
    severity: 'high',
    source: 'finance',
    title: `${count} approved instructor${count > 1 ? 's' : ''} ${count > 1 ? 'have' : 'has'} unverified ABN`,
    description: '47% withholding applies.',
    link: '/admin/instructors',
    linkText: 'Verify ABNs →',
    count,
    createdAt: new Date(),
  }
}

export function createOpenDisputesSignal(count: number): Signal | null {
  if (count === 0) return null
  
  // Open disputes are CRITICAL — freeze all payouts, immediate action required
  return {
    id: 'open-disputes',
    severity: count >= 3 ? 'critical' : 'high',
    source: 'finance',
    title: `${count} open chargeback${count > 1 ? 's' : ''} — payouts frozen`,
    link: '/admin/disputes',
    linkText: 'Review Disputes →',
    count,
    createdAt: new Date(),
  }
}

export function createStripeNotConnectedSignal(count: number): Signal | null {
  if (count === 0) return null
  
  // Stripe not connected is HIGH — blocks payout processing entirely
  return {
    id: 'stripe-not-connected',
    severity: 'high',
    source: 'finance',
    title: `${count} instructor${count > 1 ? 's' : ''} cannot receive payouts — Stripe not connected`,
    description: 'Instructors cannot be paid until Stripe account is linked.',
    link: '/admin/instructors',
    linkText: 'Review Instructors →',
    count,
    createdAt: new Date(),
  }
}

/**
 * Main entry point — constructs all admin dashboard signals from raw counts.
 * Returns only non-null signals (filters out 0-count conditions).
 */
export function constructDashboardSignals(params: {
  pendingInstructors: number
  endedConfirmed: number
  expiringDocs: number
  unverifiedABNs: number
  openDisputes: number
  stripeNotConnected?: number  // Optional — add to dashboard query when ready
}): Signal[] {
  return [
    createPendingInstructorSignal(params.pendingInstructors),
    createEndedConfirmedSignal(params.endedConfirmed),
    createExpiringDocsSignal(params.expiringDocs),
    createUnverifiedABNSignal(params.unverifiedABNs),
    createOpenDisputesSignal(params.openDisputes),
    params.stripeNotConnected !== undefined 
      ? createStripeNotConnectedSignal(params.stripeNotConnected)
      : null,
  ].filter((s): s is Signal => s !== null)
}
